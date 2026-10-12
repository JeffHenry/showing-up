/**
 * Query key factory: every TanStack Query key in the app comes from here, so invalidation and
 * cache reads can't drift from the keys used to fetch.
 */
export const queryKeys = {
  auth: {
    providers: () => ['auth', 'providers'] as const,
  },
};
