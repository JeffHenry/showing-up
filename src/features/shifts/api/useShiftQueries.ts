import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { fetchShift, fetchShiftPage } from '@/features/shifts/api/shiftsApi';
import type { ShiftCursor, ShiftWhen } from '@/features/shifts/types';
import { queryKeys } from '@/lib/queryKeys';

/** An organization's shifts, a page at a time (`fetchNextPage` loads the next). */
export function useShifts(orgId: string, when: ShiftWhen) {
  return useInfiniteQuery({
    queryKey: queryKeys.shifts.list(orgId, { when }),
    queryFn: ({ pageParam }) => fetchShiftPage({ orgId, when, cursor: pageParam }),
    initialPageParam: null as ShiftCursor | null,
    getNextPageParam: (lastPage) => lastPage.next,
  });
}

export function useShift(shiftId: string) {
  return useQuery({
    queryKey: queryKeys.shifts.detail(shiftId),
    queryFn: () => fetchShift(shiftId),
  });
}
