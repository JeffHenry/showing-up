import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cancelSignup, claimShift } from '@/features/signups/api/signupsApi';
import type { SignupFields } from '@/features/signups/types';
import { queryKeys } from '@/lib/queryKeys';

/**
 * A signup change shown on the shift's page before the server answers (optimistic update):
 * the cached shift is updated at once, put back if the server refuses, and refreshed either way.
 */
function useOptimisticSignup(
  orgId: string,
  shiftId: string,
  request: () => Promise<void>,
  change: (shift: SignupFields) => SignupFields,
) {
  const queryClient = useQueryClient();
  const detailKey = queryKeys.shifts.detail(shiftId);

  return useMutation({
    mutationFn: request,
    onMutate: async () => {
      // Stop a refetch in flight from overwriting the optimistic change.
      await queryClient.cancelQueries({ queryKey: detailKey });
      const previous = queryClient.getQueryData<SignupFields | null>(detailKey);
      if (previous) {
        queryClient.setQueryData<SignupFields>(detailKey, { ...previous, ...change(previous) });
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(detailKey, context.previous);
    },
    // The server's count wins (others may have signed up meanwhile); lists catch up too.
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: detailKey }),
        queryClient.invalidateQueries({ queryKey: queryKeys.shifts.forOrg(orgId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.signups.forShift(shiftId) }),
      ]),
  });
}

export function useClaimShift(orgId: string, shiftId: string) {
  return useOptimisticSignup(
    orgId,
    shiftId,
    () => claimShift(shiftId),
    (shift) => ({ signed_up: true, confirmed_count: shift.confirmed_count + 1 }),
  );
}

export function useDropOut(orgId: string, shiftId: string) {
  return useOptimisticSignup(
    orgId,
    shiftId,
    () => cancelSignup({ shiftId }),
    (shift) => ({ signed_up: false, confirmed_count: Math.max(shift.confirmed_count - 1, 0) }),
  );
}

/**
 * A coordinator removing someone from a shift. Not optimistic: it's confirmed in a dialog,
 * which shows progress and any refusal.
 */
export function useRemoveSignup(orgId: string, shiftId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => cancelSignup({ shiftId, userId }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.signups.forShift(shiftId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.shifts.detail(shiftId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.shifts.forOrg(orgId) }),
      ]),
  });
}
