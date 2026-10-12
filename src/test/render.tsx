import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';
import { AuthContext, type AuthContextValue } from '@/context/authContext';
import { createQueryClient } from '@/lib/queryClient';
import { testSession } from '@/test/fixtures/auth';

interface BaseOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Initial URL, including any search params. Defaults to `/`. */
  route?: string;
  queryClient?: QueryClient;
  /**
   * Fake auth state. Defaults to signed out; `'signedIn'` uses the test session. Tests of the real
   * session logic render `<AuthProvider>` themselves, which overrides this.
   */
  auth?: 'signedOut' | 'signedIn' | 'loading' | Partial<AuthContextValue>;
}

interface RenderWithProvidersOptions extends BaseOptions {
  /** Route pattern the UI is mounted at, so `useParams` resolves (e.g. `/orgs/:orgId`). */
  path?: string;
}

/** App defaults, minus retries, so failing queries surface immediately in tests. */
export function createTestQueryClient(): QueryClient {
  const queryClient = createQueryClient();
  const defaults = queryClient.getDefaultOptions();
  queryClient.setDefaultOptions({
    queries: { ...defaults.queries, retry: false },
    mutations: { ...defaults.mutations, retry: false },
  });
  return queryClient;
}

function fakeAuth(auth: BaseOptions['auth'] = 'signedOut'): AuthContextValue {
  const signedOut: AuthContextValue = {
    status: 'unauthenticated',
    session: null,
    user: null,
    signOut: () => Promise.resolve(),
  };
  if (auth === 'signedOut') return signedOut;
  if (auth === 'loading') return { ...signedOut, status: 'loading' };
  if (auth === 'signedIn') {
    const session = testSession();
    return { ...signedOut, status: 'authenticated', session, user: session.user };
  }
  return { ...signedOut, ...auth };
}

function renderRouter(
  routes: RouteObject[],
  { route = '/', queryClient = createTestQueryClient(), auth, ...renderOptions }: BaseOptions,
) {
  const router = createMemoryRouter(routes, { initialEntries: [route] });
  const user = userEvent.setup();

  const view = render(
    <QueryClientProvider client={queryClient}>
      <AuthContext value={fakeAuth(auth)}>
        <RouterProvider router={router} />
      </AuthContext>
    </QueryClientProvider>,
    renderOptions,
  );

  return { ...view, user, queryClient, router };
}

/**
 * Renders UI inside the same providers the app uses: a fresh QueryClient, auth state, and a data
 * router. Returns Testing Library's result plus a `user` for realistic interactions.
 *
 * The router is created once per render, so `rerender` will not swap the routed element.
 */
export function renderWithProviders(
  ui: ReactElement,
  { path = '*', ...options }: RenderWithProvidersOptions = {},
) {
  return renderRouter([{ path, element: ui }], options);
}

/** Renders a route tree (usually the app's real `routes`) at `route`, with the app's providers. */
export function renderRoutes(routes: RouteObject[], options: BaseOptions = {}) {
  return renderRouter(routes, options);
}
