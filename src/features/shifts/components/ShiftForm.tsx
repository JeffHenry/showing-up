import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router';
import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ShiftTimeFields } from '@/features/shifts/components/ShiftTimeFields';
import {
  CAPACITY_MAX,
  createShiftFormSchema,
  DESCRIPTION_MAX_LENGTH,
  EMPTY_SHIFT_FORM,
  type ShiftFormValues,
} from '@/features/shifts/schemas';
import type { ShiftInput } from '@/features/shifts/types';
import type { AppError } from '@/lib/errors';

interface ShiftFormProps {
  timeZone: string;
  /** Prefilled values (editing or duplicating); empty for a new shift. */
  defaultValues?: ShiftFormValues;
  submitLabel: string;
  pendingLabel: string;
  /** Where "Cancel" goes. */
  cancelTo: string;
  isPending: boolean;
  /** Keeps the button disabled after saving, while the page moves on. */
  isDone: boolean;
  requestError: AppError | null;
  onSubmit: (input: ShiftInput) => void;
}

/** Creates or edits a shift. Validation mirrors the database's rules, which still have the final say. */
export function ShiftForm({
  timeZone,
  defaultValues = EMPTY_SHIFT_FORM,
  submitLabel,
  pendingLabel,
  cancelTo,
  isPending,
  isDone,
  requestError,
  onSubmit,
}: ShiftFormProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ShiftFormValues, unknown, ShiftInput>({
    resolver: zodResolver(createShiftFormSchema(timeZone)),
    defaultValues,
  });
  const description = useWatch({ control, name: 'description' });

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={(event) => {
        void handleSubmit(onSubmit)(event);
      }}
    >
      <FormField id="shift-title" label="Title" error={errors.title?.message}>
        {(field) => <Input {...field} autoComplete="off" {...register('title')} />}
      </FormField>
      <ShiftTimeFields timeZone={timeZone} register={register} control={control} errors={errors} />
      <FormField
        id="shift-location"
        label="Location (optional)"
        hint="Helps volunteers find the right place, like a building or entrance."
        error={errors.location?.message}
      >
        {(field) => <Input {...field} autoComplete="off" {...register('location')} />}
      </FormField>
      <FormField id="shift-capacity" label="Volunteers needed" error={errors.capacity?.message}>
        {(field) => (
          <Input
            {...field}
            type="number"
            inputMode="numeric"
            min={1}
            max={CAPACITY_MAX}
            className="w-32"
            {...register('capacity')}
          />
        )}
      </FormField>
      <FormField
        id="shift-description"
        label="Details (optional)"
        hint={`What to bring, who to ask for, anything volunteers should know. ${String(description.length)} of ${String(DESCRIPTION_MAX_LENGTH)} characters.`}
        error={errors.description?.message}
      >
        {(field) => <Textarea {...field} rows={4} {...register('description')} />}
      </FormField>

      {requestError && (
        <p role="alert" className="text-sm text-destructive">
          {requestError.message}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={isPending || isDone}>
          {isPending ? pendingLabel : submitLabel}
        </Button>
        <Button asChild variant="ghost">
          <Link to={cancelTo}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
