import { Ban } from 'lucide-react';
import { useRef, useState, type RefObject } from 'react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useOrg } from '@/context/useOrg';
import { useCancelShift } from '@/features/shifts/api/useShiftMutations';
import type { ShiftDetail } from '@/features/shifts/types';
import { toAppError } from '@/lib/errors';

/** Matches the database's limit on `cancel_reason`. */
const REASON_MAX_LENGTH = 500;

interface CancelShiftProps {
  shift: ShiftDetail;
  /** Where focus goes once cancelled, since this button disappears with the change. */
  afterCancelFocusRef: RefObject<HTMLElement | null>;
  onCancelled: () => void;
}

/** Calls a shift off, keeping it on the schedule marked cancelled, with an optional reason. */
export function CancelShift({ shift, afterCancelFocusRef, onCancelled }: CancelShiftProps) {
  const { org } = useOrg();
  const cancel = useCancelShift(org.id, shift.id);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Back to this button if the dialog is dismissed; elsewhere once the shift is cancelled.
  const returnFocusRef = useRef<HTMLElement | null>(null);

  return (
    <>
      <Button
        ref={buttonRef}
        type="button"
        variant="outline"
        onClick={() => {
          cancel.reset();
          setReason('');
          returnFocusRef.current = buttonRef.current;
          setOpen(true);
        }}
      >
        <Ban aria-hidden="true" data-icon="inline-start" />
        Cancel shift
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Cancel “${shift.title}”?`}
        description="It stays on the schedule marked cancelled, so volunteers know it’s off. This can’t be undone."
        confirmLabel="Cancel shift"
        pendingLabel="Cancelling…"
        dismissLabel="Keep shift"
        destructive
        returnFocusRef={returnFocusRef}
        pending={cancel.isPending}
        error={cancel.error ? toAppError(cancel.error).message : null}
        onConfirm={() => {
          cancel.mutate(reason, {
            onSuccess: () => {
              returnFocusRef.current = afterCancelFocusRef.current;
              setOpen(false);
              onCancelled();
            },
          });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="cancel-reason">Reason (optional)</Label>
          <Textarea
            id="cancel-reason"
            rows={3}
            maxLength={REASON_MAX_LENGTH}
            aria-describedby="cancel-reason-hint"
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
            }}
          />
          <p id="cancel-reason-hint" className="text-sm text-muted-foreground">
            Everyone who can see the shift will see this.
          </p>
        </div>
      </ConfirmDialog>
    </>
  );
}
