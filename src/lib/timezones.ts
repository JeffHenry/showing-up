/** The browser's IANA time zone, e.g. "America/Chicago". */
export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * IANA time zones to choose from, sorted. Always includes UTC (some browsers leave it out) and
 * the browser's own zone (which can be a legacy alias, such as "Asia/Calcutta", that the list
 * omits), so the default selection is always one of the options.
 */
export function timeZoneOptions(): string[] {
  const zones = new Set(Intl.supportedValuesOf('timeZone'));
  zones.add('UTC');
  zones.add(browserTimeZone());
  return [...zones].sort((a, b) => a.localeCompare(b));
}

/** A readable label for a time zone ("America/New_York" → "America/New York"). */
export function timeZoneLabel(zone: string): string {
  return zone.replaceAll('_', ' ');
}
