import type { ShiftDetail, ShiftSummary } from '@/features/shifts/types';
import { testOrg } from '@/test/fixtures/orgs';

// Fixed dates far ahead, so headings and times don't depend on when the tests run. The test
// organization is in America/Chicago (CDT, UTC−5, in late October 2099).

/** Saturday, Oct 24, 9:00 AM – 12:00 PM, with a location and multi-line details. */
export const testShift: ShiftDetail = {
  id: '00000000-0000-0000-0000-0000000005a1',
  org_id: testOrg.id,
  title: 'Morning sorting',
  location: 'Main warehouse',
  start_time: '2099-10-24T14:00:00+00:00',
  end_time: '2099-10-24T17:00:00+00:00',
  capacity: 6,
  cancelled_at: null,
  cancel_reason: null,
  description: 'Wear closed-toe shoes.\nAsk for Sam at the front desk.',
  version: 1,
};

/** Saturday, Oct 24, 2:00 – 5:00 PM, one volunteer, no location. */
export const afternoonShift: ShiftDetail = {
  ...testShift,
  id: '00000000-0000-0000-0000-0000000005a2',
  title: 'Afternoon packing',
  location: null,
  start_time: '2099-10-24T19:00:00+00:00',
  end_time: '2099-10-24T22:00:00+00:00',
  capacity: 1,
  description: null,
};

/** Sunday, Oct 25, 10:00 AM – 1:00 PM, cancelled with a reason. */
export const cancelledShift: ShiftDetail = {
  ...testShift,
  id: '00000000-0000-0000-0000-0000000005a3',
  title: 'Food drive',
  start_time: '2099-10-25T15:00:00+00:00',
  end_time: '2099-10-25T18:00:00+00:00',
  cancelled_at: '2099-10-01T12:00:00+00:00',
  cancel_reason: 'Rain forecast',
  description: null,
  version: 2,
};

/** Sunday, Oct 25, 10:00 PM – Monday 6:00 AM. */
export const overnightShift: ShiftDetail = {
  ...testShift,
  id: '00000000-0000-0000-0000-0000000005a4',
  title: 'Overnight shelter',
  location: 'Shelter',
  start_time: '2099-10-26T03:00:00+00:00',
  end_time: '2099-10-26T11:00:00+00:00',
  capacity: 2,
  description: null,
};

/** A shift as a list returns it (list views select fewer columns). */
export function summaryOf(shift: ShiftDetail): ShiftSummary {
  return {
    id: shift.id,
    title: shift.title,
    location: shift.location,
    start_time: shift.start_time,
    end_time: shift.end_time,
    capacity: shift.capacity,
    cancelled_at: shift.cancelled_at,
  };
}

/**
 * `count` one-hour shifts, one per day from Nov 1, 2099, with predictable ids and titles
 * ("Shift 1", "Shift 2", …), for pagination tests.
 */
export function manyShifts(count: number, firstNumber = 1): ShiftSummary[] {
  return Array.from({ length: count }, (_, index) => {
    const number = firstNumber + index;
    const start = new Date(Date.UTC(2099, 10, number, 15));
    return {
      id: `00000000-0000-0000-0000-${String(number).padStart(12, '0')}`,
      title: `Shift ${String(number)}`,
      location: null,
      start_time: start.toISOString(),
      end_time: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
      capacity: 3,
      cancelled_at: null,
    };
  });
}
