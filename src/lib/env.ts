import { z } from 'zod';

const envSchema = z.object({
  VITE_SUPABASE_URL: z.url({ protocol: /^https?$/, error: 'must be an http(s) URL' }),
  VITE_SUPABASE_PUBLISHABLE_KEY: z
    .string({ error: 'is required' })
    // Guards against pasting a secret key (sb_secret_…) into a variable that ships to browsers.
    .startsWith('sb_publishable_', {
      error: 'must be a Supabase publishable key (sb_publishable_…)',
    }),
});

export type Env = z.infer<typeof envSchema>;

/** Validates raw environment values, failing with every problem listed at once. */
export function parseEnv(source: Record<string, unknown>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${problems}\nSee .env.example.`);
  }
  return result.data;
}

/** Typed, validated client environment. Importing this fails fast if configuration is wrong. */
export const env = parseEnv(import.meta.env);
