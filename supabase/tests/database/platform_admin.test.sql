-- The platform console reads across every salon, so it must answer only to
-- people listed in platform_admins - never to a salon owner.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

select set_config('app.trusted_write', 'on', true);
insert into auth.users (id, email, aud, role, instance_id) values
  ('00000000-0000-4000-8000-0000000000a1', 'platform@example.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-4000-8000-0000000000a2', 'owner@example.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
insert into public.businesses (id, slug, name, status, timezone, default_locale)
values ('00000000-0000-4000-8000-0000000000a3', 'platform-test-salon', 'Platform Test Salon', 'active', 'Europe/Sofia', 'bg');
insert into public.platform_admins (profile_id) values ('00000000-0000-4000-8000-0000000000a1');
select set_config('app.trusted_write', 'off', true);

set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);
select is(app.is_platform_admin(), false, 'a salon owner is not a platform admin');
select throws_ok($$ select public.platform_overview(7) $$, '42501', 'Not a platform admin',
  'the overview refuses a non-admin');
select is((select count(*)::int from public.platform_admins), 0,
  'a non-admin cannot even see who the admins are');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
select is(app.is_platform_admin(), true, 'a listed profile is a platform admin');
select is(jsonb_array_length(public.platform_overview(7) -> 'daily'), 7, 'the overview returns one point per day');
select ok((select bool_or(s ->> 'slug' = 'platform-test-salon')
  from jsonb_array_elements(public.platform_overview(7) -> 'salons') s),
  'the admin sees every salon, not only their own');

select * from finish();
rollback;
