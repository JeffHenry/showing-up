import { useNavigate } from 'react-router';
import { z } from 'zod';
import { PageHeader } from '@/components/common/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrg } from '@/context/useOrg';
import { useCreateShift } from '@/features/shifts/api/useShiftMutations';
import { useShift } from '@/features/shifts/api/useShiftQueries';
import { ShiftForm } from '@/features/shifts/components/ShiftForm';
import { shiftNoticeState } from '@/features/shifts/navigationState';
import { shiftToFormValues } from '@/features/shifts/schemas';
import { useTypedSearchParams } from '@/hooks/useTypedSearchParams';
import { APP_NAME } from '@/lib/constants';
import { toAppError } from '@/lib/errors';

const paramsSchema = z.object({
  /** Duplicate: the shift to copy into the form. */
  from: z.string().optional().catch(undefined),
});

export function CreateShiftPage() {
  const { org } = useOrg();
  const navigate = useNavigate();
  const createShift = useCreateShift(org.id);
  const [{ from }] = useTypedSearchParams(paramsSchema);
  const source = useShift(from ?? null);

  if (from && source.isPending) {
    return (
      <div role="status" className="space-y-4">
        <span className="sr-only">Loading the shift to copy…</span>
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Only a shift from this organization is copied; anything else starts an empty form.
  const copy = source.data?.org_id === org.id ? source.data : null;
  const description = copy
    ? `A copy of “${copy.title}”. Change the date and anything else that’s different.`
    : `Everyone in ${org.name} will see it on the Shifts page.`;

  return (
    <div className="max-w-xl space-y-6">
      <title>{`New shift · ${org.name} · ${APP_NAME}`}</title>
      <PageHeader title="New shift" description={description} />
      {from && !copy && (
        <p role="status" className="text-sm text-muted-foreground">
          We couldn’t find the shift to copy, so the form starts empty.
        </p>
      )}
      <ShiftForm
        orgId={org.id}
        timeZone={org.timezone}
        defaultValues={copy ? shiftToFormValues(copy, org.timezone) : undefined}
        submitLabel="Create shift"
        pendingLabel="Creating…"
        cancelTo={copy ? `/orgs/${org.id}/shifts/${copy.id}` : `/orgs/${org.id}/shifts`}
        isPending={createShift.isPending}
        isDone={createShift.isSuccess}
        requestError={createShift.error ? toAppError(createShift.error) : null}
        onSubmit={(input) => {
          createShift.mutate(input, {
            onSuccess: (shiftId) => {
              void navigate(`/orgs/${org.id}/shifts/${shiftId}`, {
                state: shiftNoticeState('created'),
              });
            },
          });
        }}
      />
    </div>
  );
}
