import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createOrganization } from '@/features/orgs/api/orgsApi';
import { queryKeys } from '@/lib/queryKeys';

export function useCreateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createOrganization,
    // Wait for the refetch (including the cached list no page is showing), so the new
    // organization's page finds it on arrival instead of briefly reporting "not found".
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.orgs.all, refetchType: 'all' }),
  });
}
