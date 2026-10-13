import { ArrowLeft, Ban, SearchX } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorFallback } from '@/components/common/ErrorFallback';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrg } from '@/context/useOrg';
import { useShift } from '@/features/shifts/api/useShiftQueries';
import { ShiftStatusBadge } from '@/features/shifts/components/ShiftStatusBadge';
import { shiftStatus, volunteersNeeded } from '@/features/shifts/display';
import { isShiftCreated } from '@/features/shifts/navigationState';
import { APP_NAME } from '@/lib/constants';
import { formatDayHeading, formatTimeRange, timeZoneAbbreviation } from '@/lib/dates';

/** One shift: when and where it is, how many volunteers it needs, and any details. */
export function ShiftDetailPage() {
  const { org } = useOrg();
  const { shiftId = '' } = useParams();
  const location = useLocation();
  const { data: shift, isPending, isError, refetch } = useShift(shiftId);
  const [now] = useState(() => new Date());
  const listPath = `/orgs/${org.id}/shifts`;

  const backLink = (
    <Link
      to={listPath}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground pointer-coarse:min-h-11"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      All shifts
    </Link>
  );

  if (isPending) {
    return (
      <div role="status" className="space-y-4">
        <span className="sr-only">Loading shift…</span>
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorFallback
        title="We couldn't load this shift"
        message="Check your connection and try again."
        reset={() => {
          void refetch();
        }}
      />
    );
  }

  // The same answer for a deleted shift and another organization's, so it reveals nothing.
  if (shift?.org_id !== org.id) {
    return (
      <div className="space-y-6">
        <title>{`Shift not found · ${APP_NAME}`}</title>
        <PageHeader title="Shift not found" />
        <EmptyState
          icon={SearchX}
          title="We couldn't find that shift"
          description="It may have been deleted, or the link may be wrong."
          action={
            <Button asChild>
              <Link to={listPath}>All shifts</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const when = `${formatDayHeading(shift.start_time, org.timezone, now)}, ${formatTimeRange(
    shift.start_time,
    shift.end_time,
    org.timezone,
  )} ${timeZoneAbbreviation(shift.start_time, org.timezone)}`;

  return (
    <div className="max-w-3xl space-y-6">
      <title>{`${shift.title} · ${org.name} · ${APP_NAME}`}</title>
      {backLink}
      {isShiftCreated(location.state) && (
        <p role="status" className="text-sm font-medium">
          Shift created.
        </p>
      )}
      <PageHeader title={shift.title} />
      <ShiftStatusBadge status={shiftStatus(shift, now)} />
      {shift.cancelled_at && (
        <div className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="flex items-center gap-2 font-medium">
            <Ban aria-hidden="true" className="size-4 text-destructive" />
            This shift was cancelled.
          </p>
          {shift.cancel_reason && (
            <p className="text-sm whitespace-pre-line text-muted-foreground">
              {shift.cancel_reason}
            </p>
          )}
        </div>
      )}
      <dl className="grid gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-[auto_1fr]">
        <dt className="text-sm text-muted-foreground">When</dt>
        <dd>{when}</dd>
        <dt className="text-sm text-muted-foreground">Where</dt>
        <dd>{shift.location ?? 'No location given'}</dd>
        <dt className="text-sm text-muted-foreground">Volunteers</dt>
        <dd>{volunteersNeeded(shift.capacity)}</dd>
      </dl>
      {shift.description && (
        <section aria-labelledby="shift-details-heading" className="space-y-2">
          <h2 id="shift-details-heading" className="text-lg font-medium">
            Details
          </h2>
          {/* Plain text with the line breaks the coordinator typed; never parsed as HTML. */}
          <p className="whitespace-pre-line">{shift.description}</p>
        </section>
      )}
    </div>
  );
}
