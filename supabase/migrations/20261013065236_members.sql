-- =============================================================================
-- Members: display names, a coordinator-only roster with emails, and leaving.
--
--   * A name is either not set yet (null) or a real name: never blank.
--   * Coordinators and owners list their organization's members, emails included, through
--     list_org_members(). Emails live in auth.users, which the API never exposes directly.
--   * Anyone can leave an organization. The existing last-owner trigger still stops the
--     final owner from leaving.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Names: null means "not set yet"; otherwise 1-120 visible characters.
-- -----------------------------------------------------------------------------

alter table public.profiles
  drop constraint profiles_full_name_check,
  add constraint profiles_full_name_check check (
    full_name is null or char_length(btrim(full_name)) between 1 and 120
  );

-- -----------------------------------------------------------------------------
-- Leaving: members can delete their own membership. Policies of the same kind combine with OR,
-- so owners can still remove anyone. memberships_keep_an_owner raises LAST_OWNER if the last
-- owner tries to leave.
-- -----------------------------------------------------------------------------

create policy "memberships: members can leave"
  on public.memberships for delete to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- RPC: the member roster, for coordinators and owners.
-- -----------------------------------------------------------------------------

create function public.list_org_members(p_org_id uuid)
returns table (
  user_id uuid,
  full_name text,
  email text,
  role public.membership_role,
  joined_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception using
      errcode = '42501',
      message = 'NOT_AUTHENTICATED',
      detail = 'Sign in to see members.';
  end if;

  if not private.has_org_role(p_org_id, array['owner', 'coordinator']::public.membership_role[]) then
    raise exception using
      errcode = '42501',
      message = 'NOT_AUTHORIZED',
      detail = 'Only coordinators and owners can see the member list.';
  end if;

  return query
  select
    m.user_id,
    p.full_name,
    u.email::text,
    m.role,
    m.created_at
  from public.memberships m
  join public.profiles p on p.id = m.user_id
  join auth.users u on u.id = m.user_id
  where m.org_id = p_org_id
  order by
    case m.role when 'owner' then 0 when 'coordinator' then 1 else 2 end,
    p.full_name nulls last,
    u.email;
end;
$$;
comment on function public.list_org_members is
  'Members of an organization with name, email, role, and join date. Coordinators and owners only.';

revoke all on function public.list_org_members(uuid) from public, anon;
grant execute on function public.list_org_members(uuid) to authenticated;
