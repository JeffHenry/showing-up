import { QueryErrorResetBoundary, useQuery } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';

const ORGS_URL = 'http://localhost:54321/rest/v1/organizations';

let shouldThrow = true;
function Flaky() {
  if (shouldThrow) throw new Error('Flaky failure');
  return <p>Recovered content</p>;
}

function OrganizationName() {
  const { data } = useQuery({
    queryKey: ['organization'],
    queryFn: async () => {
      const response = await fetch(ORGS_URL);
      if (!response.ok) throw new Error(`Request failed with ${String(response.status)}`);
      return (await response.json()) as { name: string };
    },
    throwOnError: true,
  });
  return <p>{data ? data.name : 'Loading organization'}</p>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    shouldThrow = true;
    // React and the boundary both log caught errors; keep test output readable.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('renders its children when nothing throws', () => {
    shouldThrow = false;
    renderWithProviders(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Recovered content')).toBeInTheDocument();
  });

  it('shows the fallback instead of crashing the page', () => {
    renderWithProviders(
      <>
        <h1>Page title</h1>
        <ErrorBoundary>
          <Flaky />
        </ErrorBoundary>
      </>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('heading', { name: 'Page title' })).toBeInTheDocument();
  });

  it('retries the section and calls onReset when the user clicks "Try again"', async () => {
    const onReset = vi.fn();
    const { user } = renderWithProviders(
      <ErrorBoundary onReset={onReset}>
        <Flaky />
      </ErrorBoundary>,
    );

    shouldThrow = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(onReset).toHaveBeenCalledOnce();
    expect(screen.getByText('Recovered content')).toBeInTheDocument();
  });

  it('passes the error and reset to a custom fallback', () => {
    renderWithProviders(
      <ErrorBoundary
        fallback={({ error }) => <p>Custom: {error instanceof Error ? error.message : ''}</p>}
      >
        <Flaky />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Custom: Flaky failure')).toBeInTheDocument();
  });

  it('refetches a failed query on retry when wrapped in QueryErrorResetBoundary', async () => {
    server.use(
      http.get(ORGS_URL, () => new HttpResponse(null, { status: 500 }), { once: true }),
      http.get(ORGS_URL, () => HttpResponse.json({ name: 'Food Bank' })),
    );

    const { user } = renderWithProviders(
      <QueryErrorResetBoundary>
        {({ reset }) => (
          <ErrorBoundary onReset={reset}>
            <OrganizationName />
          </ErrorBoundary>
        )}
      </QueryErrorResetBoundary>,
    );

    await user.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Food Bank')).toBeInTheDocument();
  });
});
