-- =============================================================================
-- Invites: single-use links that let someone join an organization.
--
--   * The database generates each token (32 random bytes) and stores only its SHA-256
--     hash; the token itself is returned once, to the person who created the invite.
--   * Owners can invite coordinators and volunteers; coordinators can invite volunteers.
--     Nobody is invited as an owner.
--   * Joining happens only through redeem_invite(), which locks the invite so it can be
--     used once, even when two people try at the same moment.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table
-- -----------------------------------------------------------------------------

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  role public.membership_role not null check (role <> 'owner'),
  token_hash bytea not null unique,
  expires_at timestamptz not null default now() + interval '7 days',
  created_by uuid references public.profiles (id) on delete set null,
  used_at timestamptz,
  used_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (used_by is null or used_at is not null)
);
comment on table public.invites is 'Single-use links to join an organization. Created and redeemed via RPC only.';
comment on column public.invites.role is 'Role the invitee receives. Never owner.';
comment on column public.invites.token_hash is 'SHA-256 of the invite token. The token itself is never stored.';
comment on column public.invites.used_at is 'When the invite was redeemed; null while pending.';
comment on column public.invites.used_by is 'Who redeemed the invite.';

-- (token_hash) is covered by its unique constraint's index.
create index invites_org_id_idx on public.invites (org_id);
create index invites_created_by_idx on public.invites (created_by);
create index invites_used_by_idx on public.invites (used_by);

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

-- The stored form of an invite token. Immutable: sha256 and convert_to depend only on input.
create function private.invite_token_hash(p_token text)
returns bytea
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.sha256(pg_catalog.convert_to(p_token, 'UTF8'));
$$;

-- -----------------------------------------------------------------------------
-- RPC: create an invite and return its token (the only time it is ever visible).
-- -----------------------------------------------------------------------------

create function public.create_invite(
  p_org_id uuid,
  p_role public.membership_role default 'volunteer'
)
returns table (invite_id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_max_pending constant integer := 25;
  -- Owners can invite coordinators; coordinators and owners can invite volunteers.
  v_allowed public.membership_role[] := case
    when p_role = 'coordinator' then array['owner']::public.membership_role[]
    when p_role = 'volunteer' then array['owner', 'coordinator']::public.membership_role[]
    else array[]::public.membership_role[]
  end;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'NOT_AUTHENTICATED',
      detail = 'Sign in to invite people.';
  end if;

  if not private.has_org_role(p_org_id, v_allowed) then
    raise exception using
      errcode = '42501',
      message = 'NOT_AUTHORIZED',
      detail = 'You can''t invite people to this organization with that role.';
  end if;

  -- Lock the organization so concurrent requests can't both slip under the limit.
  perform 1 from public.organizations o where o.id = p_org_id for update;

  if (
    select count(*)
    from public.invites i
    where i.org_id = p_org_id
      and i.used_at is null
      and i.expires_at > now()
  ) >= v_max_pending then
    raise exception using
      errcode = 'P0001',
      message = 'INVITE_LIMIT_REACHED',
      detail = 'This organization already has 25 pending invites. Revoke some first.';
  end if;

  -- 32 random bytes as URL-safe base64 (43 characters, no padding).
  token := pg_catalog.translate(
    pg_catalog.encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_'
  );

  insert into public.invites as i (org_id, role, token_hash, created_by)
  values (p_org_id, p_role, private.invite_token_hash(token), v_user_id)
  returning i.id, i.expires_at into invite_id, expires_at;

  return next;
end;
$$;
comment on function public.create_invite is
  'Creates a single-use invite and returns its token once. Owners: any non-owner role; coordinators: volunteers.';

-- -----------------------------------------------------------------------------
-- RPC: preview an invite before joining. Only the token holder can find one: tokens are
-- 256-bit random values, so they can't be guessed.
-- -----------------------------------------------------------------------------

create function public.get_invite(p_token text)
returns table (org_id uuid, org_name text, role public.membership_role, status text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_invite public.invites;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'NOT_AUTHENTICATED',
      detail = 'Sign in to accept an invitation.';
  end if;

  select * into v_invite
  from public.invites i
  where i.token_hash = private.invite_token_hash(p_token);

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'INVITE_NOT_FOUND',
      detail = 'This invite link isn''t valid. It may have been revoked.';
  end if;

  org_id := v_invite.org_id;
  role := v_invite.role;
  select o.name into org_name from public.organizations o where o.id = v_invite.org_id;
  status := case
    when exists (
      select 1 from public.memberships m
      where m.org_id = v_invite.org_id and m.user_id = v_user_id
    ) then 'member'
    when v_invite.used_at is not null then 'used'
    when v_invite.expires_at <= now() then 'expired'
    else 'valid'
  end;

  return next;
end;
$$;
comment on function public.get_invite is
  'Previews an invite for its token holder: organization, role, and valid/expired/used/member.';

-- -----------------------------------------------------------------------------
-- RPC: join the organization. Returns its id.
-- -----------------------------------------------------------------------------

create function public.redeem_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_invite public.invites;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'NOT_AUTHENTICATED',
      detail = 'Sign in to accept an invitation.';
  end if;

  -- Lock the invite so two people redeeming the same link at once can't both get in.
  select * into v_invite
  from public.invites i
  where i.token_hash = private.invite_token_hash(p_token)
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'INVITE_NOT_FOUND',
      detail = 'This invite link isn''t valid. It may have been revoked.';
  end if;

  -- Already a member (including via this very link): nothing to do, and the invite stays
  -- available. Existing roles are never changed here, up or down.
  if exists (
    select 1 from public.memberships m
    where m.org_id = v_invite.org_id and m.user_id = v_user_id
  ) then
    return v_invite.org_id;
  end if;

  if v_invite.used_at is not null then
    raise exception using
      errcode = 'P0001',
      message = 'INVITE_USED',
      detail = 'This invite link has already been used.';
  end if;

  if v_invite.expires_at <= now() then
    raise exception using
      errcode = 'P0001',
      message = 'INVITE_EXPIRED',
      detail = 'This invite link has expired.';
  end if;

  insert into public.memberships (org_id, user_id, role)
  values (v_invite.org_id, v_user_id, v_invite.role)
  -- Joined through another invite a moment ago: keep that membership and this invite.
  on conflict (org_id, user_id) do nothing;

  if found then
    update public.invites i
    set used_at = now(), used_by = v_user_id
    where i.id = v_invite.id;
  end if;

  return v_invite.org_id;
end;
$$;
comment on function public.redeem_invite is
  'Joins the invite''s organization with its role and marks the invite used. Idempotent for members.';

-- -----------------------------------------------------------------------------
-- Function privileges
-- -----------------------------------------------------------------------------

revoke all on function
  private.invite_token_hash(text),
  public.create_invite(uuid, public.membership_role),
  public.get_invite(text),
  public.redeem_invite(text)
from public, anon;

grant execute on function
  public.create_invite(uuid, public.membership_role),
  public.get_invite(text),
  public.redeem_invite(text)
to authenticated;

-- -----------------------------------------------------------------------------
-- Table privileges and row-level security
--
-- Coordinators and owners can list and revoke (delete) their organization's invites.
-- token_hash is never readable through the API, and nobody inserts or updates directly.
-- -----------------------------------------------------------------------------

revoke all on public.invites from anon, authenticated;
grant select (id, org_id, role, expires_at, created_by, used_at, used_by, created_at), delete
  on public.invites to authenticated;

alter table public.invites enable row level security;

create policy "invites: coordinators and owners can read"
  on public.invites for select to authenticated
  using (private.has_org_role(org_id, array['owner', 'coordinator']::public.membership_role[]));

create policy "invites: coordinators and owners can revoke"
  on public.invites for delete to authenticated
  using (private.has_org_role(org_id, array['owner', 'coordinator']::public.membership_role[]));
