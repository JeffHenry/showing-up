# 0004: Database authorization model

- **Status:** Accepted
- **Date:** 2026-10-11

## Context

ShowingUp is multi-tenant: one person can be an owner in one organization and a volunteer in
another. The browser talks to Postgres directly through Supabase's API using a public key, so any
rule enforced only in the UI can be bypassed with a single HTTP request. Authorization therefore
has to be enforced by the database.

Four details of the platform shaped the design:

- Supabase grants the `anon` and `authenticated` roles broad table privileges by default; RLS
  then filters rows. A table without RLS, or with a permissive policy, is publicly writable.
- Policies that need to know "is this user a member?" must read `memberships`, and a policy on
  `memberships` that reads `memberships` recurses.
- A plain `INSERT … RETURNING` into `organizations` followed by a "members can read" policy fails,
  because the creator's membership doesn't exist yet when the row is returned.
- Supabase is retiring its legacy `anon` / `service_role` API keys at the end of 2026 in favour of
  publishable (`sb_publishable_…`) and secret (`sb_secret_…`) keys.

## Decision

1. **RLS on every table, enforced by a test.** A pgTAP test fails if any table in `public` lacks
   RLS, so the rule also covers tables added later.
2. **Least privilege before RLS.** `anon` has no table or function privileges. `authenticated`
   gets only the operations each table needs, with **column-level** `UPDATE` grants (for example,
   only `memberships.role` is updatable). Default privileges are changed so new tables don't
   silently grant `anon` access.
3. **No direct inserts for tenancy rows.** There are no `INSERT` grants or policies on
   `organizations` or `memberships`. `create_organization()` is a `security definer` function that
   creates the organization and the caller's owner membership in one transaction. Membership via
   invites will follow the same pattern (`redeem_invite()`).
4. **Policy helpers in a private schema.** `is_org_member()`, `has_org_role()`, and
   `shares_org_with()` are `security definer` (avoiding policy recursion), `stable`, use
   `search_path = ''` with fully qualified names, and live in a `private` schema that the API does
   not expose. Policies call `(select auth.uid())` so it is evaluated once per statement.
5. **Invariants as triggers.** A trigger keeps every organization with at least one owner. It runs
   after the change (seeing the final state of multi-row statements) and locks the organization
   row, so concurrent demotions are serialized instead of racing.
6. **Typed errors.** Errors meant for users are raised with SQLSTATE `P0001`, a stable code as the
   message (`SLUG_TAKEN`, `LAST_OWNER`), and a human-readable detail. The client maps codes to
   messages.
7. **Database-level validation.** Slugs, name lengths, and IANA time zones are enforced by `CHECK`
   constraints, so invalid data can't enter through any client.
8. **New API keys.** The client uses `VITE_SUPABASE_PUBLISHABLE_KEY`; server functions use
   `SUPABASE_SECRET_KEY`. Legacy key names are not used anywhere.

## Consequences

- Every new table needs explicit grants, RLS policies, and pgTAP tests in the same migration; the
  baseline tests fail otherwise.
- Writes that span tables are slightly more work (a function instead of two inserts) but are
  atomic and have a single place to audit.
- Deleting an auth user who is the last owner of an organization is rejected until ownership is
  transferred or the organization is deleted. This is intentional: an organization should never be
  left without someone who can manage it.
- The schema and its security rules are verified in CI on every PR (`Database` job), alongside a
  check that generated TypeScript types match the schema.
