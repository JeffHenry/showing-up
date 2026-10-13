import type { ShiftStatus, ShiftSummary } from '@/features/shifts/types';
import { dayKey } from '@/lib/dates';

/** How a shift stands at `now`. */
export function shiftStatus(
  shift: Pick<ShiftSummary, 'start_time' | 'end_time' | 'cancelled_at'>,
  now: Date,
): ShiftStatus {
  if (shift.cancelled_at) return 'cancelled';
  if (new Date(shift.end_time) <= now) return 'ended';
  if (new Date(shift.start_time) <= now) return 'in-progress';
  return 'scheduled';
}

/** The id of a shift's link in a list, so "Load more" can move focus to the first new one. */
export function shiftLinkId(shiftId: string): string {
  return `shift-link-${shiftId}`;
}

/** "1 volunteer needed", "8 volunteers needed". */
export function volunteersNeeded(capacity: number): string {
  return `${String(capacity)} ${capacity === 1 ? 'volunteer' : 'volunteers'} needed`;
}

export interface ShiftDay {
  /** The calendar day, "2026-10-24", in the organization's time zone. */
  key: string;
  shifts: ShiftSummary[];
}

/** Groups consecutive shifts by the day they start on, keeping the list's order. */
export function groupByDay(shifts: ShiftSummary[], timeZone: string): ShiftDay[] {
  const days: ShiftDay[] = [];
  for (const shift of shifts) {
    const key = dayKey(shift.start_time, timeZone);
    const current = days.at(-1);
    if (current?.key === key) current.shifts.push(shift);
    else days.push({ key, shifts: [shift] });
  }
  return days;
}
