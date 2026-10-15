import { useRef, useState, type RefObject } from 'react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { useRemoveSignup } from '@/features/signups/api/useSignupMutations';
import { toAppError } from '@/lib/errors';

interface RemoveSignupProps {
  orgId: string;
  shiftId: string;
  shiftTitle: string;
  userId: string;
  name: string;
  /** Where focus goes once removed, since this row (and its button) goes away. */
  afterRemoveFocusRef: RefObject<HTMLElement | null>;
  onRemoved: (name: string) => void;
}

/** A coordinator's way to take someone off a shift, after confirming. */
export function RemoveSignup({
  orgId,
  shiftId,
  shiftTitle,
  userId,
  name,
  afterRemoveFocusRef,
  onRemoved,
}: RemoveSignupProps) {
  const remove = useRemoveSignup(orgId, shiftId);
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Back to this button if dismissed; to the list's heading once the row is gone.
  const returnFocusRef = useRef<HTMLElement | null>(null);

  return (
    <>
      <Button
        ref={buttonRef}
        type="button"
        variant="outline"
        size="sm"
        aria-label={`Remove ${name}`}
        onClick={() => {
          remove.reset();
          returnFocusRef.current = buttonRef.current;
          setOpen(true);
        }}
      >
        Remove
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Remove ${name} from “${shiftTitle}”?`}
        description="Their spot opens up for someone else. They aren’t notified automatically, so let them know."
        confirmLabel="Remove"
        pendingLabel="Removing…"
        dismissLabel="Keep them"
        destructive
        returnFocusRef={returnFocusRef}
        pending={remove.isPending}
        error={remove.error ? toAppError(remove.error).message : null}
        onConfirm={() => {
          remove.mutate(userId, {
            onSuccess: () => {
              returnFocusRef.current = afterRemoveFocusRef.current;
              setOpen(false);
              onRemoved(name);
            },
          });
        }}
      />
    </>
  );
}
