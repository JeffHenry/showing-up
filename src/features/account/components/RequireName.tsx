import { Navigate, Outlet, useLocation } from 'react-router';
import { ErrorFallback } from '@/components/common/ErrorFallback';
import { useMyProfile } from '@/features/account/api/useMyProfile';

/**
 * Layout route for pages that show people to each other: anyone without a display name is asked
 * for one first. Loaded with the route's `lazy` (it uses the Supabase client).
 */
export function RequireName() {
  const location = useLocation();
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

  if (!profile.full_name) {
    const next = `${location.pathname}${location.search}`;
    // Pass the navigation state along, so an arrival (e.g. straight after sign-in) is still recognised afterwards.
    return (
      <Navigate
        to={`/welcome?next=${encodeURIComponent(next)}`}
        replace
        state={location.state as unknown}
      />
    );
  }

  return <Outlet />;
}
