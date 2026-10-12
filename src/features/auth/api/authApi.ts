import { z } from 'zod';
import { env } from '@/lib/env';
import { redirectTo } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';

const authSettingsSchema = z.object({
  external: z.object({ google: z.boolean().optional() }),
});

export interface AuthProviders {
  google: boolean;
}

/**
 * Which sign-in providers this environment has enabled, from Supabase Auth's public settings.
 * Lets the UI hide Google where it isn't configured (e.g. local development) instead of
 * sending people to an error page.
 */
export async function fetchAuthProviders(): Promise<AuthProviders> {
  const response = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/settings`, {
    headers: { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY },
  });
  if (!response.ok) throw new Error(`Auth settings request failed (${String(response.status)})`);
  const settings = authSettingsSchema.parse(await response.json());
  return { google: settings.external.google === true };
}

/**
 * Where Supabase sends people after email or Google sign-in. Always includes `?next=`, which the
 * sign-in email template relies on: it appends `&token_hash=…` to this URL.
 */
function callbackUrl(next: string): string {
  const url = new URL('/auth/callback', window.location.origin);
  url.searchParams.set('next', next);
  return url.toString();
}

/** Emails a 6-digit code and a sign-in link; creates the account on first sign-in. */
export async function sendSignInEmail({ email, next }: { email: string; next: string }) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callbackUrl(next), shouldCreateUser: true },
  });
  if (error) throw error;
}

/** Signs in with the 6-digit code typed by the user. */
export async function verifyEmailCode({ email, code }: { email: string; code: string }) {
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
  if (error) throw error;
}

/** Signs in with the token hash from the email's link (works on any device). */
export async function verifyEmailLink(tokenHash: string) {
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email' });
  if (error) throw error;
}

/** Completes Google sign-in: trades the one-time code for a session (PKCE). */
export async function exchangeOAuthCode(code: string) {
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
}

/** Starts Google sign-in and leaves the app for Google's consent screen. */
export async function startGoogleSignIn(next: string) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: callbackUrl(next), skipBrowserRedirect: true },
  });
  if (error) throw error;
  redirectTo(data.url);
}
