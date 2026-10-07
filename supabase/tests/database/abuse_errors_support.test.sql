-- Rate limit counters, the error log and the support inbox: who may touch them.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select set_config('app.trusted_write', 'on', true);
insert into auth.users (id, email, aud, role, instance_id) values
  ('00000000-0000-4000-8000-0000000000d1', 'root2@example.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-4000-8000-0000000000d2', 'person@example.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
insert into public.platform_admins (profile_id) values ('00000000-0000-4000-8000-0000000000d1');
select set_config('app.trusted_write', 'off', true);

-- the counter: only the server can use it, and it counts
set local role service_role;
select is(public.rate_limit_check('t:a', 2, 60), true, 'first hit is allowed');
select is(public.rate_limit_check('t:a', 2, 60), true, 'second hit is allowed');
select is(public.rate_limit_check('t:a', 2, 60), false, 'third hit in the window is refused');
select is(public.rate_limit_check('t:b', 2, 60), true, 'another key has its own allowance');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d2","role":"authenticated"}', true);
select throws_ok($$ select public.rate_limit_check('t:a', 2, 60) $$, '42501', null, 'a signed-in visitor cannot touch the counters');
reset role;

set local role anon;
select throws_ok($$ select public.rate_limit_check('t:a', 2, 60) $$, '42501', null, 'an anonymous visitor cannot either');
reset role;

-- data the server wrote
insert into public.error_events (source, fingerprint, message, path) values
  ('server', 'fp1', 'boom', '/bg/x'), ('server', 'fp1', 'boom', '/bg/x');
insert into public.support_tickets (id, profile_id, email, subject, message)
values ('00000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-0000000000d2', 'person@example.test', 'Help', 'Something is broken');

-- a normal person
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d2","role":"authenticated"}', true);
select throws_ok($$ select public.platform_errors() $$, '42501', 'Not a platform admin', 'a non-admin cannot read the error log');
select throws_ok($$ select public.platform_support() $$, '42501', 'Not a platform admin', 'a non-admin cannot read the support inbox');
select is((select count(*)::int from public.support_tickets), 1, 'but sees their own request');
select throws_ok($$ select count(*) from public.error_events $$, '42501', null, 'and cannot read the error table directly');

-- the platform admin
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d1","role":"authenticated"}', true);
select is((public.platform_errors() -> 0 ->> 'count')::int, 2, 'errors are grouped by fingerprint');
select lives_ok($$ select public.platform_set_ticket_status('00000000-0000-4000-8000-0000000000d3', 'done') $$, 'a ticket can be closed');

select * from finish();
rollback;
