import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';

/** Props to spread onto the field's control so its label, hint, and error are announced. */
export interface FieldControlProps {
  id: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
}

interface FormFieldProps {
  id: string;
  label: ReactNode;
  /** Help text shown under the control and read out with it. */
  hint?: ReactNode;
  error?: string;
  children: (control: FieldControlProps) => ReactNode;
}

/** A labeled form control with optional help text and a validation message linked to it. */
export function FormField({ id, label, hint, error, children }: FormFieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ');

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy || undefined,
      })}
      {hint && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
