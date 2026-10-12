import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OrgContext } from '@/context/orgContext';
import { useOrg } from '@/context/useOrg';
import { organizationOf, testOrg } from '@/test/fixtures/orgs';

describe('useOrg', () => {
  it('returns the current organization and role', () => {
    const value = { org: organizationOf(testOrg), role: 'coordinator' as const };

    const { result } = renderHook(useOrg, {
      wrapper: ({ children }) => <OrgContext value={value}>{children}</OrgContext>,
    });

    expect(result.current).toBe(value);
  });

  it('throws when used outside an organization route', () => {
    // React logs the error before rethrowing; keep the test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(useOrg)).toThrow(
      'useOrg must be used inside an organization route (<OrgLayout>).',
    );
  });
});
