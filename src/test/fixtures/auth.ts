import type { Session, User } from '@supabase/supabase-js';

export const testUser: User = {
  id: '00000000-0000-0000-0000-0000000000aa',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'volunteer@example.test',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {},
  created_at: '2026-10-11T00:00:00Z',
};

/** A session shaped like Supabase Auth's token responses (verify, token exchange). */
export function testSession(user: User = testUser): Session {
  return {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user,
  };
}
