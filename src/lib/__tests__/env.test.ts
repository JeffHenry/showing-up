import { describe, expect, it } from 'vitest';
import { env, parseEnv } from '@/lib/env';

const valid = {
  VITE_SUPABASE_URL: 'https://example.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abc123',
};

describe('parseEnv', () => {
  it('returns typed values for a valid environment', () => {
    expect(parseEnv(valid)).toEqual(valid);
  });

  it('accepts the local Supabase stack URL', () => {
    expect(() => parseEnv({ ...valid, VITE_SUPABASE_URL: 'http://127.0.0.1:54321' })).not.toThrow();
  });

  it('lists every missing variable in one error', () => {
    expect(() => parseEnv({})).toThrow(
      /VITE_SUPABASE_URL: must be an http\(s\) URL[\s\S]*VITE_SUPABASE_PUBLISHABLE_KEY: is required/,
    );
  });

  it('rejects a URL that is not http(s)', () => {
    expect(() => parseEnv({ ...valid, VITE_SUPABASE_URL: 'ftp://example.supabase.co' })).toThrow(
      /VITE_SUPABASE_URL/,
    );
  });

  it('rejects a secret key placed in the browser-exposed publishable variable', () => {
    expect(() => parseEnv({ ...valid, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_abc123' })).toThrow(
      /must be a Supabase publishable key/,
    );
  });

  it('points developers to .env.example', () => {
    expect(() => parseEnv({})).toThrow(/See \.env\.example/);
  });
});

describe('env', () => {
  it('is validated from the Vite environment at import time', () => {
    expect(env).toEqual({
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    });
  });
});
