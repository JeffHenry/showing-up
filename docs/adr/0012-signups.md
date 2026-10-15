# 0012: Signups

- **Status:** Accepted
- **Date:** 2026-10-15

## Context

With shifts in place (ADR 0011), members need to claim spots. This is the app's one write that
many people race for: two volunteers tapping "Sign up" for the last spot at the same moment must
not both get it. The spec asks for `claim_shift()` and `cancel_signup()` database functions,
optimistic UI with rollback, and a typed "shift full" error.

ADR 0011 left open questions for this feature: what happens to signups when a shift is deleted or
cancelled, whether capacity can drop below the people signed up, whether volunteers can book
overlapping shifts, and what happens to the signups of someone who leaves.

## Decision

1. **Signups are written only by database functions.** The `signups` table is read-only through
   the API. `claim_shift()` and `cancel_signup()` (security definer) apply every rule, so a client
   calling the API directly gets exactly what the UI gets.
2. **`claim_shift()` locks before it checks.** It takes the shift row with `SELECT … FOR UPDATE`,
   so concurrent claims for the same shift queue up and each sees the claims before it: two
   people can't both take the last spot (`SHIFT_FULL`). It then locks the claimant's own profile
   row, so two overlapping shifts claimed at the same moment can't both pass the double-booking
   check. Every claim takes the locks in the same order (shift, then profile), so they can't
   deadlock on each other.
3. **No double-booking.** A claim that overlaps another confirmed signup is refused
   (`SCHEDULE_CONFLICT`, naming the other shift). Back-to-back shifts are fine, and cancelled
   shifts don't count.
4. **Volunteers see counts; coordinators see names.** Each shift carries a `confirmed_count`
   kept by a trigger on signups (not writable through the API), so every member sees "3 of 8
   filled" without reading other people's signups. Row-level security shows volunteers only
   their own signups and coordinators and owners everyone's, on a "Who's coming" list.
5. **Signups lock with the shift.** Volunteers can drop out, and coordinators and owners can
   remove someone (after a confirmation), until the shift starts. Coordinators don't add people:
   members claim spots themselves.
6. **Shift changes respect signups.** A shift with confirmed signups can't be deleted
   (`SHIFT_HAS_SIGNUPS`; the UI offers cancelling instead), and capacity can't drop below the
   people signed up (`CAPACITY_BELOW_SIGNUPS`). Signups never bump a shift's `version`, so they
   don't make a coordinator's edit look like a conflict.
7. **Cancelling a shift keeps its signups** (amending ADR 0011, which planned to cancel them).
   The shift's own "Cancelled" status is what tells volunteers it's off, and a person's shifts
   can still show it.
8. **Leaving cancels upcoming signups.** When someone leaves an organization or is removed, a
   trigger cancels their signups there for shifts that haven't started; started ones remain as
   history.
9. **Optimistic UI with rollback.** Sign up and Drop out update the shift's page at once
   (`onMutate` snapshot), roll back if the server refuses (`onError`), and refresh from the
   server either way (`onSettled`). Shift lists and pages are never treated as fresh in the
   cache, so opening one or returning to the window re-checks the counts.
10. **No waitlist yet.** A full shift says so. The status type is `confirmed | cancelled`; a
    waitlist with automatic promotion (P2) adds `waitlisted`.

## Consequences

- The last spot is race-free by construction, and the rules hold for any client.
- `confirmed_count` is denormalized; a trigger keeps it right and a check constraint keeps it at
  or below capacity.
- People aren't notified when a coordinator removes them or a shift changes until email features
  arrive (P1); the confirmation dialogs say so.
- A page left open doesn't update when others sign up; live counts are planned with Supabase
  Realtime (P2).
