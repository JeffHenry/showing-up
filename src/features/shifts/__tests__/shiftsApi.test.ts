import { describe, expect, it } from 'vitest';
import {
  afterCursorFilter,
  createShift,
  fetchShift,
  fetchShiftPage,
} from '@/features/shifts/api/shiftsApi';
import { testOrg } from '@/test/fixtures/orgs';
import { manyShifts, testShift } from '@/test/fixtures/shifts';
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

    const page = await fetchShiftPage({ orgId: testOrg.id, when: 'upcoming', cursor: null });

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
  });

  it('continues from a cursor, keeping its "now", and stops at the last page', async () => {
    const requests: URLSearchParams[] = [];
    server.use(shiftHandlers.list([], manyShifts(3, 21), (params) => requests.push(params)));

    const page = await fetchShiftPage({ orgId: testOrg.id, when: 'past', cursor });

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
    expect(await fetchShift(testShift.id)).toEqual(testShift);

    server.use(shiftHandlers.detail(null));
    expect(await fetchShift(testShift.id)).toBeNull();
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
