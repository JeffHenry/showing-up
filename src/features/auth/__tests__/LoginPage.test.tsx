import { screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { http, HttpResponse } from 'msw';
import { useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/context/AuthProvider';
import { LoginPage } from '@/features/auth/components/LoginPage';
import { redirectTo } from '@/lib/navigation';
import { isEntryNavigation } from '@/lib/redirects';
import { queryKeys } from '@/lib/queryKeys';
import { createGate } from '@/test/gate';
import { AUTH_URL, authHandlers } from '@/test/msw/auth';
import { server } from '@/test/msw/server';
import { renderRoutes } from '@/test/render';

vi.mock('@/lib/navigation', () => ({ redirectTo: vi.fn() }));

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

// The real AuthProvider, so a successful sign-in flips the session and LoginPage redirects.
const routes = [
  {
    path: '/login',
    element: (
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    ),
  },
  { path: '/orgs', element: <Landing title="Organizations page" /> },
  { path: '/orgs/:orgId', element: <Landing title="Specific organization" /> },
];

function renderLogin(route = '/login') {
  return renderRoutes(routes, { route });
}

async function submitEmail(user: ReturnType<typeof renderLogin>['user'], email: string) {
  await user.type(await screen.findByLabelText('Email address'), email);
  await user.click(screen.getByRole('button', { name: 'Email me a sign-in code' }));
}

describe('LoginPage: email step', () => {
  it('explains a missing email, linked to the field', async () => {
    const { user } = renderLogin();

    await user.click(await screen.findByRole('button', { name: 'Email me a sign-in code' }));

    const field = screen.getByLabelText('Email address');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('Enter your email address.');
  });

  it('rejects an invalid email address', async () => {
    const { user } = renderLogin();

    await submitEmail(user, 'not-an-email');

    expect(screen.getByLabelText('Email address')).toHaveAccessibleDescription(
      'Enter a valid email address, like name@example.com.',
    );
  });

  it('disables the button while the email is sending', async () => {
    const gate = createGate();
    server.use(
      http.post(`${AUTH_URL}/otp`, async () => {
        await gate.opened;
        return HttpResponse.json({});
      }),
    );
    const { user } = renderLogin();

    await submitEmail(user, 'volunteer@example.test');

    expect(await screen.findByRole('button', { name: 'Sending…' })).toBeDisabled();
    gate.open();
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
  });

  it('shows a friendly message when emails are rate limited', async () => {
    server.use(authHandlers.sendEmailRateLimited());
    const { user } = renderLogin();

    await submitEmail(user, 'volunteer@example.test');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many attempts. Please wait a minute and try again.',
    );
  });

  it('has no detectable accessibility violations', async () => {
    const { container } = renderLogin();
    await screen.findByLabelText('Email address');

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('LoginPage: code step', () => {
  it('moves focus to the code field once the email is sent', async () => {
    server.use(authHandlers.sendEmailOk());
    const { user } = renderLogin();

    await submitEmail(user, 'volunteer@example.test');

    expect(await screen.findByLabelText('6-digit code')).toHaveFocus();
    expect(screen.getByText('volunteer@example.test')).toBeInTheDocument();
  });

  it('validates the code format before calling the server', async () => {
    server.use(authHandlers.sendEmailOk());
    const { user } = renderLogin();
    await submitEmail(user, 'volunteer@example.test');

    await user.type(await screen.findByLabelText('6-digit code'), '12ab');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByLabelText('6-digit code')).toHaveAccessibleDescription(
      'Enter the 6-digit code from your email.',
    );
  });

  it('explains an expired or wrong code', async () => {
    server.use(authHandlers.sendEmailOk(), authHandlers.verifyExpired());
    const { user } = renderLogin();
    await submitEmail(user, 'volunteer@example.test');

    await user.type(await screen.findByLabelText('6-digit code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That code or link is invalid or has expired.',
    );
  });

  it('signs in with the code and returns to the requested page', async () => {
    server.use(authHandlers.sendEmailOk(), authHandlers.verifyOk());
    const { user } = renderLogin('/login?next=%2Forgs%2F42');
    await submitEmail(user, 'volunteer@example.test');

    await user.type(await screen.findByLabelText('6-digit code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByRole('heading', { name: 'Specific organization' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Arrived')).toBeInTheDocument();
  });

  it('can resend the code or go back to change the email', async () => {
    server.use(authHandlers.sendEmailOk());
    const { user } = renderLogin();
    await submitEmail(user, 'volunteer@example.test');

    await user.click(await screen.findByRole('button', { name: 'Send a new code' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'A new code is on its way to volunteer@example.test.',
    );

    await user.click(screen.getByRole('button', { name: 'Use a different email' }));
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
  });
});

describe('LoginPage: from an invite link', () => {
  it('explains that signing in accepts the invitation', async () => {
    renderLogin('/login?next=%2Finvite%2Fabc123');

    expect(
      await screen.findByRole('heading', { name: 'Sign in to accept your invitation' }),
    ).toBeInTheDocument();
  });
});

describe('LoginPage: Google', () => {
  it("sends the browser to Google's consent screen via Supabase", async () => {
    const { user } = renderLogin('/login?next=%2Forgs');

    await user.click(await screen.findByRole('button', { name: 'Continue with Google' }));

    expect(redirectTo).toHaveBeenCalledOnce();
    const url = new URL(vi.mocked(redirectTo).mock.calls[0]?.[0] ?? '');
    expect(`${url.origin}${url.pathname}`).toBe(`${AUTH_URL}/authorize`);
    expect(url.searchParams.get('provider')).toBe('google');
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    expect(url.searchParams.get('redirect_to')).toBe(
      'http://localhost:3000/auth/callback?next=%2Forgs',
    );
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeDisabled();
  });
});

describe('LoginPage: already signed in', () => {
  it('skips the form and goes to the requested page', async () => {
    renderRoutes(
      [
        { path: '/login', element: <LoginPage /> },
        { path: '/orgs', element: <Landing title="Organizations page" /> },
      ],
      { route: '/login', auth: 'signedIn' },
    );

    expect(await screen.findByRole('heading', { name: 'Organizations page' })).toBeInTheDocument();
    expect(screen.getByText('Arrived')).toBeInTheDocument();
  });
});

describe('LoginPage: available providers', () => {
  async function renderAndSettle(expected: 'success' | 'error') {
    const view = renderLogin();
    await waitFor(() => {
      expect(view.queryClient.getQueryState(queryKeys.auth.providers())?.status).toBe(expected);
    });
    return view;
  }

  it('offers Google where it is enabled', async () => {
    renderLogin();

    expect(await screen.findByRole('button', { name: 'Continue with Google' })).toBeEnabled();
    expect(screen.getByText(/use your email or google account/i)).toBeInTheDocument();
  });

  it('hides Google where the provider is turned off (e.g. local development)', async () => {
    server.use(authHandlers.settings({ google: false }));

    await renderAndSettle('success');

    expect(screen.queryByRole('button', { name: 'Continue with Google' })).not.toBeInTheDocument();
    expect(screen.queryByText('or')).not.toBeInTheDocument();
    expect(screen.getByText(/use your email address/i)).toBeInTheDocument();
  });

  it('still offers email sign-in if provider settings cannot be loaded', async () => {
    server.use(authHandlers.settingsUnavailable());

    await renderAndSettle('error');

    expect(screen.queryByRole('button', { name: 'Continue with Google' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Email me a sign-in code' })).toBeEnabled();
  });
});
