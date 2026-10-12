# Runbook: authentication setup

Sign-in configuration that lives outside the repository: the email provider (Resend), Google
OAuth, and each hosted Supabase project's Auth settings. Local development needs none of this; the
local stack reads [`supabase/config.toml`](../../supabase/config.toml) and delivers email to
Mailpit (http://127.0.0.1:54324). Rationale: [ADR 0007](../adr/0007-authentication.md).

**Secrets** (Resend API keys, Google client secrets) go straight from the provider into the
Supabase dashboard or a password manager. They never go into this repository or chat.

## Environments

|                         | Staging                                                                               | Production                                |
| ----------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------- |
| Supabase project        | `showing-up-staging` (`lrhqhhqzqnfvxwhyjras`)                                         | `showing-up` (`feavqqiqhoysfiqrxjxb`)     |
| Used by                 | Vercel preview deployments                                                            | https://showing-up.vercel.app             |
| Site URL                | `https://showing-up.vercel.app`                                                       | `https://showing-up.vercel.app`           |
| Redirect URLs (allowed) | `https://showing-up.vercel.app/**`, `https://showing-up-*-jeffreyhenry.vercel.app/**` | `https://showing-up.vercel.app/**`        |
| Resend API key          | `supabase-staging` (sending only, `send.jeffreyhenry.me`)                             | `supabase-production` (same restrictions) |
| Google OAuth client     | `ShowingUp staging`                                                                   | `ShowingUp production`                    |

The app passes its own origin as the email/OAuth redirect (`/auth/callback?next=…`), so a
preview's emails link back to that preview. If a redirect isn't in the allow-list, Supabase
silently falls back to the Site URL and the email link breaks; check the allow-list first when a
link misbehaves.

## 1. Resend (email delivery)

1. Add domain **`send.jeffreyhenry.me`** and create the DNS records Resend lists (MX + SPF TXT for
   bounces, DKIM TXT), plus DMARC `_dmarc.send` → `v=DMARC1; p=none;`. Verify in Resend.
2. Create **two API keys**, `supabase-staging` and `supabase-production`, each with
   **Sending access** restricted to `send.jeffreyhenry.me`. A leaked key can only send from that
   domain, and either environment can be revoked independently.

## 2. Google Cloud (Google sign-in)

1. Project **ShowingUp**. **Google Auth Platform / OAuth consent screen**:
   - **Branding:** app name ShowingUp; support and developer email; home page
     `https://showing-up.vercel.app`; privacy policy `https://showing-up.vercel.app/privacy` (the
     app's [privacy page](../../src/app/routes/PrivacyPage.tsx)); authorized domains
     `showing-up.vercel.app`, `lrhqhhqzqnfvxwhyjras.supabase.co`, `feavqqiqhoysfiqrxjxb.supabase.co`.
     **No logo:** uploading one triggers Google's manual brand verification.
   - **Audience:** External. While the privacy page isn't live, stay in **Testing** with your own
     account as a test user; then **Publish app**. Google requires the home page, privacy policy,
     and support email before publishing.
   - **Data access:** scopes `openid`, `email`, `profile` only. These basic scopes don't require
     Google verification.
2. **Credentials → OAuth client ID → Web application**, twice:
   - `ShowingUp staging`: Authorized redirect URI
     `https://lrhqhhqzqnfvxwhyjras.supabase.co/auth/v1/callback`
   - `ShowingUp production`: Authorized redirect URI
     `https://feavqqiqhoysfiqrxjxb.supabase.co/auth/v1/callback`
3. Known limitation: Google's consent screen names the `<ref>.supabase.co` domain. Showing the
   app's own domain requires Supabase's paid custom-domain add-on.

## 3. Supabase (each hosted project)

**Authentication → Sign In / Providers**

- **Email:** enabled; _Confirm email_ on; email OTP length **6**, expiry **900** seconds.
- **Google:** enabled; client ID and secret from that environment's OAuth client.

**Authentication → Emails**

- **SMTP settings:** enable custom SMTP. Host `smtp.resend.com`, port `465`, username `resend`,
  password = that environment's Resend API key. Sender email `no-reply@send.jeffreyhenry.me`,
  sender name `ShowingUp`.
- **Templates → Magic Link** and **Confirm signup:** subject `Your ShowingUp sign-in code`; body =
  the full contents of [`supabase/templates/sign-in.html`](../../supabase/templates/sign-in.html).
  Re-paste whenever that file changes.

**Authentication → Rate Limits:** emails sent per hour **30** (only adjustable once custom SMTP is
on).

**Authentication → URL Configuration:** Site URL and redirect URLs from the table above.

## Verify

1. On a preview (staging) or production, request a sign-in email to an inbox you control.
2. The email arrives from `ShowingUp <no-reply@send.jeffreyhenry.me>`; in the message source,
   `SPF`, `DKIM`, and `DMARC` all show `pass`.
3. The code signs you in; the link signs you in, including when opened on a different device.
4. "Continue with Google" returns to the app signed in.

## Rotate

- **Resend key:** create a new key with the same restrictions, update that project's SMTP
  password, send a test email, then delete the old key.
- **Google client secret:** add a new secret on the OAuth client, update that project's Google
  provider, test sign-in, then disable the old secret.
