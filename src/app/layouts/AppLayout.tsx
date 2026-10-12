import { Link, Outlet, ScrollRestoration } from 'react-router';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { AccountControls } from '@/features/auth/components/AccountControls';
import { useFocusMainOnNavigate } from '@/hooks/useFocusMainOnNavigate';
import { APP_NAME, REPO_URL } from '@/lib/constants';

export const MAIN_CONTENT_ID = 'main-content';

const focusRing = 'rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50';

export function AppLayout() {
  const mainRef = useFocusMainOnNavigate<HTMLElement>();

  return (
    <div className="flex min-h-svh flex-col">
      <a
        href={`#${MAIN_CONTENT_ID}`}
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:shadow-md focus:ring-3 focus:ring-ring/50"
      >
        Skip to main content
      </a>
      <OfflineBanner />
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
          <Link to="/" className={`text-lg font-semibold tracking-tight ${focusRing}`}>
            {APP_NAME}
          </Link>
          <AccountControls />
        </div>
      </header>
      <main
        id={MAIN_CONTENT_ID}
        ref={mainRef}
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 outline-none"
      >
        <Outlet />
      </main>
      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-6 text-sm text-muted-foreground">
          <p>
            {APP_NAME} is a portfolio project.{' '}
            <a href={REPO_URL} className={`underline underline-offset-4 ${focusRing}`}>
              View the source on GitHub
            </a>
            .
          </p>
          <Link to="/privacy" className={`underline underline-offset-4 ${focusRing}`}>
            Privacy policy
          </Link>
        </div>
      </footer>
      <ScrollRestoration />
    </div>
  );
}
