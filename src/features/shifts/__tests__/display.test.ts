import { describe, expect, it } from 'vitest';
import { groupByDay, shiftStatus } from '@/features/shifts/display';
import {
  afternoonShift,
  cancelledShift,
  overnightShift,
  summaryOf,
  testShift,
} from '@/test/fixtures/shifts';

describe('shiftStatus', () => {
  const shift = {
    start_time: '2026-10-24T14:00:00Z',
    end_time: '2026-10-24T17:00:00Z',
    cancelled_at: null,
  };

  it('follows the clock: scheduled, in progress, ended', () => {
    expect(shiftStatus(shift, new Date('2026-10-24T13:59:00Z'))).toBe('scheduled');
    expect(shiftStatus(shift, new Date('2026-10-24T14:00:00Z'))).toBe('in-progress');
    expect(shiftStatus(shift, new Date('2026-10-24T17:00:00Z'))).toBe('ended');
  });

  it('reports cancelled shifts as cancelled, whatever the time', () => {
    const cancelled = { ...shift, cancelled_at: '2026-10-01T00:00:00Z' };
    expect(shiftStatus(cancelled, new Date('2026-10-24T15:00:00Z'))).toBe('cancelled');
  });
});

describe('groupByDay', () => {
  it('groups shifts by the day they start in the organization’s time zone', () => {
    const shifts = [testShift, afternoonShift, cancelledShift, overnightShift].map(summaryOf);

    // The overnight shift starts at 03:00 UTC on Oct 26, which is still Oct 25 in Chicago.
    expect(
      groupByDay(shifts, 'America/Chicago').map((day) => [
        day.key,
        day.shifts.map((shift) => shift.title),
      ]),
    ).toEqual([
      ['2099-10-24', ['Morning sorting', 'Afternoon packing']],
      ['2099-10-25', ['Food drive', 'Overnight shelter']],
    ]);
  });
});
