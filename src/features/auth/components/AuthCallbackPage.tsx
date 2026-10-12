import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useAuth } from '@/context/useAuth';
import { exchangeOAuthCode, verifyEmailLink } from '@/features/auth/api/authApi';
import { APP_NAME } from '@/lib/constants';
import { fromAuthErrorCode, toAppError, type AppError } from '@/lib/errors';
import { loginPath, safeNextPath } from '@/lib/redirects';

/**
 * Where email links (`?token_hash=`) and Google sign-in (`?code=`) return to. Verifies the
 * credential once; the auth state change then redirects to `next`.
 */
export function AuthCallbackPage() {
  const { status } = useAuth();
  const [searchParams] = useSearchParams();
  const next = safeNextPath(searchParams.get('next'));
  const tokenHash = searchParams.get('token_hash');
  const code = searchParams.get('code');
  const providerError = searchParams.get('error') ?? searchParams.get('error_code');
  const [verifyError, setVerifyError] = useState<AppError | null>(null);
  // Codes and links are single-use; React's dev-mode double effects must not redeem them twice.
  const startedRef = useRef(false);

  const paramsError: AppError | null = providerError
    ? fromAuthErrorCode(searchParams.get('error_code'))
    : !tokenHash && !code
      ? fromAuthErrorCode('flow_state_not_found')
      : null;

  const hasParamsError = paramsError !== null;

  useEffect(() => {
    if (hasParamsError || startedRef.current) return;
    startedRef.current = true;
    const verify = tokenHash ? verifyEmailLink(tokenHash) : exchangeOAuthCode(code ?? '');
    verify.catch((error: unknown) => {
      setVerifyError(toAppError(error));
    });
  }, [hasParamsError, tokenHash, code]);

  if (status === 'authenticated') return <Navigate to={next} replace />;

  const error = paramsError ?? verifyError;
  if (!error) {
    return (
      <p role="status" className="py-12 text-center text-muted-foreground">
        Signing you in…
      </p>
    );
  }

  return (
    <Card>
      <title>{`Sign-in problem · ${APP_NAME}`}</title>
      <CardHeader>
        <h1 className="text-2xl font-semibold tracking-tight">We couldn't sign you in</h1>
      </CardHeader>
      <CardContent className="space-y-4">
        <p role="alert" className="text-muted-foreground">
          {error.message}
        </p>
        <Button asChild>
          <Link to={loginPath(next)}>Back to sign in</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
