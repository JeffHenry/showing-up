import { skipToken, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/useAuth';
import { fetchMyProfile } from '@/features/account/api/profileApi';
import { queryKeys } from '@/lib/queryKeys';

export function useMyProfile() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: queryKeys.profile.mine(),
    queryFn: userId ? () => fetchMyProfile(userId) : skipToken,
  });
}
