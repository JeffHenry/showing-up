import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createInvite, redeemInvite, revokeInvite } from '@/features/invites/api/invitesApi';
import { queryKeys } from '@/lib/queryKeys';

export function useCreateInvite(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createInvite,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.invites.pending(orgId) }),
  });
}

export function useRevokeInvite(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: revokeInvite,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.invites.pending(orgId) }),
  });
}

export function useRedeemInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: redeemInvite,
    // Wait for the organization list to include the new membership, so the organization's page
    // finds it on arrival instead of briefly reporting "not found".
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.orgs.all, refetchType: 'all' }),
  });
}
