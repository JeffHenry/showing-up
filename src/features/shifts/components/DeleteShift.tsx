import { Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { useOrg } from '@/context/useOrg';
import { useDeleteShift } from '@/features/shifts/api/useShiftMutations';
import { deletedShiftState } from '@/features/shifts/navigationState';
import type { ShiftDetail } from '@/features/shifts/types';
import { toAppError } from '@/lib/errors';

/** Removes a shift entirely: for mistakes. Cancelling keeps a record instead. */
export function DeleteShift({ shift }: { shift: ShiftDetail }) {
  const { org } = useOrg();
  const navigate = useNavigate();
  const remove = useDeleteShift(org.id, shift.id);
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <Button
        ref={buttonRef}
        type="button"
        variant="outline"
        onClick={() => {
          remove.reset();
          setOpen(true);
        }}
      >
        <Trash2 aria-hidden="true" data-icon="inline-start" />
        Delete
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Delete “${shift.title}”?`}
        description="It’s removed for everyone. To keep a record that it was called off, cancel it instead."
        confirmLabel="Delete shift"
        pendingLabel="Deleting…"
        dismissLabel="Keep shift"
        destructive
        returnFocusRef={buttonRef}
        pending={remove.isPending}
        error={remove.error ? toAppError(remove.error).message : null}
        onConfirm={() => {
          remove.mutate(undefined, {
            onSuccess: () => {
              void navigate(`/orgs/${org.id}/shifts`, { state: deletedShiftState(shift.title) });
            },
          });
        }}
      />
    </>
  );
}
