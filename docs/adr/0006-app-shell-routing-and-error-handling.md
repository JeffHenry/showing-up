# 0006: App shell, routing, and error handling

- **Status:** Accepted
- **Date:** 2026-10-11

## Context

Every feature in the MVP plugs into the same frame: routes, providers, a page layout, error
handling, and shared loading/empty states. Decisions made here repeat across every page, so they
should be deliberate. The original specification called for `React.lazy` + `Suspense` and a
44×44px minimum touch target.

## Decision

**Route-level code splitting with React Router's `lazy`.** Each route's component is imported in
the route definition (`src/app/router.tsx`). The data router downloads a page's code _before_
switching to it, so the current page stays visible during navigation instead of flashing a
Suspense fallback, and pages keep named exports. A `HydrateFallback` covers the first load.

**The route tree is exported without a router instance.** `main.tsx` creates the browser router;
tests mount the same `routes` in a memory router (`renderRoutes`), so routing is tested as
shipped.

**Two layers of error handling:**

- `RouteErrorBoundary` (route `ErrorBoundary`) replaces the page for unexpected errors, including
  a failed lazy-chunk download after a deploy. It offers a full reload and a full-page link home,
  discarding any broken in-memory state.
- `ErrorBoundary` (feature level) keeps one failing section from taking down the page. Its
  `onReset` is designed for TanStack Query's `QueryErrorResetBoundary`, so "Try again" refetches
  failed queries instead of re-throwing cached errors.

**Accessibility in the shell, not left to each page:** a skip link to `<main>`; focus moves to
`<main>` after client-side navigation (path changes only, so filter changes don't steal focus);
pages set their own `<title>` (React 19 hoists it into `<head>`); an offline banner inside an
always-present `role="status"` live region.

**Touch targets:** shadcn's button sizes gain `pointer-coarse:` minimums (44×44px) on touch
devices; mouse and trackpad users keep the compact desktop sizes.

**Shared hooks** live in `src/hooks/` (the `@/hooks` alias shadcn already configures) and are
covered by the same 80% line gate as `src/lib`, `src/app`, and `src/components/common`.

## Consequences

- Pages added in the MVP are one `lazy` entry in `router.tsx` plus a component; they inherit the
  layout, error handling, focus management, and offline banner.
- `ScrollRestoration` requires a `window.scrollTo` stub in the jsdom test setup.
- Unknown URLs render the app's 404 page with HTTP 200, because Vercel serves the SPA for every
  path. That is the usual SPA trade-off; a server-rendered framework would be needed to return a
  real 404 status.
