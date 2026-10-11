import { useQuery } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useParams, useSearchParams } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';

// Tests for the test utilities themselves: if the harness breaks, these fail loudly
// instead of every other suite passing for the wrong reasons.

const PING_URL = 'http://localhost:54321/rest/v1/ping';

function RouteProbe() {
  const { orgId } = useParams();
  const [searchParams] = useSearchParams();
  return (
    <p>
      org {orgId} view {searchParams.get('view')}
    </p>
  );
}

function PingProbe() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['ping'],
    queryFn: async () => {
      const response = await fetch(PING_URL);
      if (!response.ok) throw new Error(`Ping failed with ${String(response.status)}`);
      return (await response.json()) as { message: string };
    },
  });

  if (isPending) return <p>Loading</p>;
  if (isError) return <p role="alert">Request failed</p>;
  return <p>{data.message}</p>;
}

describe('test harness', () => {
  it('provides route params and search params from the given route', () => {
    renderWithProviders(<RouteProbe />, {
      route: '/orgs/42/shifts?view=week',
      path: '/orgs/:orgId/shifts',
    });

    expect(screen.getByText('org 42 view week')).toBeInTheDocument();
  });

  it('serves requests from MSW handlers through TanStack Query', async () => {
    server.use(http.get(PING_URL, () => HttpResponse.json({ message: 'pong' })));

    renderWithProviders(<PingProbe />);

    expect(await screen.findByText('pong')).toBeInTheDocument();
  });

  it('surfaces failed queries immediately because test clients do not retry', async () => {
    server.use(http.get(PING_URL, () => new HttpResponse(null, { status: 500 })));

    renderWithProviders(<PingProbe />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Request failed');
  });

  it('rejects requests that have no matching handler', async () => {
    // MSW logs the unhandled request; silence it so the expected error doesn't clutter output.
    // The spy is restored automatically after the test (`restoreMocks` in vite.config.ts).
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(fetch('http://localhost:54321/rest/v1/unmocked')).rejects.toThrow();
  });
});
