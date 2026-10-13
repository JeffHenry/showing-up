export const DEFAULT_SIGNED_IN_PATH = '/orgs';

// Any origin works here; it only lets the URL parser resolve relative paths.
const PARSE_BASE = 'https://showing-up.invalid';

/**
 * Validates the post-sign-in `next` parameter. Only same-origin relative paths are allowed, so the
 * sign-in page can't be used to send people to another site (an "open redirect").
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next?.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return DEFAULT_SIGNED_IN_PATH;
  }
  // The URL parser also normalises tricks like tabs or newlines inside "//", so compare origins.
  const url = new URL(next, PARSE_BASE);
  if (url.origin !== PARSE_BASE) return DEFAULT_SIGNED_IN_PATH;
  // Never bounce back into the sign-in flow itself.
  if (url.pathname === '/login' || url.pathname.startsWith('/auth/')) return DEFAULT_SIGNED_IN_PATH;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** The sign-in page URL that returns the user to `next` afterwards. */
export function loginPath(next: string): string {
  return `/login?next=${encodeURIComponent(next)}`;
}

/**
 * Router navigation state for arriving at the app: straight after signing in, or a signed-in
 * visit to the home page. Pages can tell an arrival from a later visit, e.g. `/orgs` opens a
 * user's only organization on arrival but shows the list when visited directly.
 */
export const ENTRY_STATE = { entry: true } as const;

/** Whether `location.state` marks an arrival at the app (see `ENTRY_STATE`). */
export function isEntryNavigation(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'entry' in state && state.entry === true;
}
