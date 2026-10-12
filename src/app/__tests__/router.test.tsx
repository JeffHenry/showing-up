import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppLayout, MAIN_CONTENT_ID } from '@/app/layouts/AppLayout';
import { routes } from '@/app/router';
import { RouteErrorBoundary } from '@/components/common/RouteErrorBoundary';
import { renderRoutes } from '@/test/render';

function Boom(): never {
  throw new Error('Kaboom');
}

describe('app routes', () => {
  it('lazily loads the landing page at /', async () => {
    renderRoutes(routes, { route: '/' });

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Volunteer scheduling without the spreadsheets.',
      }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(document.title).toBe('ShowingUp · Volunteer scheduling for small nonprofits');
    });
  });

  it('shows the not-found page for unknown paths', async () => {
    renderRoutes(routes, { route: '/does-not-exist' });

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to home' })).toHaveAttribute('href', '/');
    await waitFor(() => {
      expect(document.title).toBe('Page not found · ShowingUp');
    });
  });

  it('offers a skip link to the main content', async () => {
    renderRoutes(routes, { route: '/' });

    const skipLink = await screen.findByRole('link', { name: 'Skip to main content' });
    expect(skipLink).toHaveAttribute('href', `#${MAIN_CONTENT_ID}`);
    expect(screen.getByRole('main')).toHaveAttribute('id', MAIN_CONTENT_ID);
  });

  it('serves the privacy policy and links to it from every page', async () => {
    const { user } = renderRoutes(routes, { route: '/' });

    await user.click(await screen.findByRole('link', { name: 'Privacy policy' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Privacy policy' }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(document.title).toBe('Privacy policy · ShowingUp');
    });
  });

  it('moves focus to the main content after navigating', async () => {
    const { user } = renderRoutes(routes, { route: '/does-not-exist' });

    await user.click(await screen.findByRole('link', { name: 'Go to home' }));

    await screen.findByRole('heading', {
      level: 1,
      name: 'Volunteer scheduling without the spreadsheets.',
    });
    expect(screen.getByRole('main')).toHaveFocus();
  });

  it('renders the route error page when a route throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const withBrokenRoute = [
      {
        path: '/',
        Component: AppLayout,
        ErrorBoundary: RouteErrorBoundary,
        children: [{ path: 'broken', Component: Boom }],
      },
    ];

    renderRoutes(withBrokenRoute, { route: '/broken' });

    expect(
      await screen.findByRole('heading', { name: 'Something went wrong' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to home' })).toHaveAttribute('href', '/');
  });
});
