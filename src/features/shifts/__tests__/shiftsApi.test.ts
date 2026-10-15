import { describe, expect, it } from 'vitest';
import {
  afterCursorFilter,
  cancelShift,
  createShift,
  deleteShift,
  fetchOverlappingShifts,
  fetchShift,
  fetchShiftPage,
  updateShift,
} from '@/features/shifts/api/shiftsApi';
import type { ShiftInput } from '@/features/shifts/types';
import { toAppError } from '@/lib/errors';
import { testUser } from '@/test/fixtures/auth';
import { testOrg } from '@/test/fixtures/orgs';
import { manyShifts, summaryOf, testShift } from '@/test/fixtures/shifts';
import type { ShiftUpdateRequest } from '@/test/msw/shifts';
import { server } from '@/test/msw/server';
import { shiftHandlers } from '@/test/msw/shifts';

const cursor = {
  startTime: '2099-11-20T15:00:00.000Z',
  id: '00000000-0000-0000-0000-000000000020',
  asOf: '2026-10-13T12:00:00.000Z',
};

describe('afterCursorFilter', () => {
  it('continues after the last shift in (start_time, id) order, quoting the timestamp', () => {
    expect(afterCursorFilter(cursor, 'upcoming')).toBe(
      'start_time.gt."2099-11-20T15:00:00.000Z",and(start_time.eq."2099-11-20T15:00:00.000Z",id.gt.00000000-0000-0000-0000-000000000020)',
    );
  });

  it('runs backwards for past shifts (newest first)', () => {
    expect(afterCursorFilter(cursor, 'past')).toBe(
      'start_time.lt."2099-11-20T15:00:00.000Z",and(start_time.eq."2099-11-20T15:00:00.000Z",id.lt.00000000-0000-0000-0000-000000000020)',
    );
  });
});

describe('fetchShiftPage', () => {
  it('asks for one more upcoming shift than a page, to know whether more exist', async () => {
    const requests: URLSearchParams[] = [];
    server.use(shiftHandlers.list(manyShifts(21), [], (params) => requests.push(params)));

    const page = await fetchShiftPage({
      orgId: testOrg.id,
      userId: testUser.id,
      when: 'upcoming',
      cursor: null,
    });

    expect(page.shifts).toHaveLength(20);
    expect(page.next).toEqual({
      startTime: page.shifts[19]?.start_time,
      id: page.shifts[19]?.id,
      asOf: expect.any(String) as unknown,
    });
    const [params] = requests;
    expect(params?.get('org_id')).toBe(`eq.${testOrg.id}`);
    // Upcoming includes shifts in progress: anything that hasn't ended.
    expect(params?.get('end_time')).toBe(`gt.${String(page.next?.asOf)}`);
    expect(params?.get('order')).toBe('start_time.asc,id.asc');
    expect(params?.get('limit')).toBe('21');
    expect(params?.has('or')).toBe(false);
    expect(params?.get('select')).not.toContain('description');
    // Only the signed-in person's own confirmed signup is embedded, as a yes/no.
    expect(params?.get('my_signup.user_id')).toBe(`eq.${testUser.id}`);
    expect(params?.get('my_signup.status')).toBe('eq.confirmed');
    expect(page.shifts[0]).toMatchObject({ confirmed_count: 0, signed_up: false });
    expect(page.shifts[0]).not.toHaveProperty('my_signup');
  });

  it('continues from a cursor, keeping its "now", and stops at the last page', async () => {
    const requests: URLSearchParams[] = [];
    server.use(shiftHandlers.list([], manyShifts(3, 21), (params) => requests.push(params)));

    const page = await fetchShiftPage({
      orgId: testOrg.id,
      userId: testUser.id,
      when: 'past',
      cursor,
    });

    expect(page.shifts).toHaveLength(3);
    expect(page.next).toBeNull();
    const [params] = requests;
    expect(params?.get('end_time')).toBe(`lte.${cursor.asOf}`);
    expect(params?.get('order')).toBe('start_time.desc,id.desc');
    expect(params?.get('or')).toBe(`(${afterCursorFilter(cursor, 'past')})`);
  });
});

describe('fetchShift', () => {
  it('returns the shift, or null when it is missing or hidden', async () => {
    server.use(shiftHandlers.detail(testShift));
    expect(await fetchShift(testShift.id, testUser.id)).toEqual(testShift);

    server.use(shiftHandlers.detail(null));
    expect(await fetchShift(testShift.id, testUser.id)).toBeNull();
  });
});

describe('createShift', () => {
  it('inserts the shift in the organization and returns its id', async () => {
    let body: unknown;
    server.use(shiftHandlers.createOk(testShift.id, (sent) => (body = sent)));

    const id = await createShift({
      orgId: testOrg.id,
      input: {
        title: 'Morning sorting',
        location: null,
        description: null,
        startTime: testShift.start_time,
        endTime: testShift.end_time,
        capacity: 6,
      },
    });

    expect(id).toBe(testShift.id);
    expect(body).toEqual({
      org_id: testOrg.id,
      title: 'Morning sorting',
      location: null,
      description: null,
      start_time: testShift.start_time,
      end_time: testShift.end_time,
      capacity: 6,
    });
  });
});

const input: ShiftInput = {
  title: 'Morning sorting',
  location: 'Main warehouse',
  description: null,
  startTime: testShift.start_time,
  endTime: testShift.end_time,
  capacity: 8,
};

/** The app error a rejected call produced. */
async function codeOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return toAppError(error).code;
  }
  throw new Error('Expected the call to fail');
}

describe('updateShift', () => {
  it('saves only if the shift is still at the version the editor loaded', async () => {
    let sent: ShiftUpdateRequest | undefined;
    server.use(shiftHandlers.updateOk((request) => (sent = request)));

    await updateShift({ shiftId: testShift.id, userId: testUser.id, version: 3, input });

    expect(sent).toEqual({
      id: testShift.id,
      version: '3',
      body: {
        title: 'Morning sorting',
        location: 'Main warehouse',
        description: null,
        start_time: testShift.start_time,
        end_time: testShift.end_time,
        capacity: 8,
      },
    });
  });

  it('explains why nothing was saved', async () => {
    server.use(shiftHandlers.updateNoRows(), shiftHandlers.detail({ ...testShift, version: 2 }));
    expect(
      await codeOf(updateShift({ shiftId: testShift.id, userId: testUser.id, version: 1, input })),
    ).toBe('SHIFT_CHANGED');

    server.use(shiftHandlers.detail(null));
    expect(
      await codeOf(updateShift({ shiftId: testShift.id, userId: testUser.id, version: 1, input })),
    ).toBe('SHIFT_NOT_FOUND');

    // Unchanged and still there, yet not saved: row-level security refused.
    server.use(shiftHandlers.detail(testShift));
    expect(
      await codeOf(updateShift({ shiftId: testShift.id, userId: testUser.id, version: 1, input })),
    ).toBe('NOT_AUTHORIZED');
  });

  it('passes on the database’s own refusals', async () => {
    server.use(shiftHandlers.updateFails('SHIFT_STARTED'));
    expect(
      await codeOf(updateShift({ shiftId: testShift.id, userId: testUser.id, version: 1, input })),
    ).toBe('SHIFT_STARTED');
  });
});

describe('cancelShift', () => {
  it('sends a trimmed reason, and leaves a blank one out', async () => {
    const bodies: unknown[] = [];
    server.use(shiftHandlers.cancelOk((body) => bodies.push(body)));

    await cancelShift({ shiftId: testShift.id, reason: '  Rain forecast ' });
    await cancelShift({ shiftId: testShift.id, reason: '   ' });

    expect(bodies).toEqual([
      { p_shift_id: testShift.id, p_reason: 'Rain forecast' },
      { p_shift_id: testShift.id },
    ]);
  });
});

describe('deleteShift', () => {
  it('deletes by id, and reports a refusal that removed nothing', async () => {
    let targeted: string | null = null;
    server.use(shiftHandlers.deleteOk((id) => (targeted = id)));
    await deleteShift(testShift.id);
    expect(targeted).toBe(testShift.id);

    server.use(shiftHandlers.deleteNoRows());
    expect(await codeOf(deleteShift(testShift.id))).toBe('NOT_AUTHORIZED');
  });
});

describe('fetchOverlappingShifts', () => {
  const window = {
    start: '2099-10-24T14:00:00.000Z',
    end: '2099-10-24T17:00:00.000Z',
    location: 'Room 100%',
    title: 'Morning sorting',
    excludeShiftId: null,
  };

  it('finds active shifts overlapping the time at the same location', async () => {
    const requests: URLSearchParams[] = [];
    server.use(shiftHandlers.overlaps([summaryOf(testShift)], (params) => requests.push(params)));

    expect(await fetchOverlappingShifts(testOrg.id, window)).toEqual([summaryOf(testShift)]);

    const [params] = requests;
    expect(params?.get('org_id')).toBe(`eq.${testOrg.id}`);
    expect(params?.get('cancelled_at')).toBe('is.null');
    // Overlapping means starting before this one ends and ending after it starts.
    expect(params?.get('start_time')).toBe(`lt.${window.end}`);
    expect(params?.get('end_time')).toBe(`gt.${window.start}`);
    // Case-insensitive, with LIKE wildcards matched literally.
    expect(params?.get('location')).toBe(String.raw`ilike.Room 100\%`);
    expect(params?.has('title')).toBe(false);
    expect(params?.has('id')).toBe(false);
    expect(params?.get('limit')).toBe('3');
  });

  it('compares titles when there is no location, and skips the shift being edited', async () => {
    const requests: URLSearchParams[] = [];
    server.use(shiftHandlers.overlaps([], (params) => requests.push(params)));

    await fetchOverlappingShifts(testOrg.id, {
      ...window,
      location: null,
      excludeShiftId: testShift.id,
    });

    const [params] = requests;
    expect(params?.get('title')).toBe('ilike.Morning sorting');
    expect(params?.has('location')).toBe(false);
    expect(params?.get('id')).toBe(`neq.${testShift.id}`);
  });
});
