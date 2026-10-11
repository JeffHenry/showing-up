# 0005: Environments and database deployments

- **Status:** Accepted (amended 2026-10-11: access token needs Connection Pooling read access)
- **Date:** 2026-10-11

## Context

Phase 0.4a created the schema and tested it against a local database. The app also needs hosted
databases: one that pull-request previews can use without risking real data, and one for
production. Schema changes must reach them in a controlled, auditable way, and the credentials
that can change a database must be as narrow as possible.

## Decision

**Two hosted Supabase projects** on the free plan, both in West US (Oregon) and created with the
same settings as the local CLI stack (Data API on, default table exposure, automatic RLS off;
migrations enable RLS explicitly and tests enforce it):

| Environment | Supabase project     | Used by                               |
| ----------- | -------------------- | ------------------------------------- |
| Staging     | `showing-up-staging` | Vercel preview deployments, E2E tests |
| Production  | `showing-up`         | https://showing-up.vercel.app         |

**Migrations are deployed by a manual workflow** (`.github/workflows/db-deploy.yml`): link the
project, list local vs remote migrations, `db push --dry-run`, then `db push`. Seed data is never
pushed to hosted projects. Deploys to one environment never run concurrently and are never
cancelled mid-run.

**Credentials live in GitHub Environments**, `supabase-staging` and `supabase-production`
(named to avoid colliding with Vercel's own `Preview`/`Production` environments; GitHub
environment names are case-insensitive). Each holds:

- `SUPABASE_PROJECT_ID` (variable, not secret)
- `SUPABASE_DB_PASSWORD` (secret; `db push` authenticates with it)
- `SUPABASE_ACCESS_TOKEN` (secret; a **scoped** personal access token with read-only Project
  Settings, API Keys, API Key Secrets, and Connection Pooling, limited to these two projects, with
  a 90-day expiry)

**Why Connection Pooling (amendment).** Supabase documents three permissions for `supabase link`,
and the first deploy failed with them. GitHub's runners have no IPv6, and a hosted project's
direct database host is IPv6-only, so the CLI must connect through the IPv4 connection pooler.
`supabase link` looks up the pooler address via the Management API's pooler-config endpoint; when
the token can't read it, `link` still reports success, and the next command fails with "IPv6 is
not supported on your current network". Adding read-only Connection Pooling access fixed it
without widening the token further.

Both environments accept runs **only from `main`**. `supabase-production` additionally requires
an approval from the repository owner before the job starts and receives its secrets. Secrets are
stored per environment rather than per repository, so pull-request CI jobs never receive them.
Environment settings are versioned in `.github/environments/`.

**Client configuration** is read through `src/lib/env.ts`, which validates `import.meta.env` with
Zod at startup and lists every problem at once. It rejects a `sb_secret_…` key in
`VITE_SUPABASE_PUBLISHABLE_KEY`, because anything prefixed `VITE_` is bundled into the browser.
Vercel provides the hosted values (Preview → staging, Production → production); `.env.example`
carries the local stack's shared development defaults.

## Consequences

- A schema change goes: PR (CI applies it to a fresh database and tests it) → merge → staging
  deploy → verify → approved production deploy.
- Merging does not change hosted databases by itself. The cost is a manual step; the benefit is
  that a production schema change is always a deliberate, approved action.
- Free-plan projects pause after about a week of inactivity; a paused staging project must be
  restored from the dashboard before previews or deploys can reach it.
- The access token must be rotated before it expires (re-create it, then update both environment
  secrets).
