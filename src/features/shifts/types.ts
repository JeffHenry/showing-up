import type { Database } from '@/types/database';

type ShiftRow = Database['public']['Tables']['shifts']['Row'];

/** What a shift list shows for each shift. */
export type ShiftSummary = Pick<
  ShiftRow,
  'id' | 'title' | 'location' | 'start_time' | 'end_time' | 'capacity' | 'cancelled_at'
>;

/** Everything the shift's own page shows, plus what editing needs (`version`). */
export type ShiftDetail = ShiftSummary &
  Pick<ShiftRow, 'org_id' | 'description' | 'cancel_reason' | 'version'>;

/** Upcoming includes shifts in progress; past means they have ended. */
export type ShiftWhen = 'upcoming' | 'past';

/**
 * Where the next page starts: after the last shift shown, in (start_time, id) order. `asOf` pins
 * "now" for the whole list, so a shift ending between page loads can't move between the
 * upcoming and past lists halfway through.
 */
export interface ShiftCursor {
  startTime: string;
  id: string;
  asOf: string;
}

export interface ShiftPage {
  shifts: ShiftSummary[];
  /** Null on the last page. */
  next: ShiftCursor | null;
}

/** A shift as the form produces it, with times as UTC instants. */
export interface ShiftInput {
  title: string;
  location: string | null;
  description: string | null;
  startTime: string;
  endTime: string;
  capacity: number;
}

/** How a shift stands right now; lists badge only cancelled and in-progress shifts. */
export type ShiftStatus = 'scheduled' | 'in-progress' | 'ended' | 'cancelled';
