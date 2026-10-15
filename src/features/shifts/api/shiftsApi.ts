import type {
  OverlappingShift,
  ShiftCursor,
  ShiftDetail,
  ShiftInput,
  ShiftPage,
  ShiftWhen,
} from '@/features/shifts/types';
import { AppException } from '@/lib/errors';
import type { OverlapWindow } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

export const SHIFTS_PAGE_SIZE = 20;

// `my_signup` embeds the signed-in person's own confirmed signup, if any (filtered below).
const SUMMARY_COLUMNS =
  'id, title, location, start_time, end_time, capacity, confirmed_count, cancelled_at, my_signup:signups(status)';
const DETAIL_COLUMNS = `${SUMMARY_COLUMNS}, org_id, description, cancel_reason, version`;

/** Replaces the embedded signup with a plain flag. */
function withSignedUp<T extends { my_signup: unknown[] }>({ my_signup, ...shift }: T) {
  return { ...shift, signed_up: my_signup.length > 0 };
}

/**
 * A PostgREST filter for the rows after `cursor` in list order (keyset pagination on
 * (start_time, id); past shifts run newest first). Timestamps contain reserved characters
 * (`:`, `+`), so they're quoted.
 */
export function afterCursorFilter(cursor: ShiftCursor, when: ShiftWhen): string {
  const op = when === 'upcoming' ? 'gt' : 'lt';
  const start = `"${cursor.startTime}"`;
  return `start_time.${op}.${start},and(start_time.eq.${start},id.${op}.${cursor.id})`;
}

/**
 * One page of an organization's shifts. Fetches one row more than a page to learn whether
 * another page exists, so the list never offers "Load more" for an empty page.
 */
export async function fetchShiftPage({
  orgId,
  userId,
  when,
  cursor,
}: {
  orgId: string;
  /** The signed-in person, to tell which shifts they're signed up for. */
  userId: string;
  when: ShiftWhen;
  cursor: ShiftCursor | null;
}): Promise<ShiftPage> {
  const asOf = cursor?.asOf ?? new Date().toISOString();
  const ascending = when === 'upcoming';

  let query = supabase
    .from('shifts')
    .select(SUMMARY_COLUMNS)
    .eq('org_id', orgId)
    .eq('my_signup.user_id', userId)
    .eq('my_signup.status', 'confirmed');
  query = ascending ? query.gt('end_time', asOf) : query.lte('end_time', asOf);
  if (cursor) query = query.or(afterCursorFilter(cursor, when));

  const { data, error } = await query
    .order('start_time', { ascending })
    .order('id', { ascending })
    .limit(SHIFTS_PAGE_SIZE + 1);
  if (error) throw error;

  const shifts = data.slice(0, SHIFTS_PAGE_SIZE).map(withSignedUp);
  const last = shifts.at(-1);
  const hasMore = data.length > SHIFTS_PAGE_SIZE;
  return {
    shifts,
    next: hasMore && last ? { startTime: last.start_time, id: last.id, asOf } : null,
  };
}

/** One shift, or null if it doesn't exist or belongs to an organization the user isn't in. */
export async function fetchShift(shiftId: string, userId: string): Promise<ShiftDetail | null> {
  const { data, error } = await supabase
    .from('shifts')
    .select(DETAIL_COLUMNS)
    .eq('id', shiftId)
    .eq('my_signup.user_id', userId)
    .eq('my_signup.status', 'confirmed')
    .maybeSingle();
  if (error) throw error;
  return data && withSignedUp(data);
}

/** The columns a shift's details are saved to. */
function toRow(input: ShiftInput) {
  return {
    title: input.title,
    location: input.location,
    description: input.description,
    start_time: input.startTime,
    end_time: input.endTime,
    capacity: input.capacity,
  };
}

/** Coordinators and owners only (row-level security); returns the new shift's id. */
export async function createShift({
  orgId,
  input,
}: {
  orgId: string;
  input: ShiftInput;
}): Promise<string> {
  const { data, error } = await supabase
    .from('shifts')
    .insert({ org_id: orgId, ...toRow(input) })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

/**
 * Saves an edit only if the shift is still at `version`, the one the editor loaded (optimistic
 * concurrency), so one coordinator never silently overwrites another's changes. The database
 * raises its own errors for started and cancelled shifts; when nothing was saved, the shift is
 * read again to say why.
 */
export async function updateShift({
  shiftId,
  userId,
  version,
  input,
}: {
  shiftId: string;
  userId: string;
  version: number;
  input: ShiftInput;
}): Promise<void> {
  const { data, error } = await supabase
    .from('shifts')
    .update(toRow(input))
    .eq('id', shiftId)
    .eq('version', version)
    .select('id');
  if (error) throw error;
  if (data.length > 0) return;

  const current = await fetchShift(shiftId, userId);
  if (!current) throw new AppException('SHIFT_NOT_FOUND');
  if (current.version !== version) throw new AppException('SHIFT_CHANGED');
  // Still there and unchanged, yet not saved: row-level security filtered it out.
  throw new AppException('NOT_AUTHORIZED');
}

/** Cancels a shift that hasn't started; it stays visible, marked cancelled (see `cancel_shift`). */
export async function cancelShift({
  shiftId,
  reason,
}: {
  shiftId: string;
  reason: string;
}): Promise<void> {
  const { error } = await supabase.rpc('cancel_shift', {
    p_shift_id: shiftId,
    // A blank reason is left out (stored as none).
    p_reason: reason.trim() || undefined,
  });
  if (error) throw error;
}

/** Deletes a shift that hasn't started. Row-level security filters out anyone else's attempt. */
export async function deleteShift(shiftId: string): Promise<void> {
  const { data, error } = await supabase.from('shifts').delete().eq('id', shiftId).select('id');
  if (error) throw error;
  if (data.length === 0) throw new AppException('NOT_AUTHORIZED');
}

/**
 * Escapes LIKE wildcards, so a location such as "Room 100%" matches only itself. (PostgREST also
 * reads `*` as a wildcard; at worst that widens a warning, never a write.)
 */
function likeLiteral(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/**
 * Up to three active shifts that overlap `window`: at the same location (ignoring case) or,
 * when there's no location, with the same title. The form shows them as a warning; parallel
 * crews are normal, so overlapping is allowed.
 */
export async function fetchOverlappingShifts(
  orgId: string,
  window: OverlapWindow,
): Promise<OverlappingShift[]> {
  let query = supabase
    .from('shifts')
    .select('id, title, start_time, end_time')
    .eq('org_id', orgId)
    .is('cancelled_at', null)
    .lt('start_time', window.end)
    .gt('end_time', window.start);
  query = window.location
    ? query.ilike('location', likeLiteral(window.location))
    : query.ilike('title', likeLiteral(window.title));
  if (window.excludeShiftId) query = query.neq('id', window.excludeShiftId);

  const { data, error } = await query.order('start_time').limit(3);
  if (error) throw error;
  return data;
}
