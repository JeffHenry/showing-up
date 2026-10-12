# 0007: Authentication

- **Status:** Accepted
- **Date:** 2026-10-11

## Context

Authorization already lives in Postgres: every RLS policy and RPC identifies the caller with
`auth.uid()`, a trigger on `auth.users` creates each `profiles` row, and the pgTAP suite
impersonates users the way Supabase Auth's JWTs do (ADR 0004). The specification asks for
passwordless email sign-in and Google sign-in.

Three constraints shaped the details:

- **Better Auth** (a popular self-hosted TypeScript library) was considered. It runs inside the
  application's own backend with its own tables, and it isn't one of the third-party token issuers
  Supabase accepts for RLS (Clerk, Auth0, Firebase, Cognito, WorkOS). Adopting it would mean
  minting Supabase-compatible JWTs by hand or moving data access behind custom API functions,
  plus reworking the schema and tests.
- **PKCE magic links only work in the browser that requested them** (the code verifier is stored
  there), and some corporate mail scanners "click" links before the user does.
- **Supabase's built-in mailer is for testing:** it only delivers to project team members, at about
  two emails per hour.

## Decision

1. **Supabase Auth** for identity and sessions. No additional servers; tokens are exactly what RLS
   expects.
2. **Email sign-in sends one message with a 6-digit code and a link.** The link opens the app's
   `/auth/callback` with a `token_hash`, which the SPA verifies via `verifyOtp`. Verification
   happens in JavaScript, so the link works on any device and isn't consumed by scanners that
   only fetch the URL. The code is the universal fallback. Codes expire after 15 minutes.
3. **Google sign-in uses the OAuth PKCE flow.** The callback exchanges the code explicitly
   (`exchangeCodeForSession`) instead of relying on automatic URL detection, which keeps the flow
   visible and testable. Each environment has its own Google OAuth client.
4. **Email is delivered by Resend over SMTP** from `send.jeffreyhenry.me` (SPF, DKIM, DMARC), with
   one sending-only API key per Supabase project and a 30 emails/hour project limit.
5. **The post-sign-in redirect (`next`) only accepts same-origin relative paths**, preventing an
   open redirect through the login page.
6. **Configuration as documentation:** local settings and the email template are versioned
   (`supabase/config.toml`, `supabase/templates/sign-in.html`); hosted settings that live in
   dashboards are recorded in [`docs/runbooks/auth-setup.md`](../runbooks/auth-setup.md).

## Consequences

- Sign-in works for anyone with an email address or a Google account, in every environment.
- Hosted Auth settings and templates are applied by hand from the runbook; a change to the
  template file must be re-pasted into both projects.
- Google's consent screen shows the Supabase project domain until a paid custom domain is added.
- **Follow-up (P1):** add CAPTCHA (Cloudflare Turnstile, supported natively by Supabase Auth) to
  email sign-in, so automated requests can't exhaust the hourly email quota.
