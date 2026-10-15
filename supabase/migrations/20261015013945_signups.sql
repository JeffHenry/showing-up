-- =============================================================================
-- Signups: members claiming spots on shifts.
--
--   * Claiming and dropping out happen only through claim_shift() and cancel_signup();
--     nobody writes signups directly.
--   * claim_shift() locks the shift row, so concurrent claims queue up and two people can
--     never both take the last spot. It also refuses a shift that overlaps one the person
--     already claimed.
--   * Each shift keeps a count of confirmed signups (confirmed_count), so lists can show
--     "3 of 8 filled" while volunteers still read only their own signups.
--   * Signups lock with the shift once it starts. Members who leave (or are removed) lose
--     their upcoming signups; history stays.
--   * Shifts with confirmed signups can't be deleted (cancel them instead), and capacity
--     can't drop below the people already signed up.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Types and tables
-- -----------------------------------------------------------------------------

-- A waitlist (P2) will add 'waitlisted'.
create type public.signup_status as enum ('confirmed', 'cancelled');

alter table public.shifts
  add column confirmed_count integer not null default 0 check (confirmed_count >= 0),
  add constraint shifts_confirmed_within_capacity check (confirmed_count <= capacity);
comment on column public.shifts.confirmed_count is
  'How many people are signed up (confirmed). Maintained by a trigger on signups.';

create table public.signups (
  id uuid primary key default gen_random_uuid(),
  -- Copied from the shift by claim_shift(), so policies and indexes don't need a join.
  org_id uuid not null references public.organizations (id) on delete cascade,
  shift_id uuid not null references public.shifts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.signup_status not null default 'confirmed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete set null,
  -- One row per person and shift: signing up again after dropping out reuses it.
  unique (shift_id, user_id),
  check ((status = 'cancelled') = (cancelled_at is not null))
);
comment on table public.signups is
  'Who is signed up for which shift. Written only by claim_shift() and cancel_signup().';
comment on column public.signups.cancelled_by is
  'Who dropped the signup: the volunteer, a coordinator who removed them, or nobody (system).';

-- (shift_id, user_id) is covered by the unique constraint's index.
create index signups_user_id_idx on public.signups (user_id);
create index signups_org_id_idx on public.signups (org_id);
create index signups_cancelled_by_idx on public.signups (cancelled_by);

-- -----------------------------------------------------------------------------
-- Trigger: keep shifts.confirmed_count in step with signups
-- -----------------------------------------------------------------------------

create function private.sync_confirmed_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.status = 'confirmed' then
    update public.shifts s
    set confirmed_count = s.confirmed_count - 1
    where s.id = old.shift_id;
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.status = 'confirmed' then
    update public.shifts s
    set confirmed_count = s.confirmed_count + 1
    where s.id = new.shift_id;
  end if;

  return null;
end;
$$;

create trigger signups_sync_confirmed_count
  after insert or update of status or delete on public.signups
  for each row execute function private.sync_confirmed_count();

-- -----------------------------------------------------------------------------
-- Trigger: shift rules, now aware of signups (replaces the shifts migration's version)
--
--   * Deleting a shift people are signed up for is refused: cancel it instead, so they
--     know it's off. Cancelled signups are removed with the shift.
--   * Capacity can't drop below the people already signed up.
--   * version (optimistic concurrency) changes only when the shift itself changes, not when
--     someone signs up, so signups never make an editor's save look like a conflict.
-- -----------------------------------------------------------------------------

create or replace function private.shifts_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_app_request boolean := (select auth.uid()) is not null;
  v_content_changed boolean;
begin
  if tg_op = 'DELETE' then
    -- Deleting the whole organization removes its shifts too, history and signups included.
    if not exists (select 1 from public.organizations o where o.id = old.org_id) then
      return old;
    end if;

    if v_is_app_request and old.start_time <= now() then
      raise exception using
        errcode = 'P0001',
        message = 'SHIFT_STARTED',
        detail = 'This shift has started, so it can''t be deleted.';
    end if;

    if exists (
      select 1 from public.signups su
      where su.shift_id = old.id and su.status = 'confirmed'
    ) then
      raise exception using
        errcode = 'P0001',
        message = 'SHIFT_HAS_SIGNUPS',
        detail = 'People are signed up for this shift. Cancel it instead, so they know it''s off.';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    -- Only changes to the shift itself count: signups changing confirmed_count, or a foreign
    -- key clearing created_by or cancelled_by, must not trip the rules or bump the version.
    v_content_changed :=
      (new.title, new.description, new.location, new.start_time, new.end_time,
       new.capacity, new.cancelled_at, new.cancel_reason)
      is distinct from
      (old.title, old.description, old.location, old.start_time, old.end_time,
       old.capacity, old.cancelled_at, old.cancel_reason);

    if v_is_app_request and v_content_changed then
      if old.start_time <= now() then
        raise exception using
          errcode = 'P0001',
          message = 'SHIFT_STARTED',
          detail = 'This shift has started, so it can''t be changed.';
      end if;

      if old.cancelled_at is not null then
        raise exception using
          errcode = 'P0001',
          message = 'SHIFT_CANCELLED',
          detail = 'This shift was cancelled, so it can''t be changed.';
      end if;
    end if;

    if new.capacity is distinct from old.capacity and new.capacity < new.confirmed_count then
      raise exception using
        errcode = 'P0001',
        message = 'CAPACITY_BELOW_SIGNUPS',
        detail = format(
          '%s people are signed up. Keep at least %s spots, or remove someone first.',
          new.confirmed_count, new.confirmed_count
        );
    end if;

    if v_content_changed then
      new.version := old.version + 1;
      new.updated_at := now();
    end if;
  end if;

  -- New shifts, and shifts moved to another time, must start in the future and within a year.
  if v_is_app_request
    and (tg_op = 'INSERT' or new.start_time is distinct from old.start_time)
  then
    if new.start_time <= now() then
      raise exception using
        errcode = 'P0001',
        message = 'SHIFT_IN_PAST',
        detail = 'A shift has to start in the future.';
    end if;

    if new.start_time > now() + interval '1 year' then
      raise exception using
        errcode = 'P0001',
        message = 'SHIFT_TOO_FAR',
        detail = 'Shifts can be scheduled up to a year ahead.';
    end if;
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: claim a spot on a shift.
-- -----------------------------------------------------------------------------

create function public.claim_shift(p_shift_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_shift public.shifts;
  v_conflict text;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'NOT_AUTHENTICATED',
      detail = 'Sign in to sign up for shifts.';
  end if;

  -- Lock the shift: concurrent claims for it wait here, so the capacity check below sees
  -- every earlier claim and two people can never both take the last spot.
  select * into v_shift
  from public.shifts s
  where s.id = p_shift_id
  for update;

  -- Missing and not-allowed look the same, so the answer reveals nothing about other
  -- organizations' shifts.
  if not found or not private.is_org_member(v_shift.org_id) then
    raise exception using
      errcode = '42501',
      message = 'NOT_AUTHORIZED',
      detail = 'You can''t sign up for this shift.';
  end if;

  if v_shift.cancelled_at is not null then
    raise exception using
      errcode = 'P0001',
      message = 'SHIFT_CANCELLED',
      detail = 'This shift was cancelled.';
  end if;

  if v_shift.start_time <= now() then
    raise exception using
      errcode = 'P0001',
      message = 'SHIFT_STARTED',
      detail = 'This shift has already started.';
  end if;

  -- Already signed up (a double click, or a retry): nothing to do.
  if exists (
    select 1 from public.signups su
    where su.shift_id = p_shift_id and su.user_id = v_user_id and su.status = 'confirmed'
  ) then
    return;
  end if;

  if v_shift.confirmed_count >= v_shift.capacity then
    raise exception using
      errcode = 'P0001',
      message = 'SHIFT_FULL',
      detail = 'This shift is full.';
  end if;

  -- Lock the person's profile so their own claims run one at a time: two overlapping shifts
  -- claimed at the same moment can't both pass the check below. (Shift first, then profile,
  -- in every claim, so concurrent claims can't deadlock on these locks.)
  perform 1 from public.profiles p where p.id = v_user_id for update;

  -- Back-to-back shifts are fine; overlapping ones are not. Cancelled shifts don't count.
  select s.title into v_conflict
  from public.signups su
  join public.shifts s on s.id = su.shift_id
  where su.user_id = v_user_id
    and su.status = 'confirmed'
    and s.cancelled_at is null
    and s.id <> p_shift_id
    and s.start_time < v_shift.end_time
    and s.end_time > v_shift.start_time
  order by s.start_time
  limit 1;

  if found then
    raise exception using
      errcode = 'P0001',
      message = 'SCHEDULE_CONFLICT',
      detail = format('You''re already signed up for %s at that time.', v_conflict);
  end if;

  insert into public.signups as su (org_id, shift_id, user_id)
  values (v_shift.org_id, p_shift_id, v_user_id)
  on conflict (shift_id, user_id) do update
    set status = 'confirmed',
        updated_at = now(),
        cancelled_at = null,
        cancelled_by = null;
end;
$$;
comment on function public.claim_shift is
  'Signs the caller up for a shift: members only, before it starts, while spots remain, and not overlapping another of their shifts.';

-- -----------------------------------------------------------------------------
-- RPC: drop out of a shift, or (coordinators and owners) remove someone from it.
-- -----------------------------------------------------------------------------

create function public.cancel_signup(p_shift_id uuid, p_user_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_target_id uuid := coalesce(p_user_id, v_user_id);
  v_shift public.shifts;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'NOT_AUTHENTICATED',
      detail = 'Sign in to change shift signups.';
  end if;

  -- Same lock as claim_shift(), so a spot freed here is seen by the next claim.
  select * into v_shift
  from public.shifts s
  where s.id = p_shift_id
  for update;

  if not found
    or not (
      case
        when v_target_id = v_user_id then private.is_org_member(v_shift.org_id)
        else private.has_org_role(
          v_shift.org_id, array['owner', 'coordinator']::public.membership_role[]
        )
      end
    )
  then
    raise exception using
      errcode = '42501',
      message = 'NOT_AUTHORIZED',
      detail = 'You can''t change signups for this shift.';
  end if;

  if v_shift.start_time <= now() then
    raise exception using
      errcode = 'P0001',
      message = 'SHIFT_STARTED',
      detail = 'This shift has already started, so its signups can''t change.';
  end if;

  -- Not signed up (or already dropped): nothing to do.
  update public.signups su
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = v_user_id,
      updated_at = now()
  where su.shift_id = p_shift_id
    and su.user_id = v_target_id
    and su.status = 'confirmed';
end;
$$;
comment on function public.cancel_signup is
  'Drops a signup before the shift starts: your own (p_user_id null), or anyone''s for coordinators and owners.';

-- -----------------------------------------------------------------------------
-- Trigger: someone who leaves (or is removed from) an organization loses their upcoming
-- signups there. Shifts that have started keep theirs, as history.
-- -----------------------------------------------------------------------------

create function private.cancel_signups_of_departed_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- The organization itself is being deleted: its signups go with it.
  if not exists (select 1 from public.organizations o where o.id = old.org_id) then
    return null;
  end if;

  update public.signups su
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = (select auth.uid()),
      updated_at = now()
  from public.shifts s
  where s.id = su.shift_id
    and su.org_id = old.org_id
    and su.user_id = old.user_id
    and su.status = 'confirmed'
    and s.start_time > now();

  return null;
end;
$$;

create trigger memberships_cancel_upcoming_signups
  after delete on public.memberships
  for each row execute function private.cancel_signups_of_departed_member();

-- -----------------------------------------------------------------------------
-- Function privileges
-- -----------------------------------------------------------------------------

revoke all on function
  private.sync_confirmed_count(),
  private.cancel_signups_of_departed_member(),
  public.claim_shift(uuid),
  public.cancel_signup(uuid, uuid)
from public, anon;

grant execute on function
  public.claim_shift(uuid),
  public.cancel_signup(uuid, uuid)
to authenticated;

-- -----------------------------------------------------------------------------
-- Table privileges and row-level security
--
-- Read-only through the API. Volunteers see their own signups; coordinators and owners see
-- everyone's in their organization. Everyone sees how full a shift is via confirmed_count.
-- -----------------------------------------------------------------------------

revoke all on public.signups from anon, authenticated;
grant select on public.signups to authenticated;

alter table public.signups enable row level security;

create policy "signups: read own, or all as coordinator"
  on public.signups for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.has_org_role(org_id, array['owner', 'coordinator']::public.membership_role[])
  );
