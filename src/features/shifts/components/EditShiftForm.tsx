import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { useOrg } from '@/context/useOrg';
import { useUpdateShift } from '@/features/shifts/api/useShiftMutations';
import { ShiftForm } from '@/features/shifts/components/ShiftForm';
import { shiftNoticeState } from '@/features/shifts/navigationState';
import { shiftToFormValues } from '@/features/shifts/schemas';
import type { ShiftDetail } from '@/features/shifts/types';
import { toAppError } from '@/lib/errors';

interface EditShiftFormProps {
  shift: ShiftDetail;
  /** Reloads the shift and starts editing again from its latest version. */
  onLoadLatest: () => void;
  /** True after "Load the latest version", so focus returns to the form. */
  reloaded: boolean;
}

export function EditShiftForm({ shift, onLoadLatest, reloaded }: EditShiftFormProps) {
  const { org } = useOrg();
  const navigate = useNavigate();
  const update = useUpdateShift(org.id, shift.id);
  // The version this edit started from: a deliberate snapshot, not live query data. If the
  // cached shift refreshes in the background, saving must still notice that someone else
  // changed it rather than quietly overwriting their changes.
  const [baseVersion] = useState(shift.version);
  const shiftPath = `/orgs/${org.id}/shifts/${shift.id}`;
  const error = update.error ? toAppError(update.error) : null;
  const signedUp = shift.confirmed_count;

  return (
    <ShiftForm
      orgId={org.id}
      shiftId={shift.id}
      timeZone={org.timezone}
      defaultValues={shiftToFormValues(shift, org.timezone)}
      submitLabel="Save changes"
      pendingLabel="Saving…"
      cancelTo={shiftPath}
      isPending={update.isPending}
      isDone={update.isSuccess}
      requestError={error}
      focusFirstField={reloaded}
      capacityHint={
        signedUp > 0
          ? `${String(signedUp)} ${signedUp === 1 ? 'person is' : 'people are'} signed up, so keep at least ${String(signedUp)}.`
          : undefined
      }
      errorAction={
        error?.code === 'SHIFT_CHANGED' ? (
          <Button type="button" variant="outline" onClick={onLoadLatest}>
            Load the latest version
          </Button>
        ) : undefined
      }
      onSubmit={(input) => {
        update.mutate(
          { version: baseVersion, input },
          {
            onSuccess: () => {
              void navigate(shiftPath, { state: shiftNoticeState('saved') });
            },
          },
        );
      }}
    />
  );
}
