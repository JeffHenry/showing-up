import { Lock } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ErrorFallback } from '@/components/common/ErrorFallback';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrg } from '@/context/useOrg';
import { useShift } from '@/features/shifts/api/useShiftQueries';
import { EditShiftForm } from '@/features/shifts/components/EditShiftForm';
import { ShiftNotFound } from '@/features/shifts/components/ShiftNotFound';
import { shiftStatus } from '@/features/shifts/display';
import { APP_NAME } from '@/lib/constants';

export function EditShiftPage() {
  const { org } = useOrg();
  const { shiftId = '' } = useParams();
  const { data: shift, isPending, isError, refetch } = useShift(shiftId);
  const [now] = useState(() => new Date());
  // Bumped by "Load the latest version" to start a fresh form from the reloaded shift.
  const [reloads, setReloads] = useState(0);

  if (isPending) {
    return (
      <div role="status" className="space-y-4">
        <span className="sr-only">Loading shift…</span>
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-64 w-full" />
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

  const shiftPath = `/orgs/${org.id}/shifts/${shift.id}`;
  const status = shiftStatus(shift, now);

  return (
    <div className="max-w-xl space-y-6">
      <title>{`Edit ${shift.title} · ${org.name} · ${APP_NAME}`}</title>
      <PageHeader title="Edit shift" description={shift.title} />
      {reloads > 0 && (
        <p role="status" className="text-sm font-medium">
          Loaded the latest version.
        </p>
      )}
      {status === 'scheduled' ? (
        <EditShiftForm
          key={reloads}
          shift={shift}
          reloaded={reloads > 0}
          onLoadLatest={() => {
            void refetch().then(() => {
              setReloads((count) => count + 1);
            });
          }}
        />
      ) : (
        // Mirrors the database, which refuses these edits anyway.
        <div className="space-y-4 rounded-lg border p-4">
          <p className="flex items-center gap-2 font-medium">
            <Lock aria-hidden="true" className="size-4" />
            {status === 'cancelled'
              ? 'This shift was cancelled, so it can’t be changed.'
              : 'This shift has started, so it can’t be changed.'}
          </p>
          <Button asChild variant="outline">
            <Link to={shiftPath}>Back to the shift</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
