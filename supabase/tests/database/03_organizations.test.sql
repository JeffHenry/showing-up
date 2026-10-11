-- Organizations and memberships: creation, visibility, role-based management, last-owner guard.
begin;
select plan(20);

create function pg_temp.sign_in_as(p_user_id uuid) returns void language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated')::text,
    true
  );
$$;

-- a = owner, b = coordinator, c = volunteer, d = outsider
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@example.test'),
  ('00000000-0000-0000-0000-00000000000b', 'coordinator@example.test'),
  ('00000000-0000-0000-0000-00000000000c', 'volunteer@example.test'),
  ('00000000-0000-0000-0000-00000000000d', 'outsider@example.test');

-- ---------------------------------------------------------------------------
-- Creating an organization
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.sign_in_as('00000000-0000-0000-0000-00000000000a');

select lives_ok(
  $$ select public.create_organization('  Food Bank  ', 'Food-Bank', 'America/New_York') $$,
  'a signed-in user can create an organization'
);

reset role;
select results_eq(
  $$ select o.name, o.slug, o.created_by, m.role
     from public.organizations o
     join public.memberships m on m.org_id = o.id
     where o.slug = 'food-bank' $$,
  $$ values ('Food Bank'::text, 'food-bank'::text,
             '00000000-0000-0000-0000-00000000000a'::uuid, 'owner'::public.membership_role) $$,
  'the creator becomes the owner; name is trimmed and slug lowercased'
);

insert into public.memberships (org_id, user_id, role)
select id, u.user_id, u.role
from public.organizations,
  (values ('00000000-0000-0000-0000-00000000000b'::uuid, 'coordinator'::public.membership_role),
          ('00000000-0000-0000-0000-00000000000c'::uuid, 'volunteer'::public.membership_role)) as u (user_id, role)
where slug = 'food-bank';

set local role authenticated;
select pg_temp.sign_in_as('00000000-0000-0000-0000-00000000000d');

select throws_ok(
  $$ select public.create_organization('Copycat', 'food-bank') $$,
  'P0001',
  'SLUG_TAKEN',
  'a slug that is already in use is rejected with SLUG_TAKEN'
);
select throws_ok(
  $$ select public.create_organization('Bad Slug', 'not a slug!') $$,
  '23514',
  null,
  'an invalid slug is rejected'
);
select throws_ok(
  $$ insert into public.organizations (name, slug) values ('Sneaky', 'sneaky') $$,
  '42501',
  null,
  'organizations cannot be inserted directly'
);
select throws_ok(
  $$ insert into public.memberships (org_id, user_id, role)
     values (gen_random_uuid(), '00000000-0000-0000-0000-00000000000d', 'owner') $$,
  '42501',
  null,
  'memberships cannot be inserted directly'
);

-- ---------------------------------------------------------------------------
-- Visibility
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from public.organizations where slug = 'food-bank'),
  0,
  'an outsider cannot see the organization'
);
select is(
  (select count(*)::int from public.memberships),
  0,
  'an outsider cannot see the organization''s members'
);

select pg_temp.sign_in_as('00000000-0000-0000-0000-00000000000c');
select is(
  (select count(*)::int from public.organizations where slug = 'food-bank'),
  1,
  'a volunteer can see their organization'
);
select is(
  (select count(*)::int from public.memberships),
  3,
  'a volunteer can see their organization''s roster'
);

-- ---------------------------------------------------------------------------
-- Role-based management (RLS filters rows silently, so check the result as admin)
-- ---------------------------------------------------------------------------
update public.organizations set name = 'Hacked' where slug = 'food-bank';

select pg_temp.sign_in_as('00000000-0000-0000-0000-00000000000b');
update public.memberships set role = 'owner' where user_id = '00000000-0000-0000-0000-00000000000b';

reset role;
select is(
  (select name from public.organizations where slug = 'food-bank'),
  'Food Bank',
  'a volunteer cannot rename the organization'
);
select is(
  (select role from public.memberships where user_id = '00000000-0000-0000-0000-00000000000b'),
  'coordinator'::public.membership_role,
  'a coordinator cannot promote themselves'
);

set local role authenticated;
select pg_temp.sign_in_as('00000000-0000-0000-0000-00000000000a');
update public.organizations set name = 'Food Bank NYC' where slug = 'food-bank';
update public.memberships set role = 'coordinator' where user_id = '00000000-0000-0000-0000-00000000000c';

reset role;
select is(
  (select name from public.organizations where slug = 'food-bank'),
  'Food Bank NYC',
  'an owner can rename the organization'
);
select is(
  (select role from public.memberships where user_id = '00000000-0000-0000-0000-00000000000c'),
  'coordinator'::public.membership_role,
  'an owner can change a member''s role'
);

-- ---------------------------------------------------------------------------
-- Last-owner guard
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.sign_in_as('00000000-0000-0000-0000-00000000000a');

select throws_ok(
  $$ update public.memberships set role = 'volunteer'
     where user_id = '00000000-0000-0000-0000-00000000000a' $$,
  'P0001',
  'LAST_OWNER',
  'the last owner cannot step down'
);
select throws_ok(
  $$ delete from public.memberships where user_id = '00000000-0000-0000-0000-00000000000a' $$,
  'P0001',
  'LAST_OWNER',
  'the last owner cannot be removed'
);

update public.memberships set role = 'owner' where user_id = '00000000-0000-0000-0000-00000000000b';
select lives_ok(
  $$ update public.memberships set role = 'coordinator'
     where user_id = '00000000-0000-0000-0000-00000000000a' $$,
  'an owner can step down once another owner exists'
);

-- ---------------------------------------------------------------------------
-- Deleting an organization
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as('00000000-0000-0000-0000-00000000000b');
delete from public.organizations where slug = 'food-bank';

reset role;
select is(
  (select count(*)::int from public.organizations where slug = 'food-bank'),
  0,
  'an owner can delete the organization'
);
select is(
  (select count(*)::int from public.memberships),
  0,
  'deleting an organization removes its memberships without tripping the owner guard'
);

-- ---------------------------------------------------------------------------
-- Signed-out callers
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok(
  $$ select public.create_organization('Anonymous', 'anonymous') $$,
  '42501',
  null,
  'signed-out users cannot create organizations'
);

select * from finish();
rollback;
