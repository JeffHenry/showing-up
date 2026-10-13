import type {
  ShiftCursor,
  ShiftDetail,
  ShiftInput,
  ShiftPage,
  ShiftWhen,
} from '@/features/shifts/types';
import { supabase } from '@/lib/supabase';

export const SHIFTS_PAGE_SIZE = 20;

const SUMMARY_COLUMNS = 'id, title, location, start_time, end_time, capacity, cancelled_at';
const DETAIL_COLUMNS = `${SUMMARY_COLUMNS}, org_id, description, cancel_reason, version`;

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
  when,
  cursor,
}: {
  orgId: string;
  when: ShiftWhen;
  cursor: ShiftCursor | null;
}): Promise<ShiftPage> {
  const asOf = cursor?.asOf ?? new Date().toISOString();
  const ascending = when === 'upcoming';

  let query = supabase.from('shifts').select(SUMMARY_COLUMNS).eq('org_id', orgId);
  query = ascending ? query.gt('end_time', asOf) : query.lte('end_time', asOf);
  if (cursor) query = query.or(afterCursorFilter(cursor, when));

  const { data, error } = await query
    .order('start_time', { ascending })
    .order('id', { ascending })
    .limit(SHIFTS_PAGE_SIZE + 1);
  if (error) throw error;

  const shifts = data.slice(0, SHIFTS_PAGE_SIZE);
  const last = shifts.at(-1);
  const hasMore = data.length > SHIFTS_PAGE_SIZE;
  return {
    shifts,
    next: hasMore && last ? { startTime: last.start_time, id: last.id, asOf } : null,
  };
}

/** One shift, or null if it doesn't exist or belongs to an organization the user isn't in. */
export async function fetchShift(shiftId: string): Promise<ShiftDetail | null> {
  const { data, error } = await supabase
    .from('shifts')
    .select(DETAIL_COLUMNS)
    .eq('id', shiftId)
    .maybeSingle();
  if (error) throw error;
  return data;
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
    .insert({
      org_id: orgId,
      title: input.title,
      location: input.location,
      description: input.description,
      start_time: input.startTime,
      end_time: input.endTime,
      capacity: input.capacity,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}
