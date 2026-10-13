import { describe, expect, it } from 'vitest';
import { latestStart, overnightEnd, resolveShiftTimes } from '@/features/shifts/shiftTimes';

const CHICAGO = 'America/Chicago';
// A fixed "now", so every rule can be tested against known dates.
const NOW = new Date('2026-10-01T12:00:00Z');

function resolve(date: string, startTime: string, endTime: string) {
  return resolveShiftTimes({ date, startTime, endTime }, CHICAGO, NOW);
}

describe('resolveShiftTimes', () => {
  it('turns times in the organization’s zone into the moments the shift starts and ends', () => {
    expect(resolve('2026-10-24', '09:00', '12:30')).toEqual({
      ok: true,
      start: new Date('2026-10-24T14:00:00Z'),
      end: new Date('2026-10-24T17:30:00Z'),
      overnight: false,
    });
  });

  it('ends an overnight shift the next day', () => {
    expect(resolve('2026-10-24', '22:00', '06:00')).toEqual({
      ok: true,
      start: new Date('2026-10-25T03:00:00Z'),
      end: new Date('2026-10-25T11:00:00Z'),
      overnight: true,
    });
  });

  it('treats the same start and end time as a 24-hour shift', () => {
    const result = resolve('2026-10-24', '09:00', '09:00');
    expect(result.ok && result.end.getTime() - result.start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('refuses a 24-hour wall-clock shift that clocks falling back stretch to 25 hours', () => {
    // Clocks fall back early on Nov 1, 2026.
    expect(resolve('2026-10-31', '09:00', '09:00')).toEqual({
      ok: false,
      field: 'endTime',
      message: 'A shift can last at most 24 hours.',
    });
  });

  it('explains start and end times skipped when clocks spring forward', () => {
    expect(resolve('2027-03-14', '02:30', '05:00')).toMatchObject({
      ok: false,
      field: 'startTime',
    });
    expect(resolve('2027-03-13', '23:00', '02:30')).toMatchObject({
      ok: false,
      field: 'endTime',
      message: expect.stringContaining("doesn't exist") as unknown,
    });
  });

  it('requires a start in the future', () => {
    expect(resolve('2026-10-01', '06:00', '08:00')).toEqual({
      ok: false,
      field: 'date',
      message: 'Choose a date and start time in the future.',
    });
  });

  it('allows up to a year ahead, and no further', () => {
    expect(resolve('2027-09-30', '09:00', '10:00')).toMatchObject({ ok: true });
    expect(resolve('2027-10-02', '09:00', '10:00')).toEqual({
      ok: false,
      field: 'date',
      message: 'Shifts can be scheduled up to a year ahead.',
    });
  });
});

describe('latestStart', () => {
  it('is a year after now', () => {
    expect(latestStart(NOW).toISOString()).toBe('2027-10-01T12:00:00.000Z');
  });
});

describe('overnightEnd', () => {
  it('gives the next-day end of an overnight shift, and nothing otherwise', () => {
    expect(
      overnightEnd({ date: '2026-10-24', startTime: '22:00', endTime: '06:00' }, CHICAGO),
    ).toEqual(new Date('2026-10-25T11:00:00Z'));
    expect(
      overnightEnd({ date: '2026-10-24', startTime: '09:00', endTime: '17:00' }, CHICAGO),
    ).toBeNull();
    expect(overnightEnd({ date: '', startTime: '22:00', endTime: '06:00' }, CHICAGO)).toBeNull();
    expect(
      overnightEnd({ date: '2026-10-24', startTime: '', endTime: '06:00' }, CHICAGO),
    ).toBeNull();
  });
});
