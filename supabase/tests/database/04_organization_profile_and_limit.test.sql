-- Organization profile fields and the per-user creation limit.
begin;
select plan(15);

create function pg_temp.sign_in_as(p_user_id uuid) returns void language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated')::text,
    true
  );
$$;

-- e = creator, f = another user, g = coordinator in e's organization
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000e', 'creator@example.test'),
  ('00000000-0000-0000-0000-00000000000f', 'other@example.test'),
  ('00000000-0000-0000-0000-000000000001', 'coordinator@example.test');

-- ---------------------------------------------------------------------------
-- Profile fields
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.sign_in_as('00000000-0000-0000-0000-00000000000e');

select lives_ok(
  $$ select public.create_organization(
       'Riverside Food Bank', 'riverside-food-bank', 'America/Chicago',
       '  Feeding families since 1998.  ', ' Hello@Riverside.example ', 'https://riverside.example'
     ) $$,
  'an organization can be created with a description, contact email and website'
);

reset role;
select results_eq(
  $$ select description, contact_email, website_url
     from public.organizations where slug = 'riverside-food-bank' $$,
  $$ values ('Feeding families since 1998.'::text, 'hello@riverside.example'::text,
             'https://riverside.example'::text) $$,
  'profile fields are trimmed and the contact email is lowercased'
);

set local role authenticated;
select lives_ok(
  $$ select public.create_organization('Eastside Pantry', 'eastside-pantry', 'UTC', '   ', '', null) $$,
  'profile fields are optional'
);

reset role;
select results_eq(
  $$ select description, contact_email, website_url
     from public.organizations where slug = 'eastside-pantry' $$,
  $$ values (null::text, null::text, null::text) $$,
  'blank profile fields are stored as null'
);

-- ---------------------------------------------------------------------------
-- Creation limit
-- ---------------------------------------------------------------------------
set local role authenticated;
select throws_ok(
  $$ select public.create_organization('Third Org', 'third-org') $$,
  'P0001',
  'ORG_LIMIT_REACHED',
  'a user cannot create a third organization'
);

select pg_temp.sign_in_as('00000000-0000-0000-0000-00000000000f');
select lives_ok(
  $$ select public.create_organization('Westside Shelter', 'westside-shelter') $$,
  'the limit is per user: someone else can still create an organization'
);

-- ---------------------------------------------------------------------------
-- Field validation (user f has one organization, so the limit doesn't interfere)
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ select public.create_organization('Bad Email', 'bad-email', 'UTC', null, 'not-an-email') $$,
  '23514',
  null,
  'an invalid contact email is rejected'
);
select throws_ok(
  $$ select public.create_organization('Bad Site', 'bad-site', 'UTC', null, null, 'javascript:alert(1)') $$,
  '23514',
  null,
  'a website that is not http(s) is rejected'
);
select throws_ok(
  $$ select public.create_organization('Wordy', 'wordy', 'UTC', repeat('x', 501)) $$,
  '23514',
  null,
  'a description over 500 characters is rejected'
);

-- ---------------------------------------------------------------------------
-- Editing profile fields (RLS filters rows silently, so check the result as admin)
-- ---------------------------------------------------------------------------
reset role;
insert into public.memberships (org_id, user_id, role)
select id, '00000000-0000-0000-0000-000000000001', 'coordinator'
from public.organizations where slug = 'riverside-food-bank';

set local role authenticated;
select pg_temp.sign_in_as('00000000-0000-0000-0000-00000000000e');
update public.organizations set description = 'Updated by the owner.'
where slug = 'riverside-food-bank';

select pg_temp.sign_in_as('00000000-0000-0000-0000-000000000001');
update public.organizations set website_url = 'https://hijacked.example'
where slug = 'riverside-food-bank';

reset role;
select is(
  (select description from public.organizations where slug = 'riverside-food-bank'),
  'Updated by the owner.',
  'an owner can edit the profile fields'
);
select is(
  (select website_url from public.organizations where slug = 'riverside-food-bank'),
  'https://riverside.example',
  'a coordinator cannot edit the profile fields'
);

-- ---------------------------------------------------------------------------
-- Deleting an organization frees a slot
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.sign_in_as('00000000-0000-0000-0000-00000000000e');
delete from public.organizations where slug = 'eastside-pantry';

select lives_ok(
  $$ select public.create_organization('Third Org', 'third-org') $$,
  'after deleting an organization, its creator can create another'
);

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
reset role;
select hasnt_function(
  'public', 'create_organization', array['text', 'text', 'text'],
  'the old three-argument create_organization is gone'
);
select ok(
  not has_function_privilege(
    'anon', 'public.create_organization(text, text, text, text, text, text)', 'EXECUTE'
  ),
  'signed-out users cannot execute create_organization'
);
select ok(
  has_function_privilege(
    'authenticated', 'public.create_organization(text, text, text, text, text, text)', 'EXECUTE'
  ),
  'signed-in users can execute create_organization'
);

select * from finish();
rollback;
