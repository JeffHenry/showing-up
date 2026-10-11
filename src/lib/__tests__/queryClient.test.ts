import { describe, expect, it } from 'vitest';
import { createQueryClient } from '@/lib/queryClient';

describe('createQueryClient', () => {
  it('applies the app-wide query caching defaults', () => {
    const { queries } = createQueryClient().getDefaultOptions();

    expect(queries).toMatchObject({
      staleTime: 30_000,
      gcTime: 300_000,
      retry: 1,
      networkMode: 'offlineFirst',
    });
  });

  it('does not retry mutations', () => {
    expect(createQueryClient().getDefaultOptions().mutations?.retry).toBe(0);
  });

  it('returns a new client on every call so caches are never shared', () => {
    expect(createQueryClient()).not.toBe(createQueryClient());
  });
});
