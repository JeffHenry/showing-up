import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/useAuth';
import { updateMyName } from '@/features/account/api/profileApi';
import { queryKeys } from '@/lib/queryKeys';

export function useUpdateMyName() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => updateMyName({ userId: user?.id ?? '', name }),
    // The response is the saved profile, so update the cache directly (no refetch needed).
    onSuccess: (profile) => {
      queryClient.setQueryData(queryKeys.profile.mine(), profile);
    },
  });
}
