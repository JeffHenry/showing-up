import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSendSignInEmail, useVerifyEmailCode } from '@/features/auth/api/useAuthMutations';
import { codeFormSchema, type CodeFormValues } from '@/features/auth/schemas';
import { toAppError } from '@/lib/errors';

interface CodeStepProps {
  email: string;
  next: string;
  onUseDifferentEmail: () => void;
}

/** Step two: enter the emailed code. A successful sign-in redirects via the login page. */
export function CodeStep({ email, next, onUseDifferentEmail }: CodeStepProps) {
  const verifyCode = useVerifyEmailCode();
  const resend = useSendSignInEmail();
  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors },
  } = useForm<CodeFormValues>({
    resolver: zodResolver(codeFormSchema),
    defaultValues: { code: '' },
  });

  // The form just replaced the email step: put keyboard and screen-reader users on the new field.
  useEffect(() => {
    setFocus('code');
  }, [setFocus]);

  const onSubmit = handleSubmit(({ code }) => {
    verifyCode.mutate({ email, code });
  });

  const fieldError = errors.code?.message;
  const requestError = verifyCode.error ?? resend.error;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        We sent a 6-digit code and a sign-in link to{' '}
        <span className="font-medium text-foreground">{email}</span>. Enter the code below, or open
        the link on any device.
      </p>
      <form
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          void onSubmit(event);
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="code">6-digit code</Label>
          <Input
            id="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? 'code-error' : undefined}
            {...register('code')}
          />
          {fieldError && (
            <p id="code-error" className="text-sm text-destructive">
              {fieldError}
            </p>
          )}
        </div>
        {requestError && (
          <p role="alert" className="text-sm text-destructive">
            {toAppError(requestError).message}
          </p>
        )}
        <Button
          type="submit"
          className="w-full"
          disabled={verifyCode.isPending || verifyCode.isSuccess}
        >
          {verifyCode.isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      <div className="flex flex-wrap justify-between gap-2">
        <Button
          type="button"
          variant="link"
          className="px-0"
          disabled={resend.isPending}
          onClick={() => {
            verifyCode.reset();
            resend.mutate({ email, next });
          }}
        >
          {resend.isPending ? 'Sending…' : 'Send a new code'}
        </Button>
        <Button type="button" variant="link" className="px-0" onClick={onUseDifferentEmail}>
          Use a different email
        </Button>
      </div>
      <p role="status" className="text-sm text-muted-foreground">
        {resend.isSuccess ? `A new code is on its way to ${email}.` : ''}
      </p>
    </div>
  );
}
