import { describe, expect, it } from 'vitest';
import { DEFAULT_SIGNED_IN_PATH, loginPath, safeNextPath } from '@/lib/redirects';

describe('safeNextPath', () => {
  it.each([
    ['/orgs', '/orgs'],
    ['/orgs/42/shifts?view=week#today', '/orgs/42/shifts?view=week#today'],
    ['/privacy', '/privacy'],
  ])('keeps the same-site path %s', (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    ['missing', null],
    ['empty', ''],
    ['an absolute URL', 'https://evil.example/phish'],
    ['a protocol-relative URL', '//evil.example'],
    ['a backslash trick', '/\\evil.example'],
    ['a tab hidden inside //', '/\t/evil.example'],
    ['a javascript: URL', 'javascript:alert(1)'],
    ['a relative path without a leading slash', 'orgs'],
    ['the sign-in page itself', '/login?next=/orgs'],
    ['the auth callback', '/auth/callback?code=abc'],
  ])('falls back to the default for %s', (_label, input) => {
    expect(safeNextPath(input)).toBe(DEFAULT_SIGNED_IN_PATH);
  });
});

describe('loginPath', () => {
  it('encodes where to return after signing in', () => {
    expect(loginPath('/orgs/42?tab=hours')).toBe('/login?next=%2Forgs%2F42%3Ftab%3Dhours');
  });
});
