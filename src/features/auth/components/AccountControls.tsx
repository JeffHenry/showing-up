import { useMutation } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/useAuth';
import { toAppError } from '@/lib/errors';

/** Header controls: "Sign in" when signed out; the account email and "Sign out" when signed in. */
export function AccountControls() {
  const { status, user, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      void navigate('/', { replace: true });
    },
  });

  if (status === 'loading') return null;

  if (status === 'unauthenticated') {
    if (pathname === '/login') return null;
    return (
      <Button asChild size="sm" variant="outline">
        <Link to="/login">Sign in</Link>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1 sm:gap-3">
      <span className="hidden max-w-56 truncate text-sm text-muted-foreground sm:inline">
        {user?.email}
      </span>
      <Button asChild size="sm" variant="ghost">
        <Link to="/account">Account</Link>
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={signOutMutation.isPending}
        onClick={() => {
          signOutMutation.mutate();
        }}
      >
        Sign out
      </Button>
      {signOutMutation.isError && (
        <p role="alert" className="text-sm text-destructive">
          {toAppError(signOutMutation.error).message}
        </p>
      )}
    </div>
  );
}
