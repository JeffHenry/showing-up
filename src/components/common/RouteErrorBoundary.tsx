import { useEffect } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router';
import { Button } from '@/components/ui/button';
import { APP_NAME } from '@/lib/constants';

/**
 * Route-level fallback. It replaces the whole layout, so it renders its own page frame.
 * Also catches failed lazy-route downloads (e.g. after a deploy), which "Reload" fixes.
 */
export function RouteErrorBoundary() {
  const error = useRouteError();
  const isNotFound = isRouteErrorResponse(error) && error.status === 404;

  useEffect(() => {
    // Replaced by Sentry reporting in P1.
    if (!isNotFound) console.error('Route error', error);
  }, [error, isNotFound]);

  const title = isNotFound ? 'Page not found' : 'Something went wrong';

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-4 px-4 py-12">
      <title>{`${title} · ${APP_NAME}`}</title>
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">
        {isNotFound
          ? "The page you're looking for doesn't exist or has moved."
          : 'An unexpected error stopped this page from loading. Reloading usually fixes it.'}
      </p>
      <div className="flex flex-wrap gap-2">
        {!isNotFound && (
          <Button
            type="button"
            onClick={() => {
              window.location.reload();
            }}
          >
            Reload
          </Button>
        )}
        {/* A full page load (not client navigation) so any broken in-memory state is discarded. */}
        <Button asChild variant={isNotFound ? 'default' : 'outline'}>
          <a href="/">Go to home</a>
        </Button>
      </div>
    </main>
  );
}
