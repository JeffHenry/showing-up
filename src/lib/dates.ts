/**
 * Dates and times as they fall in `timeZone` (an organization's time zone), so everyone in the
 * organization sees the same day and time regardless of where they are.
 */

/** A date such as "Oct 19, 2026". */
export function formatDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone }).format(new Date(iso));
}

/** The calendar day as "2026-10-24", for grouping and comparing days. */
export function dayKey(iso: string, timeZone: string): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  }).format(new Date(iso));
}

/** A day heading such as "Saturday, October 24", with the year only when it isn't this year. */
export function formatDayHeading(iso: string, timeZone: string, now: Date): string {
  const sameYear =
    dayKey(iso, timeZone).slice(0, 4) === dayKey(now.toISOString(), timeZone).slice(0, 4);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
    timeZone,
  }).format(new Date(iso));
}

/** A short date such as "Sun, Oct 25". */
export function formatShortDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone,
  }).format(new Date(iso));
}

/** A time such as "9:00 AM". */
export function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone }).format(
    new Date(iso),
  );
}

/** "9:00 AM – 12:00 PM", or "10:00 PM – 2:00 AM (next day)" when it ends on a later day. */
export function formatTimeRange(startIso: string, endIso: string, timeZone: string): string {
  const range = `${formatTime(startIso, timeZone)} – ${formatTime(endIso, timeZone)}`;
  return dayKey(startIso, timeZone) === dayKey(endIso, timeZone) ? range : `${range} (next day)`;
}

function timeZoneNamePart(
  timeZone: string,
  at: Date,
  style: Intl.DateTimeFormatOptions['timeZoneName'],
): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: style }).formatToParts(
    at,
  );
  return parts.find((part) => part.type === 'timeZoneName')?.value ?? timeZone;
}

/** The zone's abbreviation at that moment, such as "CDT" (or "GMT+2" where none is common). */
export function timeZoneAbbreviation(iso: string, timeZone: string): string {
  return timeZoneNamePart(timeZone, new Date(iso), 'short');
}

/** The zone's everyday name, such as "Central Time", without daylight-saving detail. */
export function timeZoneGenericName(timeZone: string, at = new Date()): string {
  return timeZoneNamePart(timeZone, at, 'longGeneric');
}
