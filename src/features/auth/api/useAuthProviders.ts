import { useQuery } from '@tanstack/react-query';
import { fetchAuthProviders } from '@/features/auth/api/authApi';
import { queryKeys } from '@/lib/queryKeys';

/** Enabled sign-in providers; changes only when an environment is reconfigured. */
export function useAuthProviders() {
  return useQuery({
    queryKey: queryKeys.auth.providers(),
    queryFn: fetchAuthProviders,
    staleTime: 5 * 60_000,
  });
}
