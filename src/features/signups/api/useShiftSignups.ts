import { useQuery } from '@tanstack/react-query';
import { fetchShiftSignups } from '@/features/signups/api/signupsApi';
import { queryKeys } from '@/lib/queryKeys';

export function useShiftSignups(shiftId: string) {
  return useQuery({
    queryKey: queryKeys.signups.forShift(shiftId),
    queryFn: () => fetchShiftSignups(shiftId),
    // People sign up and drop out all the time: re-check whenever the list is shown.
    staleTime: 0,
  });
}
