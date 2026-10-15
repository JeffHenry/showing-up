-- Signups: claiming and dropping out, the capacity and overlap rules, who can see and remove
-- signups, and how signups interact with shift changes and members leaving.
begin;
select plan(52);

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

-- o = owner, c = coordinator, v and w = volunteers, x = outsider (owns another organization)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'owner@example.test'),
  ('00000000-0000-0000-0000-0000000000f2', 'coordinator@example.test'),
  ('00000000-0000-0000-0000-0000000000f3', 'volunteer@example.test'),
  ('00000000-0000-0000-0000-0000000000f4', 'second.volunteer@example.test'),
  ('00000000-0000-0000-0000-0000000000f5', 'outsider@example.test');

set local role authenticated;
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000f1');
select public.create_organization('Signups Test', 'signups-test');
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000f5');
select public.create_organization('Elsewhere', 'elsewhere');
reset role;
select pg_temp.sign_out();

create temp table t_org as select id from public.organizations where slug = 'signups-test';
create temp table t_other_org as select id from public.organizations where slug = 'elsewhere';
grant select on t_org, t_other_org to authenticated, anon;

insert into public.memberships (org_id, user_id, role)
select (select id from t_org), u.user_id, u.role
from (values ('00000000-0000-0000-0000-0000000000f2'::uuid, 'coordinator'::public.membership_role),
             ('00000000-0000-0000-0000-0000000000f3'::uuid, 'volunteer'::public.membership_role),
             ('00000000-0000-0000-0000-0000000000f4'::uuid, 'volunteer'::public.membership_role)) as u (user_id, role);

-- Shifts, all tomorrow unless noted (hours after midnight-ish "now + 1 day"):
--   A  0:00–3:00  capacity 2          B  1:00–2:30  overlaps A
--   C  3:00–5:00  starts as A ends    J  4:00–6:00  overlaps C, capacity 3
--   D  started an hour ago            E  cancelled
--   F  in 3 days, capacity 1          H  in 4 days
--   G  another organization's
insert into public.shifts (id, org_id, title, start_time, end_time, capacity, cancelled_at) values
  ('00000000-0000-0000-0000-0000000006a1', (select id from t_org), 'A',
   now() + interval '1 day', now() + interval '1 day 3 hours', 2, null),
  ('00000000-0000-0000-0000-0000000006a2', (select id from t_org), 'B',
   now() + interval '1 day 1 hour', now() + interval '1 day 2 hours 30 minutes', 5, null),
  ('00000000-0000-0000-0000-0000000006a3', (select id from t_org), 'C',
   now() + interval '1 day 3 hours', now() + interval '1 day 5 hours', 5, null),
  ('00000000-0000-0000-0000-0000000006a4', (select id from t_org), 'D',
   now() - interval '1 hour', now() + interval '2 hours', 5, null),
  ('00000000-0000-0000-0000-0000000006a5', (select id from t_org), 'E',
   now() + interval '2 days', now() + interval '2 days 2 hours', 5, now()),
  ('00000000-0000-0000-0000-0000000006a6', (select id from t_org), 'F',
   now() + interval '3 days', now() + interval '3 days 2 hours', 1, null),
  ('00000000-0000-0000-0000-0000000006a7', (select id from t_org), 'H',
   now() + interval '4 days', now() + interval '4 days 2 hours', 5, null),
  ('00000000-0000-0000-0000-0000000006a8', (select id from t_org), 'J',
   now() + interval '1 day 4 hours', now() + interval '1 day 6 hours', 3, null),
  ('00000000-0000-0000-0000-0000000006b1', (select id from t_other_org), 'G',
   now() + interval '1 day', now() + interval '1 day 2 hours', 5, null);

-- v was signed up for D before it started (written directly, as maintenance would).
insert into public.signups (org_id, shift_id, user_id)
values ((select id from t_org), '00000000-0000-0000-0000-0000000006a4',
        '00000000-0000-0000-0000-0000000000f3');

create function pg_temp.filled(p_shift_id uuid) returns integer language sql as $$
  select confirmed_count from public.shifts where id = p_shift_id;
$$;

-- ---------------------------------------------------------------------------
-- Structure
-- ---------------------------------------------------------------------------
select policies_are(
  'public', 'signups',
  array['signups: read own, or all as coordinator'],
  'signups has exactly the expected policy (read-only; writes go through functions)'
);
select is(pg_temp.filled('00000000-0000-0000-0000-0000000006a4'), 1,
  'the confirmed count follows signups, however they are written');

-- ---------------------------------------------------------------------------
-- Claiming
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000f3');
select lives_ok(
  $$ select public.claim_shift('00000000-0000-0000-0000-0000000006a1') $$,
  'a volunteer can claim a spot'
);
select lives_ok(
  $$ select public.claim_shift('00000000-0000-0000-0000-0000000006a1') $$,
  'claiming again does nothing (a double click or retry)'
);
reset role;
select is(pg_temp.filled('00000000-0000-0000-0000-0000000006a1'), 1,
  'a claim fills one spot, once');
select is(
  (select version from public.shifts where id = '00000000-0000-0000-0000-0000000006a1'), 1,
  'signups never bump the shift''s version (no false edit conflicts)'
);

set local role authenticated;
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000f3');
select throws_ok(
  $$ select public.claim_shift('00000000-0000-0000-0000-0000000006a2') $$,
  'P0001', 'SCHEDULE_CONFLICT',
  'a shift overlapping one already claimed is refused'
);
select lives_ok(
  $$ select public.claim_shift('00000000-0000-0000-0000-0000000006a3') $$,
  'back-to-back shifts are fine'
);
select throws_ok(
  $$ select public.claim_shift('00000000-0000-0000-0000-0000000006a5') $$,
  'P0001', 'SHIFT_CANCELLED',
  'a cancelled shift cannot be claimed'
);
select throws_ok(
  $$ select public.claim_shift('00000000-0000-0000-0000-0000000006a4') $$,
  'P0001', 'SHIFT_STARTED',
  'a shift that has started cannot be claimed'
);
select throws_ok(
  $$ select public.claim_shift('00000000-0000-0000-0000-0000000006b1') $$,
  '42501', 'NOT_AUTHORIZED',
  'another organization''s shift cannot be claimed'
);
select throws_ok(
  $$ select public.claim_shift('00000000-0000-0000-0000-000000000000') $$,
  '42501', 'NOT_AUTHORIZED',
  'a missing shift looks the same as a forbidden one'
);

select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000f4');
select lives_ok(
  $$ select public.claim_shift('00000000-0000-0000-0000-0000000006a6') $$,
  'someone takes the only spot'
);
select lives_ok(
  $$ select public.claim_shift('00000000-0000-0000-0000-0000000006a7') $$,
  'a volunteer claims a later shift'
);
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000f3');
select throws_ok(
  $$ select public.claim_shift('00000000-0000-0000-0000-0000000006a6') $$,
  'P0001', 'SHIFT_FULL',
  'a full shift cannot be claimed'
);
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000f2');
select lives_ok(
  $$ select public.claim_shift('00000000-0000-0000-0000-0000000006a1') $$,
  'coordinators can sign up too'
);
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000f4');
select throws_ok(
  $$ select public.claim_shift('00000000-0000-0000-0000-0000000006a1') $$,
  'P0001', 'SHIFT_FULL',
  'the last spot, once taken, is gone'
);

-- ---------------------------------------------------------------------------
-- Who can see signups, and no direct writes
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000f3');
select is(
  (select count(*)::integer from public.signups
   where user_id <> '00000000-0000-0000-0000-0000000000f3'),
  0,
  'a volunteer sees no one else''s signups'
);
select is((select count(*)::integer from public.signups), 3,
  'a volunteer sees their own signups');

select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000f2');
select is((select count(*)::integer from public.signups), 6,
  'a coordinator sees every signup in their organization');

select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000f5');
select is((select count(*)::integer from public.signups), 0,
  'an outsider sees none of another organization''s signups');

select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000f3');
select throws_ok(
  $$ insert into public.signups (org_id, shift_id, user_id)
     values ((select id from t_org), '00000000-0000-0000-0000-0000000006a6',
             '00000000-0000-0000-0000-0000000000f3') $$,
  '42501', null,
  'nobody can sign up by writing the table directly (skipping the capacity check)'
);
select throws_ok(
  $$ update public.signups set status = 'cancelled'
     where user_id = '00000000-0000-0000-0000-0000000000f3' $$,
  '42501', null,
  'nobody can update signups directly'
);
select throws_ok(
  $$ delete from public.signups where user_id = '00000000-0000-0000-0000-0000000000f3' $$,
  '42501', null,
  'nobody can delete signups directly'
);

-- ---------------------------------------------------------------------------
-- Dropping out
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ select public.cancel_signup('00000000-0000-0000-0000-0000000006a1') $$,
  'a volunteer can drop out'
);
reset role;
select results_eq(
  $$ select status::text, cancelled_by, pg_temp.filled(shift_id) from public.signups
     where shift_id = '00000000-0000-0000-0000-0000000006a1'
       and user_id = '00000000-0000-0000-0000-0000000000f3' $$,
  $$ values ('cancelled'::text, '00000000-0000-0000-0000-0000000000f3'::uuid, 1) $$,
  'dropping out records who and frees the spot'
);

set local role authenticated;
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000f3');
select lives_ok(
  $$ select public.claim_shift('00000000-0000-0000-0000-0000000006a2') $$,
  'once dropped, an overlapping shift can be claimed'
);
select lives_ok(
  $$ select public.cancel_signup('00000000-0000-0000-0000-0000000006a2') $$,
  'and dropped again'
);
select lives_ok(
  $$ select public.claim_shift('00000000-0000-0000-0000-0000000006a1') $$,
  'a volunteer can sign up again after dropping out'
);
reset role;
select results_eq(
  $$ select count(*)::integer, min(status::text), min(pg_temp.filled(shift_id)) from public.signups
     where shift_id = '00000000-0000-0000-0000-0000000006a1'
       and user_id = '00000000-0000-0000-0000-0000000000f3' $$,
  $$ values (1, 'confirmed'::text, 2) $$,
  'signing up again reuses the same signup'
);

set local role authenticated;
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000f3');
select throws_ok(
  $$ select public.cancel_signup('00000000-0000-0000-0000-0000000006a4') $$,
  'P0001', 'SHIFT_STARTED',
  'a signup locks once the shift starts'
);
select lives_ok(
  $$ select public.cancel_signup('00000000-0000-0000-0000-0000000006a7') $$,
  'dropping out of a shift you never claimed does nothing'
);

-- ---------------------------------------------------------------------------
-- Coordinators removing someone
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ select public.cancel_signup('00000000-0000-0000-0000-0000000006a6',
                                 '00000000-0000-0000-0000-0000000000f4') $$,
  '42501', 'NOT_AUTHORIZED',
  'a volunteer cannot remove someone else'
);
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000f5');
select throws_ok(
  $$ select public.cancel_signup('00000000-0000-0000-0000-0000000006a6',
                                 '00000000-0000-0000-0000-0000000000f4') $$,
  '42501', 'NOT_AUTHORIZED',
  'an outsider cannot remove anyone'
);
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000f2');
select lives_ok(
  $$ select public.cancel_signup('00000000-0000-0000-0000-0000000006a6',
                                 '00000000-0000-0000-0000-0000000000f4') $$,
  'a coordinator can remove someone from a shift'
);
reset role;
select results_eq(
  $$ select status::text, cancelled_by, pg_temp.filled(shift_id) from public.signups
     where shift_id = '00000000-0000-0000-0000-0000000006a6' $$,
  $$ values ('cancelled'::text, '00000000-0000-0000-0000-0000000000f2'::uuid, 0) $$,
  'a removal records the coordinator and frees the spot'
);

-- ---------------------------------------------------------------------------
-- Shift changes
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000f2');
select lives_ok(
  $$ select public.cancel_shift('00000000-0000-0000-0000-0000000006a3') $$,
  'a shift with signups can be cancelled'
);
reset role;
select is(
  (select status::text from public.signups
   where shift_id = '00000000-0000-0000-0000-0000000006a3'
     and user_id = '00000000-0000-0000-0000-0000000000f3'),
  'confirmed',
  'cancelling a shift keeps its signups, so volunteers see it was called off'
);

set local role authenticated;
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000f3');
select lives_ok(
  $$ select public.claim_shift('00000000-0000-0000-0000-0000000006a8') $$,
  'a cancelled shift doesn''t block claiming one that overlaps it'
);
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000f2');
select lives_ok(
  $$ select public.claim_shift('00000000-0000-0000-0000-0000000006a8') $$,
  'a second person signs up'
);
select throws_ok(
  $$ update public.shifts set capacity = 1 where id = '00000000-0000-0000-0000-0000000006a8' $$,
  'P0001', 'CAPACITY_BELOW_SIGNUPS',
  'capacity cannot drop below the people signed up'
);
select lives_ok(
  $$ update public.shifts set capacity = 2 where id = '00000000-0000-0000-0000-0000000006a8' $$,
  'capacity can drop to exactly the people signed up'
);
select throws_ok(
  $$ delete from public.shifts where id = '00000000-0000-0000-0000-0000000006a8' $$,
  'P0001', 'SHIFT_HAS_SIGNUPS',
  'a shift people are signed up for cannot be deleted'
);
select lives_ok(
  $$ delete from public.shifts where id = '00000000-0000-0000-0000-0000000006a6' $$,
  'a shift with only dropped signups can be deleted'
);
reset role;
select is(
  (select count(*)::integer from public.signups
   where shift_id = '00000000-0000-0000-0000-0000000006a6'),
  0,
  'its dropped signups go with it'
);

-- ---------------------------------------------------------------------------
-- Leaving the organization
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000f3');
select lives_ok(
  $$ delete from public.memberships
     where org_id = (select id from t_org) and user_id = '00000000-0000-0000-0000-0000000000f3' $$,
  'a volunteer with signups can leave'
);
reset role;
select results_eq(
  $$ select s.title from public.signups su join public.shifts s on s.id = su.shift_id
     where su.user_id = '00000000-0000-0000-0000-0000000000f3' and su.status = 'confirmed' $$,
  $$ values ('D'::text) $$,
  'leaving drops upcoming signups and keeps those for shifts that have started'
);
select is(
  (select cancelled_by from public.signups
   where shift_id = '00000000-0000-0000-0000-0000000006a8'
     and user_id = '00000000-0000-0000-0000-0000000000f3'),
  '00000000-0000-0000-0000-0000000000f3'::uuid,
  'the dropped signups record who left'
);

set local role authenticated;
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000f1');
select lives_ok(
  $$ delete from public.organizations where id = (select id from t_org) $$,
  'an owner can still delete an organization with signups'
);
reset role;
select is(
  (select count(*)::integer from public.signups where org_id = (select id from t_org)),
  0,
  'the organization''s signups are deleted with it'
);

-- ---------------------------------------------------------------------------
-- Signed-out callers
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok(
  $$ select status from public.signups $$,
  '42501', null,
  'signed-out users cannot read signups'
);
select throws_ok(
  $$ select public.claim_shift('00000000-0000-0000-0000-0000000006b1') $$,
  '42501', null,
  'signed-out users cannot claim shifts'
);
reset role;

select * from finish();
rollback;
