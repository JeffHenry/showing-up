import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { useAuth } from '@/context/useAuth';
import { useAuthProviders } from '@/features/auth/api/useAuthProviders';
import { CodeStep } from '@/features/auth/components/CodeStep';
import { EmailStep } from '@/features/auth/components/EmailStep';
import { GoogleSignInButton } from '@/features/auth/components/GoogleSignInButton';
import { APP_NAME } from '@/lib/constants';
import { safeNextPath, ENTRY_STATE } from '@/lib/redirects';

export function LoginPage() {
  const { status } = useAuth();
  const [searchParams] = useSearchParams();
  const next = safeNextPath(searchParams.get('next'));
  const [sentTo, setSentTo] = useState<string | null>(null);
  // Google appears only where it's enabled; while loading or on error, email sign-in still works.
  const googleEnabled = useAuthProviders().data?.google === true;
  // Arriving from an invite link: say why they're signing in.
  const forInvite = next.startsWith('/invite/');

  // Covers both "already signed in" and "just signed in with the code".
  if (status === 'authenticated') return <Navigate to={next} replace state={ENTRY_STATE} />;

  return (
    <Card>
      <title>{`Sign in · ${APP_NAME}`}</title>
      <CardHeader>
        <h1 className="text-2xl font-semibold tracking-tight">
          {sentTo
            ? 'Check your email'
            : forInvite
              ? 'Sign in to accept your invitation'
              : 'Sign in to ShowingUp'}
        </h1>
        {!sentTo && (
          <CardDescription>
            {googleEnabled ? 'Use your email or Google account.' : 'Use your email address.'} New
            here? Signing in creates your account.
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {sentTo ? (
          <CodeStep
            email={sentTo}
            next={next}
            onUseDifferentEmail={() => {
              setSentTo(null);
            }}
          />
        ) : (
          <>
            <EmailStep next={next} onSent={setSentTo} />
            {googleEnabled && (
              <>
                <div className="flex items-center gap-3 text-xs text-muted-foreground uppercase">
                  <span className="h-px flex-1 bg-border" />
                  or
                  <span className="h-px flex-1 bg-border" />
                </div>
                <GoogleSignInButton next={next} />
              </>
            )}
          </>
        )}
        <p className="text-xs text-muted-foreground">
          By signing in you agree to how we handle your data in our{' '}
          <Link to="/privacy" className="underline underline-offset-4">
            privacy policy
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}
