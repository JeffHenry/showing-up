-- =============================================================================
-- Shifts: blocks of time an organization needs volunteers for.
--
--   * Every member can see their organization's shifts; coordinators and owners create,
--     edit, cancel and delete them.
--   * A shift locks once it starts: edits, cancelling and deleting are refused, so the
--     record matches what happened (hours and reports will rely on it).
--   * New or moved shifts must start in the future and at most a year ahead, which
--     catches typos like the year 2062.
--   * Cancelling keeps the shift (volunteers need to see it was called off); deleting is
--     for mistakes. Cancelling happens only through cancel_shift().
--   * version increases with every change, so the app can save "only if nobody else
--     changed it since I loaded it" (optimistic concurrency) and never lose an edit.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table
-- -----------------------------------------------------------------------------

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  description text check (char_length(btrim(description)) between 1 and 2000),
  location text check (char_length(btrim(location)) between 1 and 200),
  start_time timestamptz not null,
  end_time timestamptz not null,
  capacity integer not null check (capacity between 1 and 500),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete set null,
  cancel_reason text check (char_length(btrim(cancel_reason)) between 1 and 500),
  check (end_time > start_time),
  check (end_time - start_time <= interval '24 hours'),
  check (cancelled_at is not null or (cancelled_by is null and cancel_reason is null))
);
comment on table public.shifts is 'Blocks of time an organization needs volunteers for. Locked once they start.';
comment on column public.shifts.location is 'Where the shift happens; optional for single-site organizations.';
comment on column public.shifts.capacity is 'How many volunteers the shift needs.';
comment on column public.shifts.version is 'Increases on every change; the app saves edits only if it still matches.';
comment on column public.shifts.cancelled_at is 'When the shift was called off; null while it''s on. Set by cancel_shift().';
comment on column public.shifts.cancel_reason is 'Optional note for volunteers about why the shift was cancelled.';

-- Lists page through an organization's shifts by (start_time, id); org_id leads, so it
-- also covers the foreign key.
create index shifts_org_id_start_time_id_idx on public.shifts (org_id, start_time, id);
create index shifts_created_by_idx on public.shifts (created_by);
create index shifts_cancelled_by_idx on public.shifts (cancelled_by);

-- -----------------------------------------------------------------------------
-- Trigger: scheduling rules and the version counter
--
-- The rules apply to people using the app (auth.uid() is set). Maintenance and seed
-- scripts run without a signed-in user, so they can record past shifts for demo history.
-- security definer: it checks the organization still exists regardless of RLS.
-- -----------------------------------------------------------------------------

create function private.shifts_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_app_request boolean := (select auth.uid()) is not null;
begin
  if tg_op = 'DELETE' then
    -- Deleting the whole organization removes its shifts too, history included.
    if v_is_app_request
      and old.start_time <= now()
      and exists (select 1 from public.organizations o where o.id = old.org_id)
    then
      raise exception using
        errcode = 'P0001',
        message = 'SHIFT_STARTED',
        detail = 'This shift has started, so it can''t be deleted.';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    -- Only changes to the shift itself count: a foreign key clearing created_by or
    -- cancelled_by (someone's account was deleted) must not trip the rules.
    if v_is_app_request
      and (new.title, new.description, new.location, new.start_time, new.end_time,
           new.capacity, new.cancelled_at, new.cancel_reason)
        is distinct from
          (old.title, old.description, old.location, old.start_time, old.end_time,
           old.capacity, old.cancelled_at, old.cancel_reason)
    then
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

    new.version := old.version + 1;
    new.updated_at := now();
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

create trigger shifts_guard
  before insert or update or delete on public.shifts
  for each row execute function private.shifts_guard();

-- -----------------------------------------------------------------------------
-- RPC: cancel a shift. It stays visible, marked cancelled, with an optional reason.
-- -----------------------------------------------------------------------------

create function public.cancel_shift(p_shift_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_shift public.shifts;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'NOT_AUTHENTICATED',
      detail = 'Sign in to cancel shifts.';
  end if;

  -- Lock the shift so a concurrent edit or cancel waits for this one.
  select * into v_shift
  from public.shifts s
  where s.id = p_shift_id
  for update;

  -- Missing and not-allowed look the same, so the answer doesn't reveal other
  -- organizations' shifts.
  if not found
    or not private.has_org_role(v_shift.org_id, array['owner', 'coordinator']::public.membership_role[])
  then
    raise exception using
      errcode = '42501',
      message = 'NOT_AUTHORIZED',
      detail = 'You can''t cancel this shift.';
  end if;

  if v_shift.start_time <= now() then
    raise exception using
      errcode = 'P0001',
      message = 'SHIFT_STARTED',
      detail = 'This shift has started, so it can''t be cancelled.';
  end if;

  if v_shift.cancelled_at is not null then
    raise exception using
      errcode = 'P0001',
      message = 'SHIFT_CANCELLED',
      detail = 'This shift is already cancelled.';
  end if;

  update public.shifts s
  set cancelled_at = now(),
      cancelled_by = v_user_id,
      cancel_reason = nullif(btrim(p_reason), '')
  where s.id = p_shift_id;
end;
$$;
comment on function public.cancel_shift is
  'Cancels a shift that hasn''t started (coordinators and owners). The shift stays visible as cancelled.';

-- -----------------------------------------------------------------------------
-- Function privileges
-- -----------------------------------------------------------------------------

revoke all on function
  private.shifts_guard(),
  public.cancel_shift(uuid, text)
from public, anon;

grant execute on function public.cancel_shift(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Table privileges and row-level security
--
-- Down to the column: the app can never set who created a shift, its version, or its
-- cancellation fields directly, nor move a shift to another organization.
-- -----------------------------------------------------------------------------

revoke all on public.shifts from anon, authenticated;
grant select,
  insert (org_id, title, description, location, start_time, end_time, capacity),
  update (title, description, location, start_time, end_time, capacity),
  delete
  on public.shifts to authenticated;

alter table public.shifts enable row level security;

create policy "shifts: members can read"
  on public.shifts for select to authenticated
  using (private.is_org_member(org_id));

create policy "shifts: coordinators and owners can create"
  on public.shifts for insert to authenticated
  with check (private.has_org_role(org_id, array['owner', 'coordinator']::public.membership_role[]));

create policy "shifts: coordinators and owners can edit"
  on public.shifts for update to authenticated
  using (private.has_org_role(org_id, array['owner', 'coordinator']::public.membership_role[]))
  with check (private.has_org_role(org_id, array['owner', 'coordinator']::public.membership_role[]));

create policy "shifts: coordinators and owners can delete"
  on public.shifts for delete to authenticated
  using (private.has_org_role(org_id, array['owner', 'coordinator']::public.membership_role[]));
