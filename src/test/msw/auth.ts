import { http, HttpResponse } from 'msw';
import { testSession } from '@/test/fixtures/auth';

/** Supabase Auth endpoints as the real client calls them in tests (see vite.config.ts env). */
export const AUTH_URL = 'http://localhost:54321/auth/v1';

/** An error body in Supabase Auth's format (the client reads `error_code`). */
function authError(status: number, errorCode: string, msg: string) {
  return HttpResponse.json({ code: status, error_code: errorCode, msg }, { status });
}

export const authHandlers = {
  /** Public Auth settings, as `/auth/v1/settings` returns them. */
  settings: ({ google }: { google: boolean }) =>
    http.get(`${AUTH_URL}/settings`, () =>
      HttpResponse.json({ external: { email: true, google }, disable_signup: false }),
    ),
  settingsUnavailable: () =>
    http.get(`${AUTH_URL}/settings`, () => new HttpResponse(null, { status: 503 })),
  sendEmailOk: () => http.post(`${AUTH_URL}/otp`, () => HttpResponse.json({})),
  sendEmailRateLimited: () =>
    http.post(`${AUTH_URL}/otp`, () =>
      authError(429, 'over_email_send_rate_limit', 'email rate limit exceeded'),
    ),
  verifyOk: () => http.post(`${AUTH_URL}/verify`, () => HttpResponse.json(testSession())),
  verifyExpired: () =>
    http.post(`${AUTH_URL}/verify`, () =>
      authError(403, 'otp_expired', 'Token has expired or is invalid'),
    ),
  exchangeCodeOk: () => http.post(`${AUTH_URL}/token`, () => HttpResponse.json(testSession())),
  signOutOk: () => http.post(`${AUTH_URL}/logout`, () => new HttpResponse(null, { status: 204 })),
};
