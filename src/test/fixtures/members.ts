import type { OrgMember } from '@/features/members/types';
import { testUser } from '@/test/fixtures/auth';
import { testUserName } from '@/test/msw/profiles';

/** The signed-in test user, as the owner of the test organization. */
export const meAsOwner: OrgMember = {
  userId: testUser.id,
  fullName: testUserName,
  email: String(testUser.email),
  role: 'owner',
  joinedAt: '2026-10-01T15:00:00Z',
};

export const coordinatorMember: OrgMember = {
  userId: '00000000-0000-0000-0000-0000000000e1',
  fullName: 'Alex Kim',
  email: 'alex@example.test',
  role: 'coordinator',
  joinedAt: '2026-10-05T15:00:00Z',
};

/** Joined at 03:00 UTC on Oct 13: still Oct 12 in the test organization's time zone. */
export const volunteerMember: OrgMember = {
  userId: '00000000-0000-0000-0000-0000000000e2',
  fullName: 'Jordan Lee',
  email: 'jordan@example.test',
  role: 'volunteer',
  joinedAt: '2026-10-13T03:00:00Z',
};

export const unnamedMember: OrgMember = {
  userId: '00000000-0000-0000-0000-0000000000e3',
  fullName: null,
  email: 'quiet@example.test',
  role: 'volunteer',
  joinedAt: '2026-10-13T15:00:00Z',
};

export const testMembers = [meAsOwner, coordinatorMember, volunteerMember, unnamedMember];
