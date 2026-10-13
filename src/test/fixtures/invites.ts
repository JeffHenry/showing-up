import type { PendingInvite } from '@/features/invites/types';

/** A URL-safe token like the ones `create_invite` returns (43 characters). */
export const testInviteToken = 'q7Xv0d4N-JmR2kP9sLw3_Tz8bYcA1eGhUiOoVnWfE5r';

/** 03:00 UTC on Oct 20 is still Oct 19 in the test organization's time zone (America/Chicago). */
export const testInvite: PendingInvite = {
  id: '00000000-0000-0000-0000-0000000000c1',
  role: 'volunteer',
  expires_at: '2026-10-20T03:00:00Z',
  created_at: '2026-10-13T03:00:00Z',
};

export const testCoordinatorInvite: PendingInvite = {
  id: '00000000-0000-0000-0000-0000000000c2',
  role: 'coordinator',
  expires_at: '2026-10-21T15:00:00Z',
  created_at: '2026-10-14T15:00:00Z',
};
