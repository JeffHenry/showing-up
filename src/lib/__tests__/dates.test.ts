import { describe, expect, it } from 'vitest';
import {
  dayKey,
  formatDate,
  formatDayHeading,
  formatShortDate,
  formatTime,
  formatTimeRange,
  timeZoneAbbreviation,
  timeZoneGenericName,
} from '@/lib/dates';

const CHICAGO = 'America/Chicago';

describe('formatDate', () => {
  it('shows the day as it falls in the given time zone', () => {
    // 03:00 UTC on Oct 20 is still the evening of Oct 19 in Chicago.
    expect(formatDate('2026-10-20T03:00:00Z', CHICAGO)).toBe('Oct 19, 2026');
    expect(formatDate('2026-10-20T03:00:00Z', 'UTC')).toBe('Oct 20, 2026');
  });
});

describe('dayKey', () => {
  it('names the calendar day in the time zone', () => {
    expect(dayKey('2026-10-20T03:00:00Z', CHICAGO)).toBe('2026-10-19');
    expect(dayKey('2026-10-20T03:00:00Z', 'UTC')).toBe('2026-10-20');
  });
});

describe('formatDayHeading', () => {
  const now = new Date('2026-06-01T12:00:00Z');

  it('leaves out the year for days this year', () => {
    expect(formatDayHeading('2026-10-24T14:00:00Z', CHICAGO, now)).toBe('Saturday, October 24');
  });

  it('includes the year for other years', () => {
    expect(formatDayHeading('2027-01-02T14:00:00Z', CHICAGO, now)).toBe(
      'Saturday, January 2, 2027',
    );
  });
});

describe('times', () => {
  it('formats a short date and a time of day', () => {
    expect(formatShortDate('2026-10-25T07:00:00Z', CHICAGO)).toBe('Sun, Oct 25');
    expect(formatTime('2026-10-24T14:00:00Z', CHICAGO)).toBe('9:00 AM');
  });

  it('formats a range, noting when it ends the next day', () => {
    expect(formatTimeRange('2026-10-24T14:00:00Z', '2026-10-24T17:30:00Z', CHICAGO)).toBe(
      '9:00 AM – 12:30 PM',
    );
    expect(formatTimeRange('2026-10-25T03:00:00Z', '2026-10-25T11:00:00Z', CHICAGO)).toBe(
      '10:00 PM – 6:00 AM (next day)',
    );
  });
});

describe('time zone names', () => {
  it('abbreviates the zone as it is at that moment', () => {
    expect(timeZoneAbbreviation('2026-10-24T14:00:00Z', CHICAGO)).toBe('CDT');
    expect(timeZoneAbbreviation('2026-12-05T15:00:00Z', CHICAGO)).toBe('CST');
  });

  it('gives the everyday name, without daylight-saving detail', () => {
    expect(timeZoneGenericName(CHICAGO, new Date('2026-10-24T14:00:00Z'))).toBe('Central Time');
    expect(timeZoneGenericName(CHICAGO, new Date('2026-12-05T15:00:00Z'))).toBe('Central Time');
  });
});
