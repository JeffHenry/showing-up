import { Navigate, useLocation, useSearchParams } from 'react-router';
import { ErrorFallback } from '@/components/common/ErrorFallback';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { useMyProfile } from '@/features/account/api/useMyProfile';
import { NameForm } from '@/features/account/components/NameForm';
import { APP_NAME } from '@/lib/constants';
import { safeNextPath } from '@/lib/redirects';

/** The one-time "What should we call you?" step for people without a display name. */
export function WelcomePage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const next = safeNextPath(searchParams.get('next'));
  const { data: profile, isPending, isError, refetch } = useMyProfile();

  if (isPending) {
    return (
      <p role="status" className="py-12 text-center text-muted-foreground">
        Loading your profile…
      </p>
    );
  }

  if (isError) {
    return (
      <ErrorFallback
        title="We couldn't load your profile"
        message="Check your connection and try again."
        reset={() => {
          void refetch();
        }}
      />
    );
  }

  // Named already, or just saved: continue to where they were headed, keeping the state.
  if (profile.full_name) {
    return <Navigate to={next} replace state={location.state as unknown} />;
  }

  return (
    <Card>
      <title>{`Welcome · ${APP_NAME}`}</title>
      <CardHeader>
        <h1 className="text-2xl font-semibold tracking-tight">What should we call you?</h1>
        <CardDescription>
          People in your organizations see this name instead of your email address. You can change
          it later in your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <NameForm submitLabel="Continue" />
      </CardContent>
    </Card>
  );
}
