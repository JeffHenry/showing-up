# 0010: Members and display names

- **Status:** Accepted
- **Date:** 2026-10-13

## Context

With invites live (ADR 0009), organizations have members beyond their creator, but coordinators
couldn't see who joined and owners couldn't manage anyone. The spec gives owners "manage members,
roles" and describes `/orgs/:orgId/members` as "Members + invites", without a roadmap item for it.

The blocker was names: people who sign in by email have no name (Google provides one), and email
addresses live in Supabase's private `auth.users`, which the API never exposes. A roster would
have read "Unnamed member", and shift sign-ups would hit the same wall.

## Decision

1. **Display names are required once, then editable.** After signing in, anyone without a name is
   sent to a one-field "What should we call you?" step (`RequireName`, a lazy layout route in front
   of every page that shows people to each other). The step returns to where they were headed,
   keeping the router state that marks a fresh sign-in. An Account page edits the name later. In
   the database a name is either null (not set yet) or 1-120 visible characters.
2. **Emails only for coordinators and owners.** `list_org_members()` (security definer) is the
   only path to `auth.users.email`, and it answers only an organization's coordinators and owners.
   Volunteers see names, never other members' emails. The privacy page says so.
3. **The roster is for coordinators and owners**, on the existing Members page.
4. **Owners manage members, and an organization can have several owners.** Owners change roles
   (including making someone an owner) and remove members. Ownership is handed over by promoting
   someone and stepping down; the existing last-owner trigger keeps every organization owned.
   This avoids a separate single-owner transfer flow and leaves room for a backup owner.
5. **Anyone can leave.** A self-delete policy on memberships combines with the owners' removal
   policy; the last owner is blocked by the same trigger and told to make someone else an owner.
6. **Risky changes are confirmed.** Removing a member, leaving, demotions (including stepping
   down), and making someone an owner go through an accessible confirmation dialog. Promoting a
   volunteer to coordinator applies immediately.
7. **Accepted invites stay visible** as each member's join date and a "Recently accepted" list
   (last 30 days: who, which role, when, invited by whom).
8. **Roster search and role filter live in the URL** (`?q=&role=`), read through a Zod-validated
   `useTypedSearchParams` hook, as the spec asks for filters.

## Consequences

- One extra step for email sign-ups the first time; Google sign-ups skip it.
- Emails cross into the app only for coordinators and owners, which the privacy page discloses.
- When shifts and sign-ups arrive, removing a member (or leaving) must also cancel their upcoming
  sign-ups.
- Notifying people about role changes or removal waits for email features (P1).
