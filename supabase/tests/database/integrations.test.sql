-- Partner API, webhooks and calendar feeds: who may touch them, and that a
-- booking made through the API obeys the same availability as the site.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

select set_config('app.trusted_write', 'on', true);

insert into auth.users (id, email, aud, role, instance_id) values
  ('00000000-0000-4000-8000-0000000000e1', 'owner-int@example.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-4000-8000-0000000000e2', 'stylist-int@example.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-4000-8000-0000000000e3', 'other-int@example.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

insert into public.businesses (id, slug, name, status, timezone, default_locale)
values
  ('00000000-0000-4000-8000-0000000000f1', 'int-salon', 'Int Salon', 'active', 'Europe/Sofia', 'bg'),
  ('00000000-0000-4000-8000-0000000000f9', 'int-other', 'Int Other', 'active', 'Europe/Sofia', 'bg');

insert into public.business_members (business_id, profile_id, role, status) values
  ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000e1', 'owner', 'active'),
  ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000e2', 'staff', 'active'),
  ('00000000-0000-4000-8000-0000000000f9', '00000000-0000-4000-8000-0000000000e3', 'owner', 'active');

insert into public.locations (id, business_id, name, is_primary)
values ('00000000-0000-4000-8000-0000000000f2', '00000000-0000-4000-8000-0000000000f1', 'Main', true);

insert into public.business_hours (location_id, day_of_week, opens_at, closes_at)
select '00000000-0000-4000-8000-0000000000f2', d, time '08:00', time '20:00' from generate_series(0, 6) d;

insert into public.staff_profiles (id, business_id, display_name, is_bookable) values
  ('00000000-0000-4000-8000-0000000000f3', '00000000-0000-4000-8000-0000000000f1', 'Ana', true);

insert into public.staff_working_hours (staff_profile_id, day_of_week, starts_at, ends_at)
select '00000000-0000-4000-8000-0000000000f3', d, time '08:00', time '20:00' from generate_series(0, 6) d;

insert into public.services (id, business_id, name, duration_minutes, price_cents, currency, is_active, external_id)
values ('00000000-0000-4000-8000-0000000000f4', '00000000-0000-4000-8000-0000000000f1',
  '{"bg": "Подстригване"}'::jsonb, 60, 3000, 'EUR', true, 'site-cut');

insert into public.service_staff (service_id, staff_profile_id)
values ('00000000-0000-4000-8000-0000000000f4', '00000000-0000-4000-8000-0000000000f3');

select set_config('app.trusted_write', 'off', true);

-- --- keys: the owner manages them, a stylist and a stranger cannot ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);

select lives_ok($$
  insert into public.api_keys (business_id, name, key_prefix, key_hash)
  values ('00000000-0000-4000-8000-0000000000f1', 'Website', 'lv_live_abcd',
          '0000000000000000000000000000000000000000000000000000000000000001')
$$, 'an owner can create a key');

select throws_ok($$ select key_hash from public.api_keys $$, '42501', null,
  'the stored hash cannot be read back through the API');

select is((select count(*)::int from public.api_keys), 1, 'the owner sees the key');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e2","role":"authenticated"}', true);
select is((select count(*)::int from public.api_keys), 0, 'a stylist sees none');
select throws_ok($$
  insert into public.api_keys (business_id, name, key_prefix, key_hash)
  values ('00000000-0000-4000-8000-0000000000f1', 'Sneaky', 'lv_live_zzzz',
          '0000000000000000000000000000000000000000000000000000000000000002')
$$, '42501', null, 'a stylist cannot create one');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e3","role":"authenticated"}', true);
select is((select count(*)::int from public.api_keys), 0, 'another salon sees none');
select throws_ok($$ select * from public.verify_api_key('0000000000000000000000000000000000000000000000000000000000000001') $$,
  '42501', null, 'a signed-in person cannot run key verification');

-- --- webhooks: plain http is refused, the secret never comes back -----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
select throws_ok($$
  insert into public.webhook_endpoints (business_id, url, secret)
  values ('00000000-0000-4000-8000-0000000000f1', 'http://insecure.example/hook', 'whsec_0123456789012345678901234567')
$$, '23514', null, 'a webhook must be https');

select lives_ok($$
  insert into public.webhook_endpoints (business_id, url, secret)
  values ('00000000-0000-4000-8000-0000000000f1', 'https://salon.example/hook', 'whsec_0123456789012345678901234567')
$$, 'an https webhook can be added');

select throws_ok($$ select secret from public.webhook_endpoints $$, '42501', null,
  'the signing secret cannot be read back');
reset role;

-- --- service role: verify, book, idempotency, cancel ------------------------
set local role service_role;

select is((select count(*)::int from public.verify_api_key('0000000000000000000000000000000000000000000000000000000000000001')),
  1, 'the server resolves a key by its hash');
select is((select count(*)::int from public.verify_api_key('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')),
  0, 'an unknown hash resolves to nothing');

create temp table t_slot as
select ((current_date + 3)::timestamp + time '10:00') at time zone 'Europe/Sofia' as at;

select is((select (public.api_book_appointment(
  '00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000f4',
  (select at from t_slot), 'Maria', p_customer_email => 'maria@example.test', p_notes => 'first visit', p_external_ref => 'site-booking-1')).status::text),
  'confirmed', 'an API booking is confirmed and picks a free stylist');

select is((select (public.api_book_appointment(
  '00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000f4',
  (select at from t_slot), 'Maria', p_customer_email => 'maria@example.test', p_notes => 'first visit', p_external_ref => 'site-booking-1')).external_ref),
  'site-booking-1', 'a retried request returns the booking it already made');

select is((select count(*)::int from public.appointments where external_ref = 'site-booking-1'),
  1, 'and does not book twice');

select throws_ok($$
  select public.api_book_appointment(
    '00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000f4',
    (select at from t_slot), 'Petar', p_customer_email => 'petar@example.test', p_external_ref => 'site-booking-2')
$$, '23514', 'That time is no longer available', 'the same minute cannot be booked twice');

select throws_ok($$
  select public.api_book_appointment(
    '00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000f4',
    (select at + interval '2 hours' from t_slot), '', p_external_ref => 'site-booking-3')
$$, '23514', 'A name and an email or phone are required', 'a booking needs a name and a way to reach the person');

select throws_ok($$
  select public.api_book_appointment(
    '00000000-0000-4000-8000-0000000000f9', '00000000-0000-4000-8000-0000000000f4',
    (select at + interval '3 hours' from t_slot), 'Eve', p_customer_email => 'eve@example.test')
$$, '23514', null, 'a key from another salon cannot book this salon''s service');

select is((select (public.api_cancel_appointment(
  '00000000-0000-4000-8000-0000000000f1',
  (select id from public.appointments where external_ref = 'site-booking-1'), 'client asked')).status::text),
  'cancelled', 'a booking can be cancelled through the API');
reset role;

select is((select count(*)::int from public.webhook_deliveries
  where business_id = '00000000-0000-4000-8000-0000000000f1' and event in ('booking.created', 'booking.cancelled')),
  2, 'the endpoint was queued a created and a cancelled event');

select * from finish();
rollback;
