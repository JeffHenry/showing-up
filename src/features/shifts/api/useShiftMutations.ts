import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  cancelShift,
  createShift,
  deleteShift,
  updateShift,
} from '@/features/shifts/api/shiftsApi';
import { useAuth } from '@/context/useAuth';
import type { ShiftInput } from '@/features/shifts/types';
import { queryKeys } from '@/lib/queryKeys';

/** Lists and overlap checks pick up a change the next time they're shown. */
function useRefreshLists(orgId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.shifts.forOrg(orgId) });
}

/** Refreshes the shift's own page (awaited, so it shows the change on arrival) and the lists. */
function useRefreshShift(orgId: string, shiftId: string) {
  const queryClient = useQueryClient();
  const refreshLists = useRefreshLists(orgId);
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.shifts.detail(shiftId) }),
      refreshLists(),
    ]);
}

export function useCreateShift(orgId: string) {
  const refreshLists = useRefreshLists(orgId);
  return useMutation({
    mutationFn: (input: ShiftInput) => createShift({ orgId, input }),
    onSuccess: refreshLists,
  });
}

export function useUpdateShift(orgId: string, shiftId: string) {
  const refresh = useRefreshShift(orgId, shiftId);
  const userId = useAuth().user?.id ?? '';
  return useMutation({
    mutationFn: ({ version, input }: { version: number; input: ShiftInput }) =>
      updateShift({ shiftId, userId, version, input }),
    onSuccess: refresh,
  });
}

export function useCancelShift(orgId: string, shiftId: string) {
  const refresh = useRefreshShift(orgId, shiftId);
  return useMutation({
    mutationFn: (reason: string) => cancelShift({ shiftId, reason }),
    onSuccess: refresh,
  });
}

/**
 * Deleting refreshes only the lists: the page showing the deleted shift navigates away first,
 * rather than refetching it and briefly reporting "not found".
 */
export function useDeleteShift(orgId: string, shiftId: string) {
  const refreshLists = useRefreshLists(orgId);
  return useMutation({
    mutationFn: () => deleteShift(shiftId),
    onSuccess: refreshLists,
  });
}
