-- Members: display names, the coordinator-only roster, role limits, leaving, handing over ownership.
begin;
select plan(19);

create function pg_temp.sign_in_as(p_user_id uuid) returns void language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated')::text,
    true
  );
$$;

-- o = owner, c = coordinator, v and w = volunteers, x = outsider
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'owner@example.test'),
  ('00000000-0000-0000-0000-0000000000d2', 'coordinator@example.test'),
  ('00000000-0000-0000-0000-0000000000d3', 'volunteer@example.test'),
  ('00000000-0000-0000-0000-0000000000d4', 'second.volunteer@example.test'),
  ('00000000-0000-0000-0000-0000000000d5', 'outsider@example.test');

set local role authenticated;
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000d1');
select public.create_organization('Members Test', 'members-test');
reset role;

-- Shared state, readable while impersonating users (anon too, so its check fails on the function).
create temp table t_org as select id from public.organizations where slug = 'members-test';
grant select on t_org to authenticated, anon;

insert into public.memberships (org_id, user_id, role)
select (select id from t_org), u.user_id, u.role
from (values ('00000000-0000-0000-0000-0000000000d2'::uuid, 'coordinator'::public.membership_role),
             ('00000000-0000-0000-0000-0000000000d3'::uuid, 'volunteer'::public.membership_role),
             ('00000000-0000-0000-0000-0000000000d4'::uuid, 'volunteer'::public.membership_role)) as u (user_id, role);

-- ---------------------------------------------------------------------------
-- Display names
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000d3');

select lives_ok(
  $$ update public.profiles set full_name = 'Val Volunteer'
     where id = '00000000-0000-0000-0000-0000000000d3' $$,
  'a member can set their own name'
);
select throws_ok(
  $$ update public.profiles set full_name = '   '
     where id = '00000000-0000-0000-0000-0000000000d3' $$,
  '23514',
  null,
  'a blank name is rejected'
);
update public.profiles set full_name = 'Hijacked'
where id = '00000000-0000-0000-0000-0000000000d2';

reset role;
select is(
  (select full_name from public.profiles where id = '00000000-0000-0000-0000-0000000000d3'),
  'Val Volunteer',
  'the name is saved'
);
select is(
  (select full_name from public.profiles where id = '00000000-0000-0000-0000-0000000000d2'),
  null,
  'nobody can rename someone else'
);

-- ---------------------------------------------------------------------------
-- The roster
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000d1');
select results_eq(
  $$ select role, full_name, email from public.list_org_members((select id from t_org)) $$,
  $$ values
       ('owner'::public.membership_role, null::text, 'owner@example.test'::text),
       ('coordinator'::public.membership_role, null::text, 'coordinator@example.test'::text),
       ('volunteer'::public.membership_role, 'Val Volunteer'::text, 'volunteer@example.test'::text),
       ('volunteer'::public.membership_role, null::text, 'second.volunteer@example.test'::text) $$,
  'an owner sees every member with their email, owners first, then by name'
);

select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000d2');
select is(
  (select count(*)::int from public.list_org_members((select id from t_org)) where joined_at is not null),
  4,
  'a coordinator sees the roster, with join dates'
);

select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000d3');
select throws_ok(
  $$ select * from public.list_org_members((select id from t_org)) $$,
  '42501',
  'NOT_AUTHORIZED',
  'a volunteer cannot list members'
);

select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000d5');
select throws_ok(
  $$ select * from public.list_org_members((select id from t_org)) $$,
  '42501',
  'NOT_AUTHORIZED',
  'an outsider cannot list members'
);

-- ---------------------------------------------------------------------------
-- Coordinator and volunteer limits (RLS filters silently, so check as admin)
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000d2');
update public.memberships set role = 'coordinator'
where user_id = '00000000-0000-0000-0000-0000000000d3';
delete from public.memberships where user_id = '00000000-0000-0000-0000-0000000000d4';

select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000d3');
delete from public.memberships where user_id = '00000000-0000-0000-0000-0000000000d4';

reset role;
select is(
  (select role from public.memberships where user_id = '00000000-0000-0000-0000-0000000000d3'),
  'volunteer'::public.membership_role,
  'a coordinator cannot change roles'
);
select is(
  (select count(*)::int from public.memberships where user_id = '00000000-0000-0000-0000-0000000000d4'),
  1,
  'coordinators and volunteers cannot remove other members'
);

-- ---------------------------------------------------------------------------
-- Leaving
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000d3');
delete from public.memberships where user_id = '00000000-0000-0000-0000-0000000000d3';

reset role;
select is(
  (select count(*)::int from public.memberships where user_id = '00000000-0000-0000-0000-0000000000d3'),
  0,
  'a volunteer can leave'
);

set local role authenticated;
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000d1');
select throws_ok(
  $$ delete from public.memberships where user_id = '00000000-0000-0000-0000-0000000000d1' $$,
  'P0001',
  'LAST_OWNER',
  'the last owner cannot leave'
);

-- ---------------------------------------------------------------------------
-- Handing over ownership
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ update public.memberships set role = 'owner'
     where user_id = '00000000-0000-0000-0000-0000000000d2' $$,
  'an owner can make a coordinator an owner'
);
select lives_ok(
  $$ delete from public.memberships where user_id = '00000000-0000-0000-0000-0000000000d1' $$,
  'an owner can leave once another owner exists'
);

reset role;
select results_eq(
  $$ select user_id, role from public.memberships
     where org_id = (select id from t_org) order by user_id $$,
  $$ values ('00000000-0000-0000-0000-0000000000d2'::uuid, 'owner'::public.membership_role),
            ('00000000-0000-0000-0000-0000000000d4'::uuid, 'volunteer'::public.membership_role) $$,
  'the new owner remains, with the other volunteer'
);

set local role authenticated;
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000d2');
select lives_ok(
  $$ update public.memberships set role = 'owner'
     where user_id = '00000000-0000-0000-0000-0000000000d4' $$,
  'an owner can make a volunteer an owner'
);
select lives_ok(
  $$ update public.memberships set role = 'coordinator'
     where user_id = '00000000-0000-0000-0000-0000000000d2' $$,
  'an owner can step down once another owner exists'
);

reset role;
select results_eq(
  $$ select user_id, role from public.memberships
     where org_id = (select id from t_org) order by user_id $$,
  $$ values ('00000000-0000-0000-0000-0000000000d2'::uuid, 'coordinator'::public.membership_role),
            ('00000000-0000-0000-0000-0000000000d4'::uuid, 'owner'::public.membership_role) $$,
  'ownership was handed over'
);

-- ---------------------------------------------------------------------------
-- Signed-out callers
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok(
  $$ select * from public.list_org_members((select id from t_org)) $$,
  '42501',
  null,
  'signed-out users cannot list members'
);
reset role;

select * from finish();
rollback;
