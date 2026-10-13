# 0009: Invites

- **Status:** Accepted
- **Date:** 2026-10-13

## Context

Memberships can't be inserted directly (ADR 0004), so until now an organization's only member was
its creator. Coordinators need a way to bring volunteers in, and owners a way to add coordinators,
without either being able to grant themselves or others more than their own role allows. Invites
travel as links (in a text, an email, a group chat), so a link must be safe to see in transit and
useless once it has done its job.

## Decision

1. **Single-use links that expire after 7 days.** Each link admits one person. A forwarded link
   can't let in a crowd, and a leaked one stops working once used or expired. Coordinators create
   one link per person; the UI makes "create another" one click.
2. **The database generates tokens and stores only their hash.** `create_invite()` takes 32 random
   bytes from `pgcrypto`, returns them once as a 43-character URL-safe token, and stores only the
   SHA-256 hash. The browser never chooses a token, the hash column isn't readable through the API
   (column-level grants), and a database leak doesn't reveal working links.
3. **Role tiers in the database.** Owners can invite coordinators and volunteers; coordinators
   only volunteers; nobody is invited as an owner (ownership changes belong to member management).
   The Members page hides what a role can't do, but `create_invite()` enforces it.
4. **Redemption is single-use under concurrency and idempotent for members.** `redeem_invite()`
   locks the invite row (`FOR UPDATE`) before checking it, so two people can't both use one link.
   Someone who is already a member is sent to the organization without consuming the invite and
   without any change to their role.
5. **Invitees sign in before seeing anything.** `/invite/:token` sits behind sign-in, and the
   login page says why ("Sign in to accept your invitation"). This keeps a baseline rule intact:
   signed-out users can't execute any database function. A public preview of the organization's
   name wasn't worth the first exception.
6. **Revoking deletes the invite**, so the link simply stops existing. At most 25 invites can be
   pending per organization, enforced under a lock like the organization limit (ADR 0008).

## Consequences

- Tokens appear in URLs, so they can end up in browser history and hosting logs. That's accepted
  because each one is single-use and short-lived; after joining, the app replaces the history entry
  so Back doesn't return to the link.
- A coordinator inviting twenty volunteers creates twenty links. Reusable group links (with a use
  cap) are a possible later addition if that proves tedious.
- Invites are copied and shared by hand for now; sending them by email arrives with the email
  features in P1.
- The Members page manages invites only. Listing members and changing roles comes with member
  management, once people can set a display name.
