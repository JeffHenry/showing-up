import { skipToken, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  fetchOverlappingShifts,
  fetchShift,
  fetchShiftPage,
} from '@/features/shifts/api/shiftsApi';
import { useAuth } from '@/context/useAuth';
import type { ShiftCursor, ShiftWhen } from '@/features/shifts/types';
import { queryKeys, type OverlapWindow } from '@/lib/queryKeys';

// The signed-in person isn't part of these keys: the whole cache is cleared when they change.

/**
 * Spot counts change whenever anyone signs up or drops out, so shift lists and pages are never
 * treated as fresh: opening one (or returning to the window) shows the cached copy at once and
 * re-checks it in the background, instead of trusting it for the app's default 30 seconds.
 */
const SPOTS_STALE_TIME = 0;

/** An organization's shifts, a page at a time (`fetchNextPage` loads the next). */
export function useShifts(orgId: string, when: ShiftWhen) {
  const userId = useAuth().user?.id ?? '';
  return useInfiniteQuery({
    queryKey: queryKeys.shifts.list(orgId, { when }),
    queryFn: ({ pageParam }) => fetchShiftPage({ orgId, userId, when, cursor: pageParam }),
    initialPageParam: null as ShiftCursor | null,
    getNextPageParam: (lastPage) => lastPage.next,
    staleTime: SPOTS_STALE_TIME,
  });
}

/** One shift; pass null to skip (e.g. a form that isn't copying a shift). */
export function useShift(shiftId: string | null) {
  const userId = useAuth().user?.id ?? '';
  return useQuery({
    queryKey: queryKeys.shifts.detail(shiftId ?? ''),
    queryFn: shiftId ? () => fetchShift(shiftId, userId) : skipToken,
    staleTime: SPOTS_STALE_TIME,
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
