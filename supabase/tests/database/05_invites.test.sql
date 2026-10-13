-- Invites: who can create them, token storage, visibility, preview, redemption, revocation.
begin;
select plan(33);

create function pg_temp.sign_in_as(p_user_id uuid) returns void language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated')::text,
    true
  );
$$;

-- o = owner, c = coordinator, v = volunteer, x and y = outsiders
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@example.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'coordinator@example.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'volunteer@example.test'),
  ('00000000-0000-0000-0000-0000000000a4', 'newcomer@example.test'),
  ('00000000-0000-0000-0000-0000000000a5', 'latecomer@example.test');

set local role authenticated;
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000a1');
select public.create_organization('Invite Test', 'invite-test');
reset role;

-- Shared state for the test, readable while impersonating users.
create temp table t_org as select id from public.organizations where slug = 'invite-test';
create temp table t_tokens (label text primary key, token text not null);
-- anon too, so signed-out checks fail on the function itself, not on this table.
grant select on t_org to authenticated, anon;
grant select, insert on t_tokens to authenticated;

insert into public.memberships (org_id, user_id, role)
select (select id from t_org), u.user_id, u.role
from (values ('00000000-0000-0000-0000-0000000000a2'::uuid, 'coordinator'::public.membership_role),
             ('00000000-0000-0000-0000-0000000000a3'::uuid, 'volunteer'::public.membership_role)) as u (user_id, role);

-- ---------------------------------------------------------------------------
-- Creating invites
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000a1');

select lives_ok(
  $$ insert into t_tokens
     select 'coord', token from public.create_invite((select id from t_org), 'coordinator') $$,
  'an owner can invite a coordinator'
);
select lives_ok(
  $$ insert into t_tokens
     select 'vol1', token from public.create_invite((select id from t_org)) $$,
  'an owner can invite a volunteer (the default role)'
);
select throws_ok(
  $$ select public.create_invite((select id from t_org), 'owner') $$,
  '42501',
  'NOT_AUTHORIZED',
  'nobody can be invited as an owner'
);

select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000a2');
select lives_ok(
  $$ insert into t_tokens
     select 'vol2', token from public.create_invite((select id from t_org), 'volunteer') $$,
  'a coordinator can invite a volunteer'
);
select throws_ok(
  $$ select public.create_invite((select id from t_org), 'coordinator') $$,
  '42501',
  'NOT_AUTHORIZED',
  'a coordinator cannot invite another coordinator'
);

select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000a3');
select throws_ok(
  $$ select public.create_invite((select id from t_org)) $$,
  '42501',
  'NOT_AUTHORIZED',
  'a volunteer cannot create invites'
);

select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000a4');
select throws_ok(
  $$ select public.create_invite((select id from t_org)) $$,
  '42501',
  'NOT_AUTHORIZED',
  'an outsider cannot create invites'
);

-- ---------------------------------------------------------------------------
-- Token storage
-- ---------------------------------------------------------------------------
reset role;
select is(
  (select count(*)::int from t_tokens where token ~ '^[A-Za-z0-9_-]{43}$'),
  3,
  'tokens are 43 URL-safe characters (32 random bytes)'
);
select is(
  (select count(*)::int
   from public.invites i
   join t_tokens t on i.token_hash = sha256(convert_to(t.token, 'UTF8'))),
  3,
  'only the SHA-256 hash of each token is stored'
);
select hasnt_column('public', 'invites', 'token', 'there is no column for the token itself');

-- ---------------------------------------------------------------------------
-- Visibility (RLS filters silently, so count what each user sees)
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000a2');
select is(
  (select count(*)::int from public.invites),
  3,
  'a coordinator sees the organization''s invites'
);
select throws_ok(
  $$ select token_hash from public.invites $$,
  '42501',
  null,
  'nobody can read token hashes through the API'
);

select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000a3');
select is((select count(*)::int from public.invites), 0, 'a volunteer sees no invites');

select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000a4');
select is((select count(*)::int from public.invites), 0, 'an outsider sees no invites');

-- ---------------------------------------------------------------------------
-- Previewing and redeeming
-- ---------------------------------------------------------------------------
select results_eq(
  $$ select org_name, role, status
     from public.get_invite((select token from t_tokens where label = 'vol1')) $$,
  $$ values ('Invite Test'::text, 'volunteer'::public.membership_role, 'valid'::text) $$,
  'an invitee can preview a valid invite'
);
select throws_ok(
  $$ select * from public.get_invite('not-a-real-token') $$,
  'P0001',
  'INVITE_NOT_FOUND',
  'an unknown token is not found'
);

select is(
  public.redeem_invite((select token from t_tokens where label = 'vol1')),
  (select id from t_org),
  'redeeming an invite returns the organization'
);

reset role;
select results_eq(
  $$ select m.role, i.used_by
     from public.memberships m
     join public.invites i on i.used_by = m.user_id
     where m.user_id = '00000000-0000-0000-0000-0000000000a4' $$,
  $$ values ('volunteer'::public.membership_role, '00000000-0000-0000-0000-0000000000a4'::uuid) $$,
  'the invitee joins with the invite''s role, and the invite is marked used'
);

set local role authenticated;
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000a4');
select is(
  public.redeem_invite((select token from t_tokens where label = 'vol1')),
  (select id from t_org),
  'redeeming the same link again is harmless for the person who used it'
);
select is(
  (select status from public.get_invite((select token from t_tokens where label = 'vol1'))),
  'member',
  'the person who used a link sees that they are a member'
);

select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000a5');
select is(
  (select status from public.get_invite((select token from t_tokens where label = 'vol1'))),
  'used',
  'someone else sees that the link was used'
);
select throws_ok(
  $$ select public.redeem_invite((select token from t_tokens where label = 'vol1')) $$,
  'P0001',
  'INVITE_USED',
  'a used invite cannot let a second person in'
);

-- An existing member following an invite keeps their role and leaves the invite unused.
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000a3');
select is(
  public.redeem_invite((select token from t_tokens where label = 'coord')),
  (select id from t_org),
  'a member redeeming an invite is sent to the organization'
);

reset role;
select is(
  (select role from public.memberships where user_id = '00000000-0000-0000-0000-0000000000a3'),
  'volunteer'::public.membership_role,
  'a member''s role is not changed by redeeming an invite'
);
select ok(
  (select used_at is null from public.invites i
   join t_tokens t on i.token_hash = sha256(convert_to(t.token, 'UTF8'))
   where t.label = 'coord'),
  'an invite redeemed by an existing member stays available'
);

-- ---------------------------------------------------------------------------
-- Expiry
-- ---------------------------------------------------------------------------
update public.invites i set expires_at = now() - interval '1 minute'
from t_tokens t
where t.label = 'vol2' and i.token_hash = sha256(convert_to(t.token, 'UTF8'));

set local role authenticated;
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000a5');
select is(
  (select status from public.get_invite((select token from t_tokens where label = 'vol2'))),
  'expired',
  'an expired invite previews as expired'
);
select throws_ok(
  $$ select public.redeem_invite((select token from t_tokens where label = 'vol2')) $$,
  'P0001',
  'INVITE_EXPIRED',
  'an expired invite cannot be redeemed'
);

-- ---------------------------------------------------------------------------
-- Revoking
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000a3');
delete from public.invites;

reset role;
select is((select count(*)::int from public.invites), 3, 'a volunteer cannot revoke invites');

-- The app revokes by id (token_hash isn't readable through the API).
create temp table t_revoke as
select i.id from public.invites i
join t_tokens t on i.token_hash = sha256(convert_to(t.token, 'UTF8'))
where t.label = 'coord';
grant select on t_revoke to authenticated;

set local role authenticated;
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000a2');
delete from public.invites where id = (select id from t_revoke);

reset role;
select is((select count(*)::int from public.invites), 2, 'a coordinator can revoke an invite');

-- ---------------------------------------------------------------------------
-- Pending limit (vol1 is used and vol2 expired, so none are pending now)
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000a1');
select lives_ok(
  $$ select public.create_invite((select id from t_org)) from generate_series(1, 25) $$,
  'an organization can have 25 pending invites'
);
select throws_ok(
  $$ select public.create_invite((select id from t_org)) $$,
  'P0001',
  'INVITE_LIMIT_REACHED',
  'a 26th pending invite is refused'
);

-- ---------------------------------------------------------------------------
-- Signed-out callers
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok(
  $$ select public.create_invite((select id from t_org)) $$,
  '42501',
  null,
  'signed-out users cannot create invites'
);
select throws_ok(
  $$ select public.redeem_invite('anything') $$,
  '42501',
  null,
  'signed-out users cannot redeem invites'
);

select * from finish();
rollback;
