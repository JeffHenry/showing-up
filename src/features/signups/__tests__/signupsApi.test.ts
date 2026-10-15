import { describe, expect, it } from 'vitest';
import { cancelSignup, claimShift } from '@/features/signups/api/signupsApi';
import { toAppError } from '@/lib/errors';
import { testShift } from '@/test/fixtures/shifts';
import { server } from '@/test/msw/server';
import { signupHandlers } from '@/test/msw/signups';

const otherUserId = '00000000-0000-0000-0000-0000000000d3';

describe('claimShift', () => {
  it('asks the database to claim the shift', async () => {
    let body: unknown;
    server.use(signupHandlers.claimOk((sent) => (body = sent)));

    await claimShift(testShift.id);

    expect(body).toEqual({ p_shift_id: testShift.id });
  });

  it('passes on the database’s refusal', async () => {
    server.use(signupHandlers.claimFails('SHIFT_FULL'));

    const error: unknown = await claimShift(testShift.id).catch((caught: unknown) => caught);
    expect(toAppError(error).code).toBe('SHIFT_FULL');
  });
});

describe('cancelSignup', () => {
  it('drops your own signup, or (for coordinators) someone else’s', async () => {
    const bodies: unknown[] = [];
    server.use(signupHandlers.cancelOk((sent) => bodies.push(sent)));

    await cancelSignup({ shiftId: testShift.id });
    await cancelSignup({ shiftId: testShift.id, userId: otherUserId });

    expect(bodies).toEqual([
      { p_shift_id: testShift.id },
      { p_shift_id: testShift.id, p_user_id: otherUserId },
    ]);
  });

  it('passes on the database’s refusal', async () => {
    server.use(signupHandlers.cancelFails('SHIFT_STARTED'));

    const error: unknown = await cancelSignup({ shiftId: testShift.id }).catch(
      (caught: unknown) => caught,
    );
    expect(toAppError(error).code).toBe('SHIFT_STARTED');
  });
});
