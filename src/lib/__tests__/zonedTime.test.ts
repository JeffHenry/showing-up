import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextDay, wallTimeAt, zonedInstant } from '@/lib/zonedTime';

const CHICAGO = 'America/Chicago';

describe('zonedInstant', () => {
  it('finds the moment clocks in the zone show a date and time', () => {
    // Late October: Chicago is on CDT (UTC−5).
    expect(zonedInstant({ date: '2026-10-24', time: '09:00' }, CHICAGO)?.toISOString()).toBe(
      '2026-10-24T14:00:00.000Z',
    );
    // December: CST (UTC−6).
    expect(zonedInstant({ date: '2026-12-05', time: '09:00' }, CHICAGO)?.toISOString()).toBe(
      '2026-12-05T15:00:00.000Z',
    );
    expect(zonedInstant({ date: '2026-10-24', time: '09:00' }, 'UTC')?.toISOString()).toBe(
      '2026-10-24T09:00:00.000Z',
    );
  });

  describe('whatever the device’s own time zone', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('gives the same moment', () => {
      // Node applies a changed TZ immediately.
      vi.stubEnv('TZ', 'Asia/Tokyo');
      expect(new Date('2026-10-24T00:00:00Z').getHours()).toBe(9);
      expect(zonedInstant({ date: '2026-10-24', time: '09:00' }, CHICAGO)?.toISOString()).toBe(
        '2026-10-24T14:00:00.000Z',
      );
    });
  });

  it('returns null for the hour skipped when clocks spring forward', () => {
    // Mar 14, 2027: Chicago's clocks jump from 2:00 to 3:00 AM.
    expect(zonedInstant({ date: '2027-03-14', time: '02:30' }, CHICAGO)).toBeNull();
    expect(zonedInstant({ date: '2027-03-14', time: '03:30' }, CHICAGO)?.toISOString()).toBe(
      '2027-03-14T08:30:00.000Z',
    );
  });

  it('picks one of the two moments in the hour repeated when clocks fall back', () => {
    // Nov 1, 2026: 1:30 AM happens first in CDT (06:30Z), then again in CST (07:30Z).
    const instant = zonedInstant({ date: '2026-11-01', time: '01:30' }, CHICAGO)?.toISOString();
    expect(['2026-11-01T06:30:00.000Z', '2026-11-01T07:30:00.000Z']).toContain(instant);
  });

  it('returns null for dates that do not exist and malformed values', () => {
    expect(zonedInstant({ date: '2026-02-30', time: '09:00' }, CHICAGO)).toBeNull();
    expect(zonedInstant({ date: '', time: '09:00' }, CHICAGO)).toBeNull();
    expect(zonedInstant({ date: '2026-10-24', time: '9am' }, CHICAGO)).toBeNull();
  });
});

describe('wallTimeAt', () => {
  it('shows what clocks in the zone read at a moment', () => {
    // 03:00 UTC on Oct 20 is still 10 PM on Oct 19 in Chicago.
    expect(wallTimeAt('2026-10-20T03:00:00Z', CHICAGO)).toEqual({
      date: '2026-10-19',
      time: '22:00',
    });
    expect(wallTimeAt(new Date('2026-10-20T03:05:00Z'), 'UTC')).toEqual({
      date: '2026-10-20',
      time: '03:05',
    });
  });

  it('round-trips with zonedInstant', () => {
    const wall = { date: '2026-07-04', time: '18:45' };
    const instant = zonedInstant(wall, CHICAGO);
    expect(instant && wallTimeAt(instant, CHICAGO)).toEqual(wall);
  });
});

describe('nextDay', () => {
  it('moves to the following calendar day, across months, years, and leap days', () => {
    expect(nextDay('2026-10-24')).toBe('2026-10-25');
    expect(nextDay('2026-10-31')).toBe('2026-11-01');
    expect(nextDay('2026-12-31')).toBe('2027-01-01');
    expect(nextDay('2028-02-28')).toBe('2028-02-29');
  });
});
