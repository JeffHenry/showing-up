-- =============================================================================
-- Tenancy core: profiles, organizations, memberships.
--
-- Authorization is enforced here, in the database. The UI only mirrors these rules.
--   * Every table has row-level security (RLS) enabled.
--   * Internal helpers live in the `private` schema, which the API does not expose.
--   * Writes that must happen together (create org + owner membership) go through
--     a single security-definer function instead of direct inserts.
--   * Errors meant for the app use SQLSTATE P0001 with a machine-readable code as the
--     message (e.g. LAST_OWNER) and a human-readable detail.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Secure defaults
-- -----------------------------------------------------------------------------

-- Supabase grants anon full access to new tables in `public` by default; RLS would
-- still block rows, but tables should not be reachable by signed-out users at all.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;

create schema private;
comment on schema private is 'Internal helpers and trigger functions. Not exposed by the API.';
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------

create type public.membership_role as enum ('owner', 'coordinator', 'volunteer');
comment on type public.membership_role is 'A member''s role within one organization.';

-- -----------------------------------------------------------------------------
-- Validation helpers
-- -----------------------------------------------------------------------------

-- True when Postgres recognises the IANA time zone name (e.g. 'America/New_York').
-- Immutable so it can back CHECK constraints: it converts a fixed instant using only
-- functions Postgres itself marks immutable (not now(), which is only stable).
create function private.is_valid_timezone(tz text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  perform pg_catalog.timezone(tz, pg_catalog.to_timestamp(0));
  return true;
exception
  when invalid_parameter_value then
    return false;
end;
$$;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) <= 120),
  avatar_url text check (char_length(avatar_url) <= 2048),
  timezone text not null default 'UTC' check (private.is_valid_timezone(timezone)),
  created_at timestamptz not null default now()
);
comment on table public.profiles is 'Public profile for each auth user, created by a signup trigger.';

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  slug text not null unique check (
    char_length(slug) between 3 and 50 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  timezone text not null default 'UTC' check (private.is_valid_timezone(timezone)),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
comment on table public.organizations is 'A tenant: a nonprofit that schedules volunteers.';
comment on column public.organizations.slug is 'URL-safe identifier: lowercase letters, digits, single hyphens.';

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.membership_role not null default 'volunteer',
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);
comment on table public.memberships is 'Which users belong to which organizations, and in what role.';

-- (org_id, user_id) is covered by the unique constraint's index.
create index memberships_user_id_idx on public.memberships (user_id);
create index organizations_created_by_idx on public.organizations (created_by);

-- -----------------------------------------------------------------------------
-- Authorization helpers (used by RLS policies)
--
-- security definer: they read memberships without re-entering memberships' own
-- policies (which would recurse). search_path = '' plus fully qualified names
-- prevents a caller from shadowing objects the function relies on.
-- -----------------------------------------------------------------------------

create function private.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.org_id = p_org_id
      and m.user_id = (select auth.uid())
  );
$$;

create function private.has_org_role(p_org_id uuid, p_roles public.membership_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.org_id = p_org_id
      and m.user_id = (select auth.uid())
      and m.role = any (p_roles)
  );
$$;

-- True when the current user and p_user_id belong to at least one common organization.
create function private.shares_org_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.org_id = mine.org_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = p_user_id
  );
$$;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

-- Every new auth user gets a profile, named from OAuth/magic-link metadata when present.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := nullif(btrim(coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    ''
  )), '');
  v_avatar text := new.raw_user_meta_data ->> 'avatar_url';
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    left(v_name, 120),
    case when char_length(v_avatar) <= 2048 then v_avatar end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- An organization must always keep at least one owner. Runs after the change so it sees
-- the final state of multi-row statements, and locks the organization row so two
-- concurrent demotions can't each see "another owner remains" and both succeed.
create function private.prevent_ownerless_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role <> 'owner' or (tg_op = 'UPDATE' and new.role = 'owner') then
    return null;
  end if;

  perform 1 from public.organizations o where o.id = old.org_id for update;
  if not found then
    -- The organization itself is being deleted (cascade); nothing to protect.
    return null;
  end if;

  if not exists (
    select 1
    from public.memberships m
    where m.org_id = old.org_id
      and m.role = 'owner'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'LAST_OWNER',
      detail = 'An organization must keep at least one owner. Make another member an owner first.';
  end if;

  return null;
end;
$$;

create trigger memberships_keep_an_owner
  after update of role or delete on public.memberships
  for each row execute function private.prevent_ownerless_organization();

-- -----------------------------------------------------------------------------
-- RPC: create an organization and make the caller its owner, atomically.
--
-- There is no INSERT policy on organizations or memberships: this function is the only
-- way to create either, so a user can never end up with an org they can't see, or
-- grant themselves membership in someone else's org.
-- -----------------------------------------------------------------------------

create function public.create_organization(p_name text, p_slug text, p_timezone text default 'UTC')
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_org public.organizations;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'NOT_AUTHENTICATED',
      detail = 'Sign in to create an organization.';
  end if;

  insert into public.organizations (name, slug, timezone, created_by)
  values (btrim(p_name), lower(btrim(p_slug)), p_timezone, v_user_id)
  returning * into v_org;

  insert into public.memberships (org_id, user_id, role)
  values (v_org.id, v_user_id, 'owner');

  return v_org;
exception
  when unique_violation then
    raise exception using
      errcode = 'P0001',
      message = 'SLUG_TAKEN',
      detail = 'That organization URL is already in use.';
end;
$$;
comment on function public.create_organization is 'Creates an organization owned by the calling user.';

-- -----------------------------------------------------------------------------
-- Function privileges: Postgres grants EXECUTE to PUBLIC by default; be explicit.
-- -----------------------------------------------------------------------------

revoke all on function
  private.is_valid_timezone(text),
  private.is_org_member(uuid),
  private.has_org_role(uuid, public.membership_role[]),
  private.shares_org_with(uuid),
  private.handle_new_user(),
  private.prevent_ownerless_organization(),
  public.create_organization(text, text, text)
from public, anon;

grant execute on function
  private.is_valid_timezone(text),
  private.is_org_member(uuid),
  private.has_org_role(uuid, public.membership_role[]),
  private.shares_org_with(uuid)
to authenticated, service_role;

grant execute on function public.create_organization(text, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Table privileges: least privilege, down to the column. RLS then decides which rows.
-- -----------------------------------------------------------------------------

revoke all on public.profiles, public.organizations, public.memberships from anon, authenticated;

grant select, update (full_name, avatar_url, timezone) on public.profiles to authenticated;
grant select, update (name, slug, timezone), delete on public.organizations to authenticated;
grant select, update (role), delete on public.memberships to authenticated;

-- -----------------------------------------------------------------------------
-- Row-level security
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;

-- profiles: yourself, plus people you share an organization with (coordinators need
-- volunteers' names). Only you can edit your profile. Rows are created by the signup trigger.
create policy "profiles: read self and fellow members"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_org_with(id));

create policy "profiles: update self"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- organizations: members read; owners manage. Created only via create_organization().
create policy "organizations: members can read"
  on public.organizations for select to authenticated
  using (private.is_org_member(id));

create policy "organizations: owners can update"
  on public.organizations for update to authenticated
  using (private.has_org_role(id, array['owner']::public.membership_role[]))
  with check (private.has_org_role(id, array['owner']::public.membership_role[]));

create policy "organizations: owners can delete"
  on public.organizations for delete to authenticated
  using (private.has_org_role(id, array['owner']::public.membership_role[]));

-- memberships: members see their org's roster; owners change roles and remove members.
-- Created only via create_organization() (and invite redemption, added with invites).
create policy "memberships: members can read their organization"
  on public.memberships for select to authenticated
  using (private.is_org_member(org_id));

create policy "memberships: owners can change roles"
  on public.memberships for update to authenticated
  using (private.has_org_role(org_id, array['owner']::public.membership_role[]))
  with check (private.has_org_role(org_id, array['owner']::public.membership_role[]));

create policy "memberships: owners can remove members"
  on public.memberships for delete to authenticated
  using (private.has_org_role(org_id, array['owner']::public.membership_role[]));
