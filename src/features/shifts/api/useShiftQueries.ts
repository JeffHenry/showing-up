import { skipToken, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  fetchOverlappingShifts,
  fetchShift,
  fetchShiftPage,
} from '@/features/shifts/api/shiftsApi';
import type { ShiftCursor, ShiftWhen } from '@/features/shifts/types';
import { queryKeys, type OverlapWindow } from '@/lib/queryKeys';

/** An organization's shifts, a page at a time (`fetchNextPage` loads the next). */
export function useShifts(orgId: string, when: ShiftWhen) {
  return useInfiniteQuery({
    queryKey: queryKeys.shifts.list(orgId, { when }),
    queryFn: ({ pageParam }) => fetchShiftPage({ orgId, when, cursor: pageParam }),
    initialPageParam: null as ShiftCursor | null,
    getNextPageParam: (lastPage) => lastPage.next,
  });
}

/** One shift; pass null to skip (e.g. a form that isn't copying a shift). */
export function useShift(shiftId: string | null) {
  return useQuery({
    queryKey: queryKeys.shifts.detail(shiftId ?? ''),
    queryFn: shiftId ? () => fetchShift(shiftId) : skipToken,
  });
}

/** Shifts overlapping a time being entered; null while the form's time isn't complete. */
export function useOverlappingShifts(orgId: string, window: OverlapWindow | null) {
  return useQuery({
    queryKey: queryKeys.shifts.overlaps(orgId, window ?? EMPTY_WINDOW),
    queryFn: window ? () => fetchOverlappingShifts(orgId, window) : skipToken,
    // Keep showing the last answer while the next one loads, so the warning doesn't flicker.
    placeholderData: (previous) => previous,
  });
}

const EMPTY_WINDOW: OverlapWindow = {
  start: '',
  end: '',
  location: null,
  title: '',
  excludeShiftId: null,
};
