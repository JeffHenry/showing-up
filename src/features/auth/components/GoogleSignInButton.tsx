import { Button } from '@/components/ui/button';
import { useStartGoogleSignIn } from '@/features/auth/api/useAuthMutations';
import { toAppError } from '@/lib/errors';

export function GoogleSignInButton({ next }: { next: string }) {
  const startGoogle = useStartGoogleSignIn();

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        // Stays disabled after success: the browser is already leaving for Google.
        disabled={startGoogle.isPending || startGoogle.isSuccess}
        onClick={() => {
          startGoogle.mutate(next);
        }}
      >
        Continue with Google
      </Button>
      {startGoogle.isError && (
        <p role="alert" className="text-sm text-destructive">
          {toAppError(startGoogle.error).message}
        </p>
      )}
    </div>
  );
}
