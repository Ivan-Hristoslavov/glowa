-- ---------------------------------------------------------------------------
-- Lavena · online bookings are confirmed on the spot; deposit bookings wait
-- for the deposit; a reminder is never queued for a moment already past.
-- ---------------------------------------------------------------------------
begin;
create extension if not exists pgtap with schema extensions;

select plan(5);

select set_config('app.trusted_write', 'on', true);

insert into public.businesses (id, slug, name, status, timezone, default_locale, deposits_enabled)
values ('00000000-0000-4000-8000-0000000000c1', 'confirm-salon', 'Confirm Salon',
  'active', 'Europe/Sofia', 'bg', true);

insert into public.staff_profiles (id, business_id, display_name, is_bookable)
values ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-0000000000c1', 'Stylist', true);

insert into public.services (id, business_id, name, duration_minutes, price_cents, currency, is_active,
  requires_deposit, deposit_cents)
values
  ('00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-0000000000c1',
   '{"bg": "Без депозит"}'::jsonb, 60, 4000, 'EUR', true, false, 0),
  ('00000000-0000-4000-8000-0000000000c4', '00000000-0000-4000-8000-0000000000c1',
   '{"bg": "С депозит"}'::jsonb, 60, 8000, 'EUR', true, true, 2000);

insert into auth.users (id, email, aud, role, instance_id)
values ('00000000-0000-4000-8000-0000000000c5', 'confirm@example.test',
  'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

select set_config('app.trusted_write', 'off', true);
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000c5","role":"authenticated"}', true);

insert into public.appointments (id, service_id, staff_profile_id, starts_at, ends_at, status, price_cents)
values
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000c3',
   '00000000-0000-4000-8000-0000000000c2', now() + interval '3 hours', now() + interval '4 hours', 'confirmed', 1),
  ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000c4',
   '00000000-0000-4000-8000-0000000000c2', now() + interval '5 hours', now() + interval '6 hours', 'confirmed', 1),
  ('00000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-0000000000c3',
   '00000000-0000-4000-8000-0000000000c2', now() + interval '5 days', now() + interval '5 days 1 hour', 'pending', 1);

reset role;

select is((select status::text from public.appointments where id = '00000000-0000-4000-8000-0000000000d1'),
  'confirmed', 'an online booking with no deposit is confirmed immediately');

select is((select status::text from public.appointments where id = '00000000-0000-4000-8000-0000000000d2'),
  'pending', 'a booking that asks for a deposit stays pending until it is paid');

select is((select count(*)::int from public.notification_deliveries
  where appointment_id = '00000000-0000-4000-8000-0000000000d1' and event_type = 'reminder'),
  0, 'no reminder is queued for a visit three hours away (the lead is a day)');

select is((select count(*)::int from public.notification_deliveries
  where appointment_id = '00000000-0000-4000-8000-0000000000d1' and event_type = 'booking_confirmation'),
  1, 'the confirmation is still queued');

select is((select count(*)::int from public.notification_deliveries
  where appointment_id = '00000000-0000-4000-8000-0000000000d3' and event_type = 'reminder'),
  1, 'a booking made further out than the lead still gets its reminder');

select * from finish();
rollback;
