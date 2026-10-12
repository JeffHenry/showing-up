import { skipToken, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/useAuth';
import { fetchMyOrganizations } from '@/features/orgs/api/orgsApi';
import { queryKeys } from '@/lib/queryKeys';

/**
 * The signed-in user's organizations. One query backs the organization list, the switcher, and
 * the current organization (`OrgContext`), so they never disagree. The cache is cleared whenever
 * the signed-in user changes (see `AuthProvider`).
 */
export function useMyOrganizations() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: queryKeys.orgs.mine(),
    queryFn: userId ? () => fetchMyOrganizations(userId) : skipToken,
  });
}
