import { useNavigate } from 'react-router';
import { PageHeader } from '@/components/common/PageHeader';
import { useOrg } from '@/context/useOrg';
import { useCreateShift } from '@/features/shifts/api/useShiftMutations';
import { ShiftForm } from '@/features/shifts/components/ShiftForm';
import { SHIFT_CREATED_STATE } from '@/features/shifts/navigationState';
import { APP_NAME } from '@/lib/constants';
import { toAppError } from '@/lib/errors';

export function CreateShiftPage() {
  const { org } = useOrg();
  const navigate = useNavigate();
  const createShift = useCreateShift(org.id);

  return (
    <div className="max-w-xl space-y-6">
      <title>{`New shift · ${org.name} · ${APP_NAME}`}</title>
      <PageHeader
        title="New shift"
        description={`Everyone in ${org.name} will see it on the Shifts page.`}
      />
      <ShiftForm
        timeZone={org.timezone}
        submitLabel="Create shift"
        pendingLabel="Creating…"
        cancelTo={`/orgs/${org.id}/shifts`}
        isPending={createShift.isPending}
        isDone={createShift.isSuccess}
        requestError={createShift.error ? toAppError(createShift.error) : null}
        onSubmit={(input) => {
          createShift.mutate(input, {
            onSuccess: (shiftId) => {
              void navigate(`/orgs/${org.id}/shifts/${shiftId}`, { state: SHIFT_CREATED_STATE });
            },
          });
        }}
      />
    </div>
  );
}
