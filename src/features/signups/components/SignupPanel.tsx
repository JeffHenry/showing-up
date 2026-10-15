import { CircleCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { useClaimShift, useDropOut } from '@/features/signups/api/useSignupMutations';
import type { SignupShift } from '@/features/signups/types';
import { toAppError } from '@/lib/errors';
import { spotsLeft, spotsSummary } from '@/lib/spots';

interface SignupPanelProps {
  orgId: string;
  shift: SignupShift;
}

/** Why there's no Sign up button, when there isn't one. */
function closedReason(shift: SignupShift, started: boolean, full: boolean): string | null {
  if (shift.cancelled_at) {
    return shift.signed_up ? 'You don’t need to come: this shift was cancelled.' : null;
  }
  if (started) return shift.signed_up ? null : 'This shift has started, so sign-ups are closed.';
  if (full && !shift.signed_up) return 'This shift is full.';
  return null;
}

/**
 * How full the shift is, and the signed-in person's Sign up / Drop out button. Changes show at
 * once (optimistic) and roll back if the server refuses, with the reason shown here.
 */
export function SignupPanel({ orgId, shift }: SignupPanelProps) {
  const claim = useClaimShift(orgId, shift.id);
  const dropOut = useDropOut(orgId, shift.id);
  const [now] = useState(() => new Date());
  const [confirmingDropOut, setConfirmingDropOut] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const started = new Date(shift.start_time) <= now;
  const full = spotsLeft(shift.confirmed_count, shift.capacity) === 0;
  // One button that changes between Sign up and Drop out, so focus stays on it.
  const showButton = !shift.cancelled_at && !started && (shift.signed_up || !full);
  const pending = claim.isPending || dropOut.isPending;
  const failure = claim.error ?? dropOut.error;
  const reason = closedReason(shift, started, full);

  // If the button disappears while focused (a claim refused because the shift just filled),
  // move focus to the section's heading instead of losing it.
  const hadButton = useRef(showButton);
  useEffect(() => {
    if (hadButton.current && !showButton && document.activeElement === document.body) {
      headingRef.current?.focus();
    }
    hadButton.current = showButton;
  }, [showButton]);

  const signUp = () => {
    dropOut.reset();
    setAnnouncement('');
    claim.mutate(undefined, {
      onSuccess: () => {
        setAnnouncement(`You’re signed up for ${shift.title}.`);
      },
    });
  };

  const confirmDropOut = () => {
    setConfirmingDropOut(false);
    claim.reset();
    setAnnouncement('');
    dropOut.mutate(undefined, {
      onSuccess: () => {
        setAnnouncement(`You dropped out of ${shift.title}.`);
      },
    });
  };

  return (
    <section aria-labelledby="signup-heading" className="space-y-3 rounded-lg border p-4">
      <h2
        id="signup-heading"
        ref={headingRef}
        tabIndex={-1}
        className="text-lg font-medium outline-none"
      >
        Volunteer spots
      </h2>
      <p>{spotsSummary(shift.confirmed_count, shift.capacity)}</p>
      {shift.signed_up && (
        <p className="flex items-center gap-2 font-medium">
          <CircleCheck aria-hidden="true" className="size-4 text-primary" />
          You’re signed up.
        </p>
      )}
      {reason && <p className="text-sm text-muted-foreground">{reason}</p>}
      {showButton && (
        <Button
          ref={buttonRef}
          type="button"
          variant={shift.signed_up ? 'outline' : 'default'}
          disabled={pending}
          onClick={() => {
            if (shift.signed_up) setConfirmingDropOut(true);
            else signUp();
          }}
        >
          {shift.signed_up ? 'Drop out' : 'Sign up'}
        </Button>
      )}
      {failure && (
        <p role="alert" className="text-sm text-destructive">
          {toAppError(failure).message}
        </p>
      )}
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <ConfirmDialog
        open={confirmingDropOut}
        onOpenChange={setConfirmingDropOut}
        title={`Drop out of “${shift.title}”?`}
        description="Your spot opens up for someone else."
        confirmLabel="Drop out"
        pendingLabel="Dropping out…"
        dismissLabel="Stay signed up"
        destructive
        returnFocusRef={buttonRef}
        onConfirm={confirmDropOut}
      />
    </section>
  );
}
