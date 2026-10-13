-- Shifts: who can see and change them, scheduling rules, locking once started, cancelling,
-- and the version counter behind optimistic concurrency.
begin;
select plan(47);

create function pg_temp.sign_in_as(p_user_id uuid) returns void language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated')::text,
    true
  );
$$;

-- No signed-in user, as in maintenance and seed scripts (reset role keeps the claims).
create function pg_temp.sign_out() returns void language sql as $$
  select set_config('request.jwt.claims', '', true);
$$;

-- o = owner, c = coordinator, v = volunteer, x = outsider (owns another organization)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'owner@example.test'),
  ('00000000-0000-0000-0000-0000000000e2', 'coordinator@example.test'),
  ('00000000-0000-0000-0000-0000000000e3', 'volunteer@example.test'),
  ('00000000-0000-0000-0000-0000000000e4', 'outsider@example.test');

set local role authenticated;
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000e1');
select public.create_organization('Shifts Test', 'shifts-test');
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000e4');
select public.create_organization('Other Org', 'other-org');
reset role;

-- Shared state, readable while impersonating users.
create temp table t_org as select id from public.organizations where slug = 'shifts-test';
create temp table t_other_org as select id from public.organizations where slug = 'other-org';
grant select on t_org, t_other_org to authenticated;

insert into public.memberships (org_id, user_id, role)
select (select id from t_org), u.user_id, u.role
from (values ('00000000-0000-0000-0000-0000000000e2'::uuid, 'coordinator'::public.membership_role),
             ('00000000-0000-0000-0000-0000000000e3'::uuid, 'volunteer'::public.membership_role)) as u (user_id, role);

select pg_temp.sign_out();

-- Fixture shifts, inserted without a signed-in user (the scheduling rules don't apply),
-- which is also how a started shift can exist in a test transaction.
insert into public.shifts (id, org_id, title, start_time, end_time, capacity) values
  ('00000000-0000-0000-0000-0000000005a1', (select id from t_org), 'Sorting',
   now() + interval '1 day', now() + interval '1 day 3 hours', 5),
  ('00000000-0000-0000-0000-0000000005a2', (select id from t_org), 'Started',
   now() - interval '1 hour', now() + interval '2 hours', 5),
  ('00000000-0000-0000-0000-0000000005a3', (select id from t_org), 'To cancel',
   now() + interval '2 days', now() + interval '2 days 2 hours', 5),
  ('00000000-0000-0000-0000-0000000005a4', (select id from t_org), 'To delete',
   now() + interval '3 days', now() + interval '3 days 2 hours', 5),
  ('00000000-0000-0000-0000-0000000005b1', (select id from t_other_org), 'Other org shift',
   now() + interval '1 day', now() + interval '1 day 2 hours', 5);

-- ---------------------------------------------------------------------------
-- Structure
-- ---------------------------------------------------------------------------
select policies_are(
  'public', 'shifts',
  array[
    'shifts: members can read',
    'shifts: coordinators and owners can create',
    'shifts: coordinators and owners can edit',
    'shifts: coordinators and owners can delete'
  ],
  'shifts has exactly the expected policies'
);
select has_index(
  'public', 'shifts', 'shifts_org_id_start_time_id_idx', array['org_id', 'start_time', 'id'],
  'shifts are indexed for keyset pagination by (org_id, start_time, id)'
);

-- ---------------------------------------------------------------------------
-- Reading
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000e3');
select results_eq(
  $$ select title from public.shifts order by start_time $$,
  $$ values ('Started'::text), ('Sorting'), ('To cancel'), ('To delete') $$,
  'a volunteer sees their organization''s shifts, and only those'
);

select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000e4');
select results_eq(
  $$ select title from public.shifts $$,
  $$ values ('Other org shift'::text) $$,
  'an outsider sees none of another organization''s shifts'
);

-- ---------------------------------------------------------------------------
-- Creating
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000e2');
select lives_ok(
  $$ insert into public.shifts (org_id, title, location, start_time, end_time, capacity)
     values ((select id from t_org), 'Food drive', 'Main warehouse',
             now() + interval '5 days', now() + interval '5 days 4 hours', 10) $$,
  'a coordinator can create a shift'
);
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000e1');
select lives_ok(
  $$ insert into public.shifts (org_id, title, start_time, end_time, capacity)
     values ((select id from t_org), 'Overnight', now() + interval '6 days 22 hours',
             now() + interval '7 days 6 hours', 2) $$,
  'an owner can create an overnight shift'
);
reset role;
select results_eq(
  $$ select created_by, version, cancelled_at from public.shifts where title = 'Food drive' $$,
  $$ values ('00000000-0000-0000-0000-0000000000e2'::uuid, 1, null::timestamptz) $$,
  'a new shift records its creator and starts at version 1'
);

set local role authenticated;
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000e3');
select throws_ok(
  $$ insert into public.shifts (org_id, title, start_time, end_time, capacity)
     values ((select id from t_org), 'Sneaky', now() + interval '1 day',
             now() + interval '1 day 1 hour', 1) $$,
  '42501',
  null,
  'a volunteer cannot create shifts'
);

select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000e2');
select throws_ok(
  $$ insert into public.shifts (org_id, title, start_time, end_time, capacity)
     values ((select id from t_other_org), 'Sneaky', now() + interval '1 day',
             now() + interval '1 day 1 hour', 1) $$,
  '42501',
  null,
  'a coordinator cannot create shifts in another organization'
);
select throws_ok(
  $$ insert into public.shifts (org_id, title, start_time, end_time, capacity)
     values ((select id from t_org), 'Yesterday', now() - interval '1 day',
             now() - interval '22 hours', 1) $$,
  'P0001',
  'SHIFT_IN_PAST',
  'a new shift must start in the future'
);
select throws_ok(
  $$ insert into public.shifts (org_id, title, start_time, end_time, capacity)
     values ((select id from t_org), 'Typo year', now() + interval '1 year 1 day',
             now() + interval '1 year 1 day 2 hours', 1) $$,
  'P0001',
  'SHIFT_TOO_FAR',
  'a new shift must start within a year'
);
select throws_ok(
  $$ insert into public.shifts (org_id, title, start_time, end_time, capacity)
     values ((select id from t_org), 'Backwards', now() + interval '2 days',
             now() + interval '1 day', 1) $$,
  '23514',
  null,
  'a shift must end after it starts'
);
select throws_ok(
  $$ insert into public.shifts (org_id, title, start_time, end_time, capacity)
     values ((select id from t_org), 'Marathon', now() + interval '1 day',
             now() + interval '2 days 1 minute', 1) $$,
  '23514',
  null,
  'a shift lasts at most 24 hours'
);
select throws_ok(
  $$ insert into public.shifts (org_id, title, start_time, end_time, capacity)
     values ((select id from t_org), 'Nobody', now() + interval '1 day',
             now() + interval '1 day 1 hour', 0) $$,
  '23514',
  null,
  'a shift needs at least one volunteer'
);
select throws_ok(
  $$ insert into public.shifts (org_id, title, start_time, end_time, capacity)
     values ((select id from t_org), '   ', now() + interval '1 day',
             now() + interval '1 day 1 hour', 1) $$,
  '23514',
  null,
  'a shift needs a title'
);
select throws_ok(
  $$ insert into public.shifts (org_id, title, start_time, end_time, capacity, created_by)
     values ((select id from t_org), 'Forged', now() + interval '1 day',
             now() + interval '1 day 1 hour', 1, '00000000-0000-0000-0000-0000000000e1') $$,
  '42501',
  null,
  'nobody can set who created a shift'
);
select throws_ok(
  $$ insert into public.shifts (org_id, title, start_time, end_time, capacity, cancelled_at)
     values ((select id from t_org), 'Pre-cancelled', now() + interval '1 day',
             now() + interval '1 day 1 hour', 1, now()) $$,
  '42501',
  null,
  'nobody can insert a cancelled shift directly'
);

-- ---------------------------------------------------------------------------
-- Editing
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ update public.shifts set title = 'Sorting donations', capacity = 6
     where id = '00000000-0000-0000-0000-0000000005a1' and version = 1 $$,
  'a coordinator can edit an upcoming shift'
);
-- Another coordinator still holding version 1 saves nothing (the app then reports a conflict).
update public.shifts set title = 'Stale edit'
where id = '00000000-0000-0000-0000-0000000005a1' and version = 1;

select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000e3');
update public.shifts set title = 'Volunteer edit'
where id = '00000000-0000-0000-0000-0000000005a1';

reset role;
select results_eq(
  $$ select title, capacity, version from public.shifts
     where id = '00000000-0000-0000-0000-0000000005a1' $$,
  $$ values ('Sorting donations'::text, 6, 2) $$,
  'an edit bumps the version; stale and volunteer edits change nothing'
);

set local role authenticated;
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000e2');
select throws_ok(
  $$ update public.shifts set org_id = (select id from t_other_org)
     where id = '00000000-0000-0000-0000-0000000005a1' $$,
  '42501',
  null,
  'a shift cannot be moved to another organization'
);
select throws_ok(
  $$ update public.shifts set version = 1 where id = '00000000-0000-0000-0000-0000000005a1' $$,
  '42501',
  null,
  'nobody can set the version directly'
);
select throws_ok(
  $$ update public.shifts set cancelled_at = now() where id = '00000000-0000-0000-0000-0000000005a1' $$,
  '42501',
  null,
  'nobody can cancel a shift by editing it'
);
select throws_ok(
  $$ update public.shifts set title = 'Renamed' where id = '00000000-0000-0000-0000-0000000005a2' $$,
  'P0001',
  'SHIFT_STARTED',
  'a shift that has started cannot be edited'
);
select throws_ok(
  $$ update public.shifts
     set start_time = now() - interval '1 hour', end_time = now() + interval '1 hour'
     where id = '00000000-0000-0000-0000-0000000005a1' $$,
  'P0001',
  'SHIFT_IN_PAST',
  'a shift cannot be moved into the past'
);
select throws_ok(
  $$ update public.shifts
     set start_time = now() + interval '2 years', end_time = now() + interval '2 years 1 hour'
     where id = '00000000-0000-0000-0000-0000000005a1' $$,
  'P0001',
  'SHIFT_TOO_FAR',
  'a shift cannot be moved more than a year ahead'
);
select lives_ok(
  $$ update public.shifts
     set start_time = start_time + interval '1 day', end_time = end_time + interval '1 day'
     where id = '00000000-0000-0000-0000-0000000005a1' $$,
  'a shift can be moved to another future time'
);

-- ---------------------------------------------------------------------------
-- Cancelling
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000e3');
select throws_ok(
  $$ select public.cancel_shift('00000000-0000-0000-0000-0000000005a3') $$,
  '42501',
  'NOT_AUTHORIZED',
  'a volunteer cannot cancel shifts'
);
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000e4');
select throws_ok(
  $$ select public.cancel_shift('00000000-0000-0000-0000-0000000005a3') $$,
  '42501',
  'NOT_AUTHORIZED',
  'an outsider cannot cancel another organization''s shift'
);
select throws_ok(
  $$ select public.cancel_shift('00000000-0000-0000-0000-000000000000') $$,
  '42501',
  'NOT_AUTHORIZED',
  'a missing shift looks the same as a forbidden one'
);

select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000e2');
select throws_ok(
  $$ select public.cancel_shift('00000000-0000-0000-0000-0000000005a2') $$,
  'P0001',
  'SHIFT_STARTED',
  'a shift that has started cannot be cancelled'
);
select lives_ok(
  $$ select public.cancel_shift('00000000-0000-0000-0000-0000000005a3', '  Rain forecast  ') $$,
  'a coordinator can cancel an upcoming shift'
);
reset role;
select results_eq(
  $$ select cancelled_at is not null, cancelled_by, cancel_reason, version from public.shifts
     where id = '00000000-0000-0000-0000-0000000005a3' $$,
  $$ values (true, '00000000-0000-0000-0000-0000000000e2'::uuid, 'Rain forecast'::text, 2) $$,
  'cancelling records who, why (trimmed) and bumps the version'
);

set local role authenticated;
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000e3');
select is(
  (select cancelled_at is not null from public.shifts where id = '00000000-0000-0000-0000-0000000005a3'),
  true,
  'volunteers still see a cancelled shift, marked cancelled'
);

select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000e1');
select throws_ok(
  $$ select public.cancel_shift('00000000-0000-0000-0000-0000000005a3') $$,
  'P0001',
  'SHIFT_CANCELLED',
  'a shift cannot be cancelled twice'
);
select throws_ok(
  $$ update public.shifts set title = 'Back on' where id = '00000000-0000-0000-0000-0000000005a3' $$,
  'P0001',
  'SHIFT_CANCELLED',
  'a cancelled shift cannot be edited'
);
select throws_ok(
  $$ select public.cancel_shift('00000000-0000-0000-0000-0000000005a4', repeat('x', 501)) $$,
  '23514',
  null,
  'a cancel reason is at most 500 characters'
);
select lives_ok(
  $$ select public.cancel_shift('00000000-0000-0000-0000-0000000005a4', '   ') $$,
  'an owner can cancel without a reason'
);
reset role;
select is(
  (select cancel_reason from public.shifts where id = '00000000-0000-0000-0000-0000000005a4'),
  null,
  'a blank reason is stored as no reason'
);

-- ---------------------------------------------------------------------------
-- Deleting
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000e3');
delete from public.shifts where id = '00000000-0000-0000-0000-0000000005a1';

select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000e2');
select throws_ok(
  $$ delete from public.shifts where id = '00000000-0000-0000-0000-0000000005a2' $$,
  'P0001',
  'SHIFT_STARTED',
  'a shift that has started cannot be deleted'
);
select lives_ok(
  $$ delete from public.shifts where id = '00000000-0000-0000-0000-0000000005a4' $$,
  'a coordinator can delete an upcoming shift, even a cancelled one'
);
delete from public.shifts where id = '00000000-0000-0000-0000-0000000005b1';

reset role;
select results_eq(
  $$ select id from public.shifts
     where id in ('00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-0000000005a4',
                  '00000000-0000-0000-0000-0000000005b1')
     order by id $$,
  $$ values ('00000000-0000-0000-0000-0000000005a1'::uuid), ('00000000-0000-0000-0000-0000000005b1'::uuid) $$,
  'deleting removes the shift; volunteers and other organizations delete nothing'
);

-- ---------------------------------------------------------------------------
-- Maintenance and organization deletion
-- ---------------------------------------------------------------------------
select pg_temp.sign_out();
select lives_ok(
  $$ insert into public.shifts (org_id, title, start_time, end_time, capacity)
     values ((select id from t_org), 'Last month', now() - interval '30 days',
             now() - interval '30 days' + interval '3 hours', 4) $$,
  'scripts without a signed-in user can record past shifts (seed data, imports)'
);
select lives_ok(
  $$ update public.shifts set title = 'Started (renamed by maintenance)'
     where id = '00000000-0000-0000-0000-0000000005a2' $$,
  'scripts without a signed-in user can correct a started shift'
);

set local role authenticated;
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000e1');
select lives_ok(
  $$ delete from public.organizations where id = (select id from t_org) $$,
  'an owner can delete their organization, including shifts that have started'
);
reset role;
select is(
  (select count(*)::integer from public.shifts where org_id = (select id from t_org)),
  0,
  'the organization''s shifts are deleted with it'
);

-- ---------------------------------------------------------------------------
-- Signed-out callers
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok(
  $$ select title from public.shifts $$,
  '42501',
  null,
  'signed-out users cannot read shifts'
);
select throws_ok(
  $$ select public.cancel_shift('00000000-0000-0000-0000-0000000005b1') $$,
  '42501',
  null,
  'signed-out users cannot cancel shifts'
);
reset role;

select * from finish();
rollback;
