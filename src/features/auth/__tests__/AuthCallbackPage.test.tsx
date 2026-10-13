import { screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { http, HttpResponse } from 'msw';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from '@/context/AuthProvider';
import { AuthCallbackPage } from '@/features/auth/components/AuthCallbackPage';
import { isEntryNavigation } from '@/lib/redirects';
import { supabase } from '@/lib/supabase';
import { testSession } from '@/test/fixtures/auth';
import { AUTH_URL, authHandlers } from '@/test/msw/auth';
import { server } from '@/test/msw/server';
import { renderRoutes } from '@/test/render';

/** Stands in for the page after sign-in, reporting whether it was reached as an arrival at the app. */
function Landing({ title }: { title: string }) {
  const location = useLocation();
  return (
    <>
      <h1>{title}</h1>
      <p>{isEntryNavigation(location.state) ? 'Arrived' : 'Not an arrival'}</p>
    </>
  );
}

const routes = [
  {
    path: '/auth/callback',
    element: (
      <AuthProvider>
        <AuthCallbackPage />
      </AuthProvider>
    ),
  },
  { path: '/orgs', element: <Landing title="Organizations page" /> },
];

function renderCallback(query: string) {
  return renderRoutes(routes, { route: `/auth/callback?${query}` });
}

describe('AuthCallbackPage', () => {
  it('signs in with an email link and continues to the requested page', async () => {
    server.use(authHandlers.verifyOk());

    renderCallback('next=%2Forgs&token_hash=abc123&type=email');

    expect(await screen.findByRole('heading', { name: 'Organizations page' })).toBeInTheDocument();
    expect(screen.getByText('Arrived')).toBeInTheDocument();
  });

  it('completes Google sign-in by exchanging the code with the stored PKCE verifier', async () => {
    // Start the flow first, as the login page would, so the client stores a code verifier.
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { skipBrowserRedirect: true },
    });
    let body: Record<string, unknown> = {};
    server.use(
      http.post(`${AUTH_URL}/token`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(testSession());
      }),
    );

    renderCallback('next=%2Forgs&code=google-code');

    expect(await screen.findByRole('heading', { name: 'Organizations page' })).toBeInTheDocument();
    expect(body.auth_code).toBe('google-code');
    expect(body.code_verifier).toEqual(expect.any(String));
  });

  it('explains an expired or already-used email link and links back to sign in', async () => {
    server.use(authHandlers.verifyExpired());

    renderCallback('next=%2Forgs&token_hash=used&type=email');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That code or link is invalid or has expired.',
    );
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute(
      'href',
      '/login?next=%2Forgs',
    );
  });

  it('explains an error returned by the sign-in provider', async () => {
    renderCallback('error=access_denied&error_code=otp_expired&error_description=Link+expired');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That code or link is invalid or has expired.',
    );
  });

  it('handles a callback with nothing to verify', async () => {
    renderCallback('next=%2Forgs');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't finish signing you in from this browser.",
    );
  });

  it('has no detectable accessibility violations in the error state', async () => {
    const { container } = renderCallback('next=%2Forgs');
    await screen.findByRole('alert');

    expect(await axe(container)).toHaveNoViolations();
  });
});
