-- Profiles: created on signup; visible to yourself and people you share an organization with.
begin;
select plan(11);

-- Impersonate a signed-in user the way the API does: role `authenticated` + JWT claims.
create function pg_temp.sign_in_as(p_user_id uuid) returns void language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated')::text,
    true
  );
$$;

-- Alice and Bob share an organization; Carol is in none.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.test', '{"full_name": "Alice Owner"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.test',
    '{"name": "Bob Volunteer", "avatar_url": "https://example.test/bob.png"}'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@example.test', '{}');

-- Signup trigger
select is(
  (select full_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'Alice Owner',
  'signup creates a profile named from full_name'
);
select is(
  (select full_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b'),
  'Bob Volunteer',
  'signup falls back to the OAuth "name" claim'
);
select is(
  (select avatar_url from public.profiles where id = '00000000-0000-0000-0000-00000000000b'),
  'https://example.test/bob.png',
  'signup copies the avatar URL'
);
select is(
  (select full_name from public.profiles where id = '00000000-0000-0000-0000-00000000000c'),
  null,
  'signup without metadata leaves the name empty'
);
select is(
  (select timezone from public.profiles where id = '00000000-0000-0000-0000-00000000000c'),
  'UTC',
  'new profiles default to UTC'
);

-- Alice creates an org; Bob joins it (memberships are written by RPCs in the app).
set local role authenticated;
select pg_temp.sign_in_as('00000000-0000-0000-0000-00000000000a');
select public.create_organization('Food Bank', 'food-bank');
reset role;
insert into public.memberships (org_id, user_id, role)
select id, '00000000-0000-0000-0000-00000000000b', 'volunteer'
from public.organizations where slug = 'food-bank';

-- Visibility
set local role authenticated;
select pg_temp.sign_in_as('00000000-0000-0000-0000-00000000000b');
select is(
  (select count(*)::int from public.profiles),
  2,
  'a member sees their own profile and fellow members, not strangers'
);

select pg_temp.sign_in_as('00000000-0000-0000-0000-00000000000c');
select is(
  (select count(*)::int from public.profiles),
  1,
  'a user with no organizations sees only their own profile'
);

-- Updates
select pg_temp.sign_in_as('00000000-0000-0000-0000-00000000000b');
update public.profiles set full_name = 'Bob V.' where id = '00000000-0000-0000-0000-00000000000b';
update public.profiles set full_name = 'Hacked' where id = '00000000-0000-0000-0000-00000000000a';

select throws_ok(
  $$ update public.profiles set timezone = 'Mars/Olympus_Mons'
     where id = '00000000-0000-0000-0000-00000000000b' $$,
  '23514',
  null,
  'an unknown time zone is rejected'
);
select throws_ok(
  $$ update public.profiles set id = gen_random_uuid()
     where id = '00000000-0000-0000-0000-00000000000b' $$,
  '42501',
  null,
  'users cannot change a profile id'
);

reset role;
select is(
  (select full_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b'),
  'Bob V.',
  'users can update their own profile'
);
select is(
  (select full_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'Alice Owner',
  'users cannot update someone else''s profile'
);

select * from finish();
rollback;
