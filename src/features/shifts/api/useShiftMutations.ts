import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createShift } from '@/features/shifts/api/shiftsApi';
import type { ShiftInput } from '@/features/shifts/types';
import { queryKeys } from '@/lib/queryKeys';

export function useCreateShift(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ShiftInput) => createShift({ orgId, input }),
    // The new shift's page loads it fresh; lists pick it up the next time they're shown.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shifts.lists(orgId) }),
  });
}
