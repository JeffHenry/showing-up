/**
 * A date such as "Oct 19, 2026", as it falls in `timeZone` (an organization's time zone), so
 * everyone in the organization sees the same day regardless of where they are.
 */
export function formatDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone }).format(new Date(iso));
}
