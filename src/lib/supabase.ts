import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import type { Database } from '@/types/database';

/**
 * The app's single Supabase client, typed against the generated schema.
 * Only feature `api/` modules should import this; components use their hooks.
 */
export const supabase = createClient<Database>(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      // PKCE: the recommended OAuth / magic-link flow for browser apps (no tokens in the URL hash).
      flowType: 'pkce',
    },
  },
);
