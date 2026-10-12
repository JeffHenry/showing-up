import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSendSignInEmail } from '@/features/auth/api/useAuthMutations';
import { emailFormSchema, type EmailFormValues } from '@/features/auth/schemas';
import { toAppError } from '@/lib/errors';

interface EmailStepProps {
  next: string;
  onSent: (email: string) => void;
}

export function EmailStep({ next, onSent }: EmailStepProps) {
  const sendEmail = useSendSignInEmail();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailFormValues>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(({ email }) => {
    sendEmail.mutate(
      { email, next },
      {
        onSuccess: () => {
          onSent(email);
        },
      },
    );
  });

  const fieldError = errors.email?.message;

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(event) => {
        void onSubmit(event);
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? 'email-error' : undefined}
          {...register('email')}
        />
        {fieldError && (
          <p id="email-error" className="text-sm text-destructive">
            {fieldError}
          </p>
        )}
      </div>
      {sendEmail.isError && (
        <p role="alert" className="text-sm text-destructive">
          {toAppError(sendEmail.error).message}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={sendEmail.isPending}>
        {sendEmail.isPending ? 'Sending…' : 'Email me a sign-in code'}
      </Button>
    </form>
  );
}
