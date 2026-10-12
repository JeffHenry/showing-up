import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '@/context/useAuth';
import { loginPath } from '@/lib/redirects';

/**
 * Layout route for signed-in pages. This is a UX guard only: the database's row-level security is
 * what actually protects data.
 */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <p role="status" className="py-12 text-center text-muted-foreground">
        Checking your sign-in…
      </p>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to={loginPath(`${location.pathname}${location.search}`)} replace />;
  }

  return <Outlet />;
}
