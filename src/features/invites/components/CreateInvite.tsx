import { useEffect, useRef, useState } from 'react';
import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/button';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { useCreateInvite } from '@/features/invites/api/useInviteMutations';
import { NewInviteLink } from '@/features/invites/components/NewInviteLink';
import type { InviteRole } from '@/features/invites/types';
import { toAppError } from '@/lib/errors';

interface CreateInviteProps {
  orgId: string;
  timeZone: string;
  /** Only owners can invite coordinators (the database enforces this too). */
  canInviteCoordinators: boolean;
}

/** Creates a single-use invite link, then shows it until the user asks for another. */
export function CreateInvite({ orgId, timeZone, canInviteCoordinators }: CreateInviteProps) {
  const createInvite = useCreateInvite(orgId);
  const [role, setRole] = useState<InviteRole>('volunteer');
  // After "Create another", return focus to the form's button rather than losing it.
  const [focusSubmit, setFocusSubmit] = useState(false);
  const submitRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (focusSubmit) submitRef.current?.focus();
  }, [focusSubmit]);

  if (createInvite.data) {
    return (
      <NewInviteLink
        invite={createInvite.data}
        role={createInvite.variables.role}
        timeZone={timeZone}
        onCreateAnother={() => {
          createInvite.reset();
          setFocusSubmit(true);
        }}
      />
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setFocusSubmit(false);
        createInvite.mutate({ orgId, role });
      }}
    >
      {canInviteCoordinators ? (
        <FormField
          id="invite-role"
          label="Role"
          hint="Coordinators help run the organization and can invite volunteers."
        >
          {(field) => (
            <NativeSelect
              {...field}
              className="w-full sm:w-64"
              value={role}
              onChange={(event) => {
                setRole(event.target.value === 'coordinator' ? 'coordinator' : 'volunteer');
              }}
            >
              <NativeSelectOption value="volunteer">Volunteer</NativeSelectOption>
              <NativeSelectOption value="coordinator">Coordinator</NativeSelectOption>
            </NativeSelect>
          )}
        </FormField>
      ) : (
        <p className="text-sm text-muted-foreground">
          Coordinators can invite volunteers. Ask an owner to invite another coordinator.
        </p>
      )}
      {createInvite.isError && (
        <p role="alert" className="text-sm text-destructive">
          {toAppError(createInvite.error).message}
        </p>
      )}
      <Button ref={submitRef} type="submit" disabled={createInvite.isPending}>
        {createInvite.isPending ? 'Creating link…' : 'Create invite link'}
      </Button>
    </form>
  );
}
