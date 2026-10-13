import { nextDay, zonedInstant } from '@/lib/zonedTime';

/** Matches the database's limit (see the shifts migration). */
export const MAX_SHIFT_HOURS = 24;

export interface ShiftTimeFields {
  date: string;
  startTime: string;
  endTime: string;
}

export type ShiftTimesResult =
  | { ok: true; start: Date; end: Date; overnight: boolean }
  | { ok: false; field: keyof ShiftTimeFields; message: string };

const SKIPPED_TIME =
  "Clocks change at that time on this day, so it doesn't exist. Choose another time.";

/** The latest start the database accepts: a year after `now`. */
export function latestStart(now: Date): Date {
  const latest = new Date(now);
  latest.setFullYear(latest.getFullYear() + 1);
  return latest;
}

/** When the shift ends, if it's overnight (ends at or before its start time), or null. */
export function overnightEnd(
  { date, startTime, endTime }: ShiftTimeFields,
  timeZone: string,
): Date | null {
  if (!startTime || !endTime || endTime > startTime) return null;
  if (!zonedInstant({ date, time: startTime }, timeZone)) return null;
  return zonedInstant({ date: nextDay(date), time: endTime }, timeZone);
}

/**
 * Turns the form's date and times, which are wall-clock times in the organization's time zone,
 * into the moments the shift starts and ends, applying the database's rules first so the form
 * can explain them next to the right field. An end time at or before the start time means the
 * shift ends the next day.
 */
export function resolveShiftTimes(
  fields: ShiftTimeFields,
  timeZone: string,
  now: Date,
): ShiftTimesResult {
  const start = zonedInstant({ date: fields.date, time: fields.startTime }, timeZone);
  if (!start) return { ok: false, field: 'startTime', message: SKIPPED_TIME };

  const overnight = fields.endTime <= fields.startTime;
  const endDate = overnight ? nextDay(fields.date) : fields.date;
  const end = zonedInstant({ date: endDate, time: fields.endTime }, timeZone);
  if (!end) return { ok: false, field: 'endTime', message: SKIPPED_TIME };

  // Clocks falling back can stretch "9 AM to 9 AM the next day" to 25 hours.
  if (end.getTime() - start.getTime() > MAX_SHIFT_HOURS * 60 * 60 * 1000) {
    return {
      ok: false,
      field: 'endTime',
      message: `A shift can last at most ${String(MAX_SHIFT_HOURS)} hours.`,
    };
  }
  if (start <= now) {
    return { ok: false, field: 'date', message: 'Choose a date and start time in the future.' };
  }
  if (start > latestStart(now)) {
    return { ok: false, field: 'date', message: 'Shifts can be scheduled up to a year ahead.' };
  }
  return { ok: true, start, end, overnight };
}
