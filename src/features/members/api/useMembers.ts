import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/useAuth';
import {
  changeMemberRole,
  fetchOrgMembers,
  removeMembership,
} from '@/features/members/api/membersApi';
import { queryKeys } from '@/lib/queryKeys';

export function useOrgMembers(orgId: string) {
  return useQuery({
    queryKey: queryKeys.members.list(orgId),
    queryFn: () => fetchOrgMembers(orgId),
  });
}

/**
 * Refreshes the roster after a change. If the change was to the signed-in user (stepping down),
 * also refresh their organizations, so OrgContext and role-gated pages see the new role.
 */
function useRefreshAfterChange(orgId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return async (changedUserId: string) => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.members.list(orgId) });
    if (changedUserId === user?.id) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.orgs.all, refetchType: 'all' });
    }
  };
}

export function useChangeMemberRole(orgId: string) {
  const refresh = useRefreshAfterChange(orgId);
  return useMutation({
    mutationFn: changeMemberRole,
    onSuccess: (_data, { userId }) => refresh(userId),
  });
}

export function useRemoveMember(orgId: string) {
  const refresh = useRefreshAfterChange(orgId);
  return useMutation({
    mutationFn: removeMembership,
    onSuccess: (_data, { userId }) => refresh(userId),
  });
}
