-- ---------------------------------------------------------------------------
-- Lavena · deleting an account must work and must leave the salon's books
-- intact: the booking stays, the link to the deleted person goes.
--
-- Deleting auth.users sets appointments.customer_profile_id / created_by to
-- NULL through their foreign keys. That UPDATE runs with no signed-in user,
-- and the customer write guard used to reject it, so "Delete my account"
-- failed with "Database error deleting user".
-- ---------------------------------------------------------------------------
begin;
create extension if not exists pgtap with schema extensions;

select plan(5);

select set_config('app.trusted_write', 'on', true);

insert into public.businesses (id, slug, name, status, timezone, default_locale)
values ('00000000-0000-4000-8000-0000000000e1', 'delete-salon', 'Delete Salon',
  'active', 'Europe/Sofia', 'bg');

insert into public.staff_profiles (id, business_id, display_name, is_bookable)
values ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-0000000000e1', 'Stylist', true);

insert into public.services (id, business_id, name, duration_minutes, price_cents, currency, is_active)
values ('00000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-0000000000e1',
  '{"bg": "Подстригване"}'::jsonb, 60, 4000, 'EUR', true);

insert into auth.users (id, email, aud, role, instance_id)
values ('00000000-0000-4000-8000-0000000000e5', 'leaving@example.test',
  'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

select set_config('app.trusted_write', 'off', true);
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000e5","role":"authenticated"}', true);

insert into public.appointments (id, service_id, staff_profile_id, starts_at, ends_at, status, price_cents)
values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000e3',
  '00000000-0000-4000-8000-0000000000e2', now() + interval '3 days', now() + interval '3 days 1 hour', 'confirmed', 1);

reset role;
-- The Auth service deletes users over a connection with no signed-in user.
select set_config('request.jwt.claims', '', true);

select is((select customer_profile_id from public.appointments where id = '00000000-0000-4000-8000-0000000000f1'),
  '00000000-0000-4000-8000-0000000000e5'::uuid, 'the booking belongs to the customer before deletion');

select lives_ok($$ delete from auth.users where id = '00000000-0000-4000-8000-0000000000e5' $$,
  'deleting the account is not blocked by the booking guard');

select is((select count(*)::int from public.appointments where id = '00000000-0000-4000-8000-0000000000f1'),
  1, 'the salon keeps the booking');

select is((select customer_profile_id from public.appointments where id = '00000000-0000-4000-8000-0000000000f1'),
  null::uuid, 'the booking no longer points at the deleted person');

select is((select created_by from public.appointments where id = '00000000-0000-4000-8000-0000000000f1'),
  null::uuid, 'neither does its creator column');

select * from finish();
rollback;
