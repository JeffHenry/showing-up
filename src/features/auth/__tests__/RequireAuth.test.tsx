import { screen } from '@testing-library/react';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { RequireAuth } from '@/features/auth/components/RequireAuth';
import { renderRoutes } from '@/test/render';

function LoginProbe() {
  const { search } = useLocation();
  return <p>Login page {search}</p>;
}

const routes = [
  {
    Component: RequireAuth,
    children: [{ path: '/orgs', element: <h1>Private page</h1> }],
  },
  { path: '/login', element: <LoginProbe /> },
];

describe('RequireAuth', () => {
  it('waits while the session is being read', () => {
    renderRoutes(routes, { route: '/orgs', auth: 'loading' });

    expect(screen.getByRole('status')).toHaveTextContent('Checking your sign-in…');
  });

  it('sends signed-out users to sign in, remembering where they were going', async () => {
    renderRoutes(routes, { route: '/orgs?tab=hours', auth: 'signedOut' });

    expect(await screen.findByText('Login page ?next=%2Forgs%3Ftab%3Dhours')).toBeInTheDocument();
  });

  it('renders the page for signed-in users', () => {
    renderRoutes(routes, { route: '/orgs', auth: 'signedIn' });

    expect(screen.getByRole('heading', { name: 'Private page' })).toBeInTheDocument();
  });
});
