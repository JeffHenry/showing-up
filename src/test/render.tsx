import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { createQueryClient } from '@/lib/queryClient';

interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Initial URL, including any search params. Defaults to `/`. */
  route?: string;
  /** Route pattern the UI is mounted at, so `useParams` resolves (e.g. `/orgs/:orgId`). */
  path?: string;
  queryClient?: QueryClient;
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

/**
 * Renders UI inside the same providers the app uses: a fresh QueryClient and a data router.
 * Returns Testing Library's result plus a `user` for realistic interactions.
 *
 * The router is created once per render, so `rerender` will not swap the routed element.
 */
export function renderWithProviders(
  ui: ReactElement,
  {
    route = '/',
    path = '*',
    queryClient = createTestQueryClient(),
    ...renderOptions
  }: RenderWithProvidersOptions = {},
) {
  const router = createMemoryRouter([{ path, element: ui }], { initialEntries: [route] });
  const user = userEvent.setup();

  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
    renderOptions,
  );

  return { ...view, user, queryClient, router };
}
