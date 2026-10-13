import { TZDate } from '@date-fns/tz';

/**
 * A calendar date ("2026-10-24") and wall-clock time ("09:30"), as date and time inputs hold
 * them. On its own it isn't a moment: it becomes one only together with a time zone.
 */
export interface WallTime {
  date: string;
  time: string;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

function pad(value: number) {
  return String(value).padStart(2, '0');
}

/**
 * The moment when clocks in `timeZone` show `date` and `time`, or null when they never do: the
 * hour skipped when clocks spring forward, or a malformed value.
 */
export function zonedInstant({ date, time }: WallTime, timeZone: string): Date | null {
  const dateParts = DATE_PATTERN.exec(date);
  const timeParts = TIME_PATTERN.exec(time);
  if (!dateParts || !timeParts) return null;

  const [year, month, day] = dateParts.slice(1).map(Number) as [number, number, number];
  const [hours, minutes] = timeParts.slice(1).map(Number) as [number, number];
  const zoned = new TZDate(year, month - 1, day, hours, minutes, timeZone);

  // TZDate moves a skipped time (or an impossible date like Feb 30) to one that exists.
  const exists =
    zoned.getFullYear() === year &&
    zoned.getMonth() === month - 1 &&
    zoned.getDate() === day &&
    zoned.getHours() === hours &&
    zoned.getMinutes() === minutes;
  return exists ? new Date(zoned.getTime()) : null;
}

/** What clocks in `timeZone` show at `instant`, e.g. to prefill date and time inputs. */
export function wallTimeAt(instant: Date | string, timeZone: string): WallTime {
  const zoned = new TZDate(new Date(instant).getTime(), timeZone);
  return {
    date: `${String(zoned.getFullYear())}-${pad(zoned.getMonth() + 1)}-${pad(zoned.getDate())}`,
    time: `${pad(zoned.getHours())}:${pad(zoned.getMinutes())}`,
  };
}

/** The calendar day after `date` ("2026-12-31" → "2027-01-01"). Pure calendar math: no zones. */
export function nextDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return next.toISOString().slice(0, 10);
}
