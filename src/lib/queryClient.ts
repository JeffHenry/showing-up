import { QueryClient } from '@tanstack/react-query';

/**
 * Creates a QueryClient with the app-wide caching defaults.
 * A factory (not a singleton) so tests and the app never share a cache.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
        // Serve cached data while offline instead of pausing the query.
        networkMode: 'offlineFirst',
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
