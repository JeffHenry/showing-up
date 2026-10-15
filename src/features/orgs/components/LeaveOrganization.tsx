import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { useOrg } from '@/context/useOrg';
import { useLeaveOrganization } from '@/features/orgs/api/useLeaveOrganization';
import { toAppError } from '@/lib/errors';
import { queryKeys } from '@/lib/queryKeys';

/** Lets any member leave the current organization, after confirming. */
export function LeaveOrganization() {
  const { org } = useOrg();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const leave = useLeaveOrganization();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Leave the organization's pages first, then refresh the list without it.
  const afterLeaving = async () => {
    await navigate('/orgs', { replace: true, state: { left: org.name } });
    await queryClient.invalidateQueries({ queryKey: queryKeys.orgs.all });
  };

  return (
    <>
      <Button
        ref={buttonRef}
        type="button"
        variant="outline"
        onClick={() => {
          leave.reset();
          setOpen(true);
        }}
      >
        Leave organization
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Leave ${org.name}?`}
        description="You'll lose access until someone invites you again, and your upcoming shift signups there are cancelled."
        confirmLabel="Leave"
        pendingLabel="Leaving…"
        destructive
        returnFocusRef={buttonRef}
        pending={leave.isPending}
        error={leave.error ? toAppError(leave.error).message : null}
        onConfirm={() => {
          leave.mutate(org.id, {
            onSuccess: () => {
              void afterLeaving();
            },
          });
        }}
      />
    </>
  );
}
