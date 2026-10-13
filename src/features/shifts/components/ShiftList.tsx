import { CalendarDays, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorFallback } from '@/components/common/ErrorFallback';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useShifts } from '@/features/shifts/api/useShiftQueries';
import { ShiftDayGroup } from '@/features/shifts/components/ShiftDayGroup';
import { groupByDay, shiftLinkId } from '@/features/shifts/display';
import type { ShiftWhen } from '@/features/shifts/types';

interface ShiftListProps {
  orgId: string;
  timeZone: string;
  when: ShiftWhen;
  /** Coordinators and owners are offered "New shift" when the list is empty. */
  canCreate: boolean;
}

const EMPTY_COPY = {
  upcoming: {
    title: 'No upcoming shifts',
    manager: 'Create a shift so volunteers can see when they’re needed.',
    volunteer: 'Your coordinators haven’t posted any shifts yet. Check back soon.',
  },
  past: {
    title: 'No past shifts yet',
    manager: 'Shifts move here once they end.',
    volunteer: 'Shifts move here once they end.',
  },
};

/** An organization's shifts grouped by day, loaded a page at a time. */
export function ShiftList({ orgId, timeZone, when, canCreate }: ShiftListProps) {
  const query = useShifts(orgId, when);
  // One "now" per visit, so statuses don't shift around while the list is open.
  const [now] = useState(() => new Date());
  const [announcement, setAnnouncement] = useState('');
  const [focusShiftId, setFocusShiftId] = useState<string | null>(null);

  // After "Load more", move focus to the first new shift, so keyboard and screen-reader users
  // continue where the list grew instead of starting over.
  useEffect(() => {
    if (focusShiftId) document.getElementById(shiftLinkId(focusShiftId))?.focus();
  }, [focusShiftId]);

  if (query.isPending) {
    return (
      <div role="status" className="space-y-3">
        <span className="sr-only">Loading shifts…</span>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  // Nothing loaded at all. (A failed "Load more" keeps the pages already shown; see below.)
  if (!query.data) {
    return (
      <ErrorFallback
        title="We couldn't load shifts"
        message="Check your connection and try again."
        reset={() => {
          void query.refetch();
        }}
      />
    );
  }

  const shifts = query.data.pages.flatMap((page) => page.shifts);

  if (shifts.length === 0) {
    const copy = EMPTY_COPY[when];
    return (
      <EmptyState
        icon={CalendarDays}
        title={copy.title}
        description={canCreate ? copy.manager : copy.volunteer}
        action={
          canCreate && when === 'upcoming' ? (
            <Button asChild>
              <Link to={`/orgs/${orgId}/shifts/new`}>
                <Plus aria-hidden="true" data-icon="inline-start" />
                New shift
              </Link>
            </Button>
          ) : undefined
        }
      />
    );
  }

  const loadMore = async () => {
    const shown = shifts.length;
    const result = await query.fetchNextPage();
    if (result.isError) {
      setAnnouncement('');
      return;
    }
    const all = result.data?.pages.flatMap((page) => page.shifts) ?? [];
    const added = all.length - shown;
    setAnnouncement(`Loaded ${String(added)} more ${added === 1 ? 'shift' : 'shifts'}.`);
    setFocusShiftId(all[shown]?.id ?? null);
  };

  return (
    <div className="space-y-6">
      {groupByDay(shifts, timeZone).map((day) => (
        <ShiftDayGroup key={day.key} day={day} orgId={orgId} timeZone={timeZone} now={now} />
      ))}
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {query.isFetchNextPageError && (
        <p role="alert" className="text-sm text-destructive">
          We couldn&apos;t load more shifts. Check your connection and try again.
        </p>
      )}
      {query.hasNextPage && (
        <Button
          type="button"
          variant="outline"
          disabled={query.isFetchingNextPage}
          onClick={() => {
            void loadMore();
          }}
        >
          {query.isFetchingNextPage ? 'Loading…' : 'Load more shifts'}
        </Button>
      )}
    </div>
  );
}
