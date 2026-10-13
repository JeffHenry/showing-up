import { nextDay, zonedInstant } from '@/lib/zonedTime';

/** Matches the database's limit (see the shifts migration). */
export const MAX_SHIFT_HOURS = 24;

export interface ShiftTimeFields {
  date: string;
  startTime: string;
  endTime: string;
}

const SKIPPED_TIME =
  "Clocks change at that time on this day, so it doesn't exist. Choose another time.";

/** The latest start the database accepts: a year after `now`. */
export function latestStart(now: Date): Date {
  const latest = new Date(now);
  latest.setFullYear(latest.getFullYear() + 1);
  return latest;
}

export type ShiftIntervalResult =
  | { ok: true; start: Date; end: Date; overnight: boolean }
  | { ok: false; field: keyof ShiftTimeFields; message: string };

/**
 * The moments a shift starts and ends, from the form's date and times (wall-clock times in the
 * organization's time zone). An end time at or before the start time means the shift ends the
 * next day. Fails for times that don't exist (clocks springing forward) and for shifts longer
 * than the database allows.
 */
export function shiftInterval(fields: ShiftTimeFields, timeZone: string): ShiftIntervalResult {
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
  return { ok: true, start, end, overnight };
}

/** When the shift ends, if it's overnight (ends at or before its start time), or null. */
export function overnightEnd(fields: ShiftTimeFields, timeZone: string): Date | null {
  if (!fields.startTime || !fields.endTime || fields.endTime > fields.startTime) return null;
  const interval = shiftInterval(fields, timeZone);
  return interval.ok ? interval.end : null;
}

/**
 * The shift's interval plus the database's scheduling rules (a start in the future, at most a
 * year ahead), so the form can explain every rule next to the right field.
 */
export function resolveShiftTimes(
  fields: ShiftTimeFields,
  timeZone: string,
  now: Date,
): ShiftIntervalResult {
  const interval = shiftInterval(fields, timeZone);
  if (!interval.ok) return interval;
  if (interval.start <= now) {
    return { ok: false, field: 'date', message: 'Choose a date and start time in the future.' };
  }
  if (interval.start > latestStart(now)) {
    return { ok: false, field: 'date', message: 'Shifts can be scheduled up to a year ahead.' };
  }
  return interval;
}
