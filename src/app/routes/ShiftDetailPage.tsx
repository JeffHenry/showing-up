import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { ErrorFallback } from '@/components/common/ErrorFallback';
import { PageHeader } from '@/components/common/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrg } from '@/context/useOrg';
import { useShift } from '@/features/shifts/api/useShiftQueries';
import { ShiftActions } from '@/features/shifts/components/ShiftActions';
import { ShiftDetails } from '@/features/shifts/components/ShiftDetails';
import { ShiftNotFound } from '@/features/shifts/components/ShiftNotFound';
import { ShiftStatusBadge } from '@/features/shifts/components/ShiftStatusBadge';
import { shiftStatus } from '@/features/shifts/display';
import { SHIFT_NOTICES, shiftNotice } from '@/features/shifts/navigationState';
import { SignupPanel } from '@/features/signups/components/SignupPanel';
import { APP_NAME } from '@/lib/constants';

/**
 * One shift: its details, its spots and the signed-in person's signup, and (for coordinators
 * and owners) ways to manage it. It combines two features (shifts and signups), so it lives at
 * the app level rather than inside either one.
 */
export function ShiftDetailPage() {
  const { org, role } = useOrg();
  const { shiftId = '' } = useParams();
  const location = useLocation();
  const { data: shift, isPending, isError, refetch } = useShift(shiftId);
  const [now] = useState(() => new Date());

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

  if (shift?.org_id !== org.id) return <ShiftNotFound orgId={org.id} />;

  const status = shiftStatus(shift, now);
  const notice = shiftNotice(location.state);

  return (
    <div className="max-w-3xl space-y-6">
      <title>{`${shift.title} · ${org.name} · ${APP_NAME}`}</title>
      <Link
        to={`/orgs/${org.id}/shifts`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground pointer-coarse:min-h-11"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        All shifts
      </Link>
      {notice && (
        <p role="status" className="text-sm font-medium">
          {SHIFT_NOTICES[notice]}
        </p>
      )}
      <PageHeader title={shift.title} />
      <ShiftStatusBadge status={status} />
      <ShiftDetails shift={shift} timeZone={org.timezone} now={now} />
      <SignupPanel orgId={org.id} shift={shift} />
      {/* UX only: row-level security and the shifts trigger decide what may change. */}
      {role !== 'volunteer' && <ShiftActions shift={shift} status={status} />}
    </div>
  );
}
