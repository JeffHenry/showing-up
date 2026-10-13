import { describe, expect, it, vi } from 'vitest';
import { hasStoredSession } from '@/lib/session';

describe('hasStoredSession', () => {
  it('finds a stored Supabase session', () => {
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('sb-feavqqiqhoysfiqrxjxb-auth-token', '{}');

    expect(hasStoredSession()).toBe(true);
  });

  it('ignores other keys, including a stored PKCE verifier', () => {
    localStorage.setItem('sb-feavqqiqhoysfiqrxjxb-auth-token-code-verifier', 'abc');

    expect(hasStoredSession()).toBe(false);
  });

  it('treats unavailable storage as signed out', () => {
    vi.spyOn(Storage.prototype, 'key').mockImplementation(() => {
      throw new DOMException('Access denied', 'SecurityError');
    });
    localStorage.setItem('sb-x-auth-token', '{}');

    expect(hasStoredSession()).toBe(false);
  });
});
