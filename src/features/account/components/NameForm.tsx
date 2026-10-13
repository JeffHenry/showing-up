import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUpdateMyName } from '@/features/account/api/useUpdateMyName';
import { nameFormSchema, type NameFormValues } from '@/features/account/schemas';
import { toAppError } from '@/lib/errors';

interface NameFormProps {
  defaultName?: string;
  submitLabel: string;
  /** Announced after saving, for forms that stay on screen (e.g. the Account page). */
  savedMessage?: string;
}

/** Edits the signed-in person's display name. */
export function NameForm({ defaultName = '', submitLabel, savedMessage }: NameFormProps) {
  const updateName = useUpdateMyName();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NameFormValues>({
    resolver: zodResolver(nameFormSchema),
    defaultValues: { name: defaultName },
  });

  const onSubmit = handleSubmit(({ name }) => {
    updateName.mutate(name);
  });

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(event) => {
        void onSubmit(event);
      }}
    >
      <FormField
        id="display-name"
        label="Your name"
        hint="Shown to people in your organizations."
        error={errors.name?.message}
      >
        {(field) => <Input {...field} autoComplete="name" {...register('name')} />}
      </FormField>
      {updateName.isError && (
        <p role="alert" className="text-sm text-destructive">
          {toAppError(updateName.error).message}
        </p>
      )}
      <Button type="submit" disabled={updateName.isPending}>
        {updateName.isPending ? 'Saving…' : submitLabel}
      </Button>
      {savedMessage && (
        <p role="status" className="text-sm text-muted-foreground">
          {updateName.isSuccess ? savedMessage : ''}
        </p>
      )}
    </form>
  );
}
