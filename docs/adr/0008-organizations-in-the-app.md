# 0008: Organizations in the app

- **Status:** Accepted
- **Date:** 2026-10-12

## Context

Every feature after sign-in (invites, shifts, signups, hours) happens inside an organization, and
a person can belong to several with a different role in each. The database already models this
(ADR 0004): `organizations` and `memberships` with row-level security, and a
`create_organization()` function that creates an organization and its owner membership in one
transaction. The app needed a way to list, create, and move between organizations, and to know
the current organization and the user's role on every page beneath it.

## Decision

1. **Organization IDs in URLs** (`/orgs/:orgId`), not slugs. IDs never change, so links,
   bookmarks, and future email links survive a rename or a slug change, and no slug-to-ID lookup
   is needed. The slug is still collected (the "short name", unique) for display and future
   public pages.
2. **One query backs everything.** `useMyOrganizations()` selects the user's organizations with
   an inner join on their own membership (`memberships!inner(role)`, filtered to their user ID).
   The list page, the organization switcher, and `OrgContext` all read this single cached query,
   so they never disagree about which organizations a user has or their role in them.
3. **`OrgContext` is derived, not fetched.** `OrgLayout` (the `/orgs/:orgId` layout route) finds
   the URL's organization in that list and provides `{ org, role }`. Pages call `useOrg()`, which
   throws outside an organization route. The context holds no fetching logic, so `src/context`
   never imports from a feature.
4. **"Not found" reveals nothing.** An unknown ID and an organization the user doesn't belong to
   get the same message. Row-level security already hides the rows; the UI doesn't hint at
   which case applies.
5. **At most 2 organizations per user**, enforced in `create_organization()` (`ORG_LIMIT_REACHED`).
   The function locks the caller's profile row before counting, so concurrent requests can't race
   past the limit. Deleting an organization frees a slot.
6. **Only the organization details the app uses.** Optional description, contact email, and
   website, each checked by the database (length, email shape, `http(s)` URLs only, so a stored
   link can never be a `javascript:` URL). No tax IDs, phone numbers, or addresses; a logo,
   default location, and behavior settings will arrive with the features that need them.
7. **Straight into the only organization.** Right after signing in, a user with exactly one
   organization (most volunteers) lands in it. The sign-in pages mark that navigation with router
   state, so visiting `/orgs` later still shows the list.

## Consequences

- Organization pages need the membership list before they render; it is one small request,
  cached for every later page.
- After creating an organization, the app waits for the list to refetch before opening it, so the
  new organization's page never flashes "not found".
- `OrgLayout` loads lazily with its route: it imports the Supabase client, which stays out of the
  initial bundle (ADR 0007).
- Changing a database function's parameters means dropping and recreating it (and re-applying its
  grants), because `CREATE OR REPLACE` can't add parameters. New parameters get defaults so
  existing callers keep working.
