import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AccountControls } from '@/features/auth/components/AccountControls';
import { testSession, testUser } from '@/test/fixtures/auth';
import { renderRoutes, renderWithProviders } from '@/test/render';

function signedIn(signOut: () => Promise<void>) {
  return { status: 'authenticated' as const, session: testSession(), user: testUser, signOut };
}

describe('AccountControls', () => {
  it('offers sign-in when signed out', () => {
    renderWithProviders(<AccountControls />, { auth: 'signedOut' });

    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });

  it('hides the sign-in link on the sign-in page itself', () => {
    renderWithProviders(<AccountControls />, { route: '/login', auth: 'signedOut' });

    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
  });

  it('renders nothing while the session is loading', () => {
    renderWithProviders(<AccountControls />, { auth: 'loading' });

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows the account and signs out to the home page', async () => {
    const signOut = vi.fn(() => Promise.resolve());
    const { user } = renderRoutes(
      [
        { path: '/orgs', element: <AccountControls /> },
        { path: '/', element: <h1>Home</h1> },
      ],
      { route: '/orgs', auth: signedIn(signOut) },
    );

    expect(screen.getByText(String(testUser.email))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/account');
    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(signOut).toHaveBeenCalledOnce();
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
  });

  it('explains a failed sign-out', async () => {
    const signOut = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));
    const { user } = renderWithProviders(<AccountControls />, { auth: signedIn(signOut) });

    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't reach the server.");
  });
});
