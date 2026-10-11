import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';
import { createQueryClient } from '@/lib/queryClient';

interface BaseOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Initial URL, including any search params. Defaults to `/`. */
  route?: string;
  queryClient?: QueryClient;
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

function renderRouter(
  routes: RouteObject[],
  { route = '/', queryClient = createTestQueryClient(), ...renderOptions }: BaseOptions,
) {
  const router = createMemoryRouter(routes, { initialEntries: [route] });
  const user = userEvent.setup();

  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
    renderOptions,
  );

  return { ...view, user, queryClient, router };
}

/**
 * Renders UI inside the same providers the app uses: a fresh QueryClient and a data router.
 * Returns Testing Library's result plus a `user` for realistic interactions.
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
