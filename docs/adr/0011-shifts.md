# 0011: Shifts

- **Status:** Accepted
- **Date:** 2026-10-13

## Context

Shifts are the core of the product: coordinators and owners post blocks of time an organization
needs volunteers for, and every member browses them. Sign-ups ("claim a spot") come next and
will hang off shifts, so shift rules have to keep history trustworthy and leave room for them.

Several kinds of conflict were considered up front:

- two coordinators editing the same shift at once;
- changes after a shift has started, which would rewrite what happened;
- typo'd dates (in the past, or years ahead) and impossible times around daylight saving;
- accidental duplicates, or two crews booked into the same place;
- removing a shift people are counting on.

## Decision

1. **Times are UTC instants, entered and shown in the organization's time zone.** `start_time`
   and `end_time` are `timestamptz`. The form takes a date and two wall-clock times (native
   `date`/`time` inputs) in the organization's zone, whatever the device's own, and converts them
   with `@date-fns/tz`'s `TZDate`. Formatting uses the browser's `Intl`, so plain `date-fns`
   isn't needed. An end time at or before the start time means the shift ends the next day.
2. **Daylight saving is handled explicitly.** A time skipped when clocks spring forward is an
   inline error rather than silently moved; a wall-clock 24-hour shift that clocks falling back
   stretch to 25 hours is refused, as the database would.
3. **The database enforces the scheduling rules** in a `BEFORE` trigger (`private.shifts_guard`),
   with checks for the rest:
   - new or moved shifts start in the future and at most a year ahead;
   - shifts end after they start and last at most 24 hours; capacity is 1–500;
   - **once a shift starts, it's locked**: edits, cancelling, and deleting are refused, so the
     record matches what happened (hours and reports will rely on it);
   - cancelled shifts can't be edited.

   The rules apply to requests from signed-in users (`auth.uid()` set). Seed and maintenance
   scripts run without one, so they can record past shifts for demo history. Deleting an
   organization still removes all of its shifts. The form mirrors every rule so mistakes are
   explained next to the right field, but the database has the final say.

4. **Cancel or delete.** Cancelling (`cancel_shift()`, with an optional reason) keeps the shift on
   the schedule marked cancelled, so volunteers learn it's off. Deleting is for mistakes. When
   sign-ups arrive, their foreign key will refuse deleting a shift people signed up for, pointing
   to cancelling instead, and `cancel_shift()` will cancel the sign-ups in the same transaction.
5. **Optimistic concurrency, not locking.** Every change bumps a `version` column (set by the
   trigger; not writable through the API). An edit saves with `.eq('version', loadedVersion)`;
   when no row changes, the app reads the shift again to tell "deleted", "changed by someone
   else", and "not allowed" apart. On a conflict, the form offers to load the latest version.
   The version the editor started from is a deliberate snapshot, not live query data, so a
   background refresh can't quietly make a stale edit look current.
6. **Overlaps warn, never block.** As times are entered, the form checks (debounced) for active
   shifts overlapping that time at the same location, ignoring case, or with the same title
   when there's no location. Parallel crews are normal for small nonprofits, so the warning
   mainly catches accidental duplicates; saving is always allowed.
7. **Keyset pagination with a "Load more" button.** Lists page on `(start_time, id)` (stable
   while shifts are added, unlike offsets), 20 at a time, fetching one extra row to know whether
   more exist. A button, not infinite scroll, keeps the footer reachable by keyboard; focus moves
   to the first new shift. The cursor lives in the query cache rather than the URL (the URL holds
   `?when=upcoming|past`); returning from a shift restores the loaded pages from cache and
   React Router restores the scroll position. This departs from the original routing plan, which
   put `cursor=` in the URL.
8. **Duplicate stands in for recurrence for now.** Any shift (even a past or cancelled one) can be
   copied into a prefilled form until recurring shifts arrive.

## Consequences

- Every write path has the same rules, whether it comes from this UI, another client, or a
  coordinator calling the API directly; the pgTAP suite covers each rule.
- A shift running late can't be extended once it has started. Volunteers log the minutes they
  actually worked with their hours (P1), so the schedule stays a record of the plan.
- People who signed up aren't told when a shift changes or is cancelled until email features
  arrive (P1).
- Sign-ups must add: the delete-restricting foreign key (`SHIFT_HAS_SIGNUPS`), a guard against
  lowering capacity below confirmed sign-ups, cancellation of sign-ups in `cancel_shift()` and
  when a member leaves or is removed, and a decision on volunteers' overlapping shifts.
