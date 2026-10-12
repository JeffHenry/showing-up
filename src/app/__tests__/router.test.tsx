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

  it('sends signed-out visitors from a private page to sign in, then shows the sign-in page', async () => {
    renderRoutes(routes, { route: '/orgs', auth: 'signedOut' });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Sign in to ShowingUp' }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(document.title).toBe('Sign in · ShowingUp');
    });
  });

  it.each([['/orgs/new'], ['/orgs/00000000-0000-0000-0000-0000000000b1']])(
    'protects %s, keeping it as the place to return to after signing in',
    async (path) => {
      const { router } = renderRoutes(routes, { route: path, auth: 'signedOut' });

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Sign in to ShowingUp' }),
      ).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/login');
      expect(new URLSearchParams(router.state.location.search).get('next')).toBe(path);
    },
  );

  it('serves the create-organization form at /orgs/new, not as an organization ID', async () => {
    renderRoutes(routes, { route: '/orgs/new', auth: 'signedIn' });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'New organization' }),
    ).toBeInTheDocument();
  });

  it('shows the signed-in landing page and account controls to signed-in users', async () => {
    renderRoutes(routes, { route: '/orgs', auth: 'signedIn' });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Your organizations' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
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
