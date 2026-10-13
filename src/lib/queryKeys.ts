/** What an overlap check compares against (see `fetchOverlappingShifts`). */
export interface OverlapWindow {
  start: string;
  end: string;
  location: string | null;
  title: string;
  excludeShiftId: string | null;
}

/**
 * Query key factory: every TanStack Query key in the app comes from here, so invalidation and
 * cache reads can't drift from the keys used to fetch.
 */
export const queryKeys = {
  auth: {
    providers: () => ['auth', 'providers'] as const,
  },
  profile: {
    /** The signed-in person's own profile (their display name). */
    mine: () => ['profile', 'mine'] as const,
  },
  orgs: {
    /** Prefix for every organization query; invalidate this after creating or changing one. */
    all: ['orgs'] as const,
    /** The signed-in user's organizations and their role in each. */
    mine: () => ['orgs', 'mine'] as const,
  },
  members: {
    all: ['members'] as const,
    /** An organization's roster (coordinators and owners only). */
    list: (orgId: string) => ['members', orgId] as const,
  },
  invites: {
    all: ['invites'] as const,
    /** An organization's unused, unexpired invites (coordinators and owners only). */
    pending: (orgId: string) => ['invites', orgId, 'pending'] as const,
    /** What an invite link leads to, for the person who opened it. */
    preview: (token: string) => ['invites', 'preview', token] as const,
    /** Invites used in the last 30 days, with who used and sent them. */
    accepted: (orgId: string) => ['invites', orgId, 'accepted'] as const,
  },
  shifts: {
    all: ['shifts'] as const,
    /** Prefix for an organization's lists and overlap checks; invalidate it after any change. */
    forOrg: (orgId: string) => ['shifts', orgId] as const,
    /** One page-by-page list: upcoming (including in progress) or past shifts. */
    list: (orgId: string, filters: { when: 'upcoming' | 'past' }) =>
      ['shifts', orgId, 'list', filters] as const,
    detail: (shiftId: string) => ['shifts', 'detail', shiftId] as const,
    /** Shifts that overlap a time, at the same location (or with the same title, without one). */
    overlaps: (orgId: string, window: OverlapWindow) =>
      ['shifts', orgId, 'overlaps', window] as const,
  },
};
