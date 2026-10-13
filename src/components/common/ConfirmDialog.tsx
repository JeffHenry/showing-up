import type { ReactNode, RefObject } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  open: boolean;
  /** Called with `false` when the user cancels or presses Escape (ignored while pending). */
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  /** The button that closes without changing anything; "Cancel" unless that's ambiguous. */
  dismissLabel?: string;
  /** Extra inputs between the description and the buttons, e.g. an optional reason. */
  children?: ReactNode;
  onConfirm: () => void;
  pending?: boolean;
  /** Shown inside the dialog, e.g. why the change was refused. */
  error?: string | null;
  destructive?: boolean;
  /** Where focus goes when the dialog closes, when it wasn't opened by a dialog trigger. */
  returnFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Asks before a risky change. Stays open while the change saves and shows any error inside, so
 * the parent closes it on success. Focus is trapped while open and returned afterwards.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pendingLabel,
  dismissLabel = 'Cancel',
  children,
  onConfirm,
  pending = false,
  error,
  destructive = false,
  returnFocusRef,
}: ConfirmDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          if (!returnFocusRef) return;
          // Return focus to the caller's element. If it's gone (a removed row takes its button
          // with it), leave focus where the caller has already moved it.
          event.preventDefault();
          const target = returnFocusRef.current;
          if (target?.isConnected) target.focus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{dismissLabel}</AlertDialogCancel>
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'default'}
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? pendingLabel : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
