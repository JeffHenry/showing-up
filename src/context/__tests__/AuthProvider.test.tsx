import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/context/AuthProvider';
import { useAuth } from '@/context/useAuth';
import { verifyEmailCode } from '@/features/auth/api/authApi';
import { testUser } from '@/test/fixtures/auth';
import { authHandlers } from '@/test/msw/auth';
import { server } from '@/test/msw/server';
import { createTestQueryClient } from '@/test/render';

function Probe() {
  const { status, user, signOut } = useAuth();
  return (
    <>
      <p>status: {status}</p>
      <p>user: {user?.email ?? 'none'}</p>
      <button
        type="button"
        onClick={() => {
          void signOut();
        }}
      >
        Sign out
      </button>
    </>
  );
}

function renderProvider() {
  const queryClient = createTestQueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return { queryClient, user: userEvent.setup() };
}

describe('AuthProvider', () => {
  it('reports signed out when there is no stored session', async () => {
    renderProvider();

    expect(await screen.findByText('status: unauthenticated')).toBeInTheDocument();
    expect(screen.getByText('user: none')).toBeInTheDocument();
  });

  it('becomes authenticated after a successful sign-in', async () => {
    server.use(authHandlers.verifyOk());
    renderProvider();
    await screen.findByText('status: unauthenticated');

    await act(() => verifyEmailCode({ email: testUser.email ?? '', code: '123456' }));

    expect(await screen.findByText('status: authenticated')).toBeInTheDocument();
    expect(screen.getByText(`user: ${String(testUser.email)}`)).toBeInTheDocument();
  });

  it("signs out and clears the previous user's cached data", async () => {
    server.use(authHandlers.verifyOk(), authHandlers.signOutOk());
    const { queryClient, user } = renderProvider();
    await act(() => verifyEmailCode({ email: testUser.email ?? '', code: '123456' }));
    await screen.findByText('status: authenticated');
    queryClient.setQueryData(['organizations'], [{ name: 'Food Bank' }]);

    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByText('status: unauthenticated')).toBeInTheDocument();
    expect(queryClient.getQueryData(['organizations'])).toBeUndefined();
  });
});

describe('useAuth', () => {
  it('throws a clear error outside <AuthProvider>', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used inside <AuthProvider>.',
    );
  });
});
