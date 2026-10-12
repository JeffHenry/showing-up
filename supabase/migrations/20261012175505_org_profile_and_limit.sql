-- =============================================================================
-- Organization profile fields and a per-user creation limit.
--
--   * Optional public details members see: a short description, a contact email and
--     a website. Nothing else is collected until a feature needs it.
--   * create_organization() accepts them, and refuses once the caller has created
--     two organizations (ORG_LIMIT_REACHED), so one account can't flood the database.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Profile fields (all optional; blank values are stored as null)
-- -----------------------------------------------------------------------------

alter table public.organizations
  add column description text check (char_length(btrim(description)) between 1 and 500),
  add column contact_email text check (
    char_length(contact_email) <= 254 and contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  -- Only http(s) links, so the app never renders a javascript: or data: URL.
  add column website_url text check (
    char_length(website_url) <= 2048 and website_url ~* '^https?://\S+$'
  );

comment on column public.organizations.description is 'Short public description, shown to members.';
comment on column public.organizations.contact_email is 'Where volunteers can reach the organization.';
comment on column public.organizations.website_url is 'The organization''s own website (http or https).';

-- Owners edit these like the existing columns; the update policy still limits rows to owners.
grant update (description, contact_email, website_url) on public.organizations to authenticated;

-- -----------------------------------------------------------------------------
-- RPC: create_organization, now with profile fields and a creation limit.
--
-- Parameters can't be added with CREATE OR REPLACE, so the function is recreated and its
-- privileges re-applied. The new parameters have defaults, so existing calls still work.
-- -----------------------------------------------------------------------------

drop function public.create_organization(text, text, text);

create function public.create_organization(
  p_name text,
  p_slug text,
  p_timezone text default 'UTC',
  p_description text default null,
  p_contact_email text default null,
  p_website_url text default null
)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_max_created constant integer := 2;
  v_org public.organizations;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'NOT_AUTHENTICATED',
      detail = 'Sign in to create an organization.';
  end if;

  -- Lock the caller's profile so concurrent requests from the same user run one at a
  -- time; otherwise two could both count one existing organization and both succeed.
  perform 1 from public.profiles p where p.id = v_user_id for update;

  if (
    select count(*) from public.organizations o where o.created_by = v_user_id
  ) >= v_max_created then
    raise exception using
      errcode = 'P0001',
      message = 'ORG_LIMIT_REACHED',
      detail = 'You can create up to 2 organizations.';
  end if;

  insert into public.organizations (
    name, slug, timezone, description, contact_email, website_url, created_by
  )
  values (
    btrim(p_name),
    lower(btrim(p_slug)),
    p_timezone,
    nullif(btrim(p_description), ''),
    lower(nullif(btrim(p_contact_email), '')),
    nullif(btrim(p_website_url), ''),
    v_user_id
  )
  returning * into v_org;

  insert into public.memberships (org_id, user_id, role)
  values (v_org.id, v_user_id, 'owner');

  return v_org;
exception
  when unique_violation then
    raise exception using
      errcode = 'P0001',
      message = 'SLUG_TAKEN',
      detail = 'Another organization already uses that short name.';
end;
$$;
comment on function public.create_organization is
  'Creates an organization owned by the calling user (at most 2 per user).';

revoke all on function public.create_organization(text, text, text, text, text, text)
from public, anon;
grant execute on function public.create_organization(text, text, text, text, text, text)
to authenticated;
