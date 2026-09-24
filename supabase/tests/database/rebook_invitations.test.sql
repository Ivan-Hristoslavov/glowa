-- ---------------------------------------------------------------------------
-- GLOWA · rebook invitations and the value summary
--
-- Run with `supabase test db`. The invitation is queued by a trigger and
-- re-checked by `rebook_invitation_context` at send time, so both halves are
-- tested here against the same fixtures.
-- ---------------------------------------------------------------------------
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

-- --- fixtures --------------------------------------------------------------
select set_config('app.trusted_write', 'on', true);

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-4000-8000-0000000ab001', 'rebook.owner@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000ab002', 'rebook.outsider@example.test', 'authenticated', 'authenticated');

insert into public.businesses (id, slug, name, status, timezone, default_locale, currency)
values ('00000000-0000-4000-8000-0000000ab0b1', 'test-rebook-salon', 'Rebook Salon',
        'active', 'Europe/Sofia', 'bg', 'EUR');

insert into public.business_members (business_id, profile_id, role, status)
values ('00000000-0000-4000-8000-0000000ab0b1', '00000000-0000-4000-8000-0000000ab001',
        'owner', 'active');

insert into public.staff_profiles (id, business_id, display_name, is_bookable)
values ('00000000-0000-4000-8000-0000000ab0c1', '00000000-0000-4000-8000-0000000ab0b1',
        'Maria', true);

insert into public.services (id, business_id, name, duration_minutes, price_cents, currency,
                             is_active, rebook_after_days)
values
  ('00000000-0000-4000-8000-0000000ab0d1', '00000000-0000-4000-8000-0000000ab0b1',
   '{"bg": "Гел лак"}'::jsonb, 60, 3000, 'EUR', true, 21),
  ('00000000-0000-4000-8000-0000000ab0d2', '00000000-0000-4000-8000-0000000ab0b1',
   '{"bg": "Консултация"}'::jsonb, 30, 0, 'EUR', true, null);

-- Four guests, each with a visit two days ago that is still "confirmed".
insert into public.appointments (id, business_id, service_id, staff_profile_id,
                                 customer_name, customer_email, price_cents, currency,
                                 starts_at, ends_at, status, source)
values
  ('00000000-0000-4000-8000-0000000ab0e1', '00000000-0000-4000-8000-0000000ab0b1',
   '00000000-0000-4000-8000-0000000ab0d1', '00000000-0000-4000-8000-0000000ab0c1',
   'Ана', 'ana@example.test', 3000, 'EUR',
   now() - interval '2 days', now() - interval '2 days' + interval '1 hour', 'confirmed', 'customer_web'),
  ('00000000-0000-4000-8000-0000000ab0e2', '00000000-0000-4000-8000-0000000ab0b1',
   '00000000-0000-4000-8000-0000000ab0d2', '00000000-0000-4000-8000-0000000ab0c1',
   'Бела', 'bela@example.test', 0, 'EUR',
   now() - interval '2 days' + interval '2 hours', now() - interval '2 days' + interval '150 minutes',
   'confirmed', 'customer_web'),
  ('00000000-0000-4000-8000-0000000ab0e3', '00000000-0000-4000-8000-0000000ab0b1',
   '00000000-0000-4000-8000-0000000ab0d1', '00000000-0000-4000-8000-0000000ab0c1',
   'Вера', 'vera@example.test', 3000, 'EUR',
   now() - interval '2 days' + interval '3 hours', now() - interval '2 days' + interval '4 hours',
   'confirmed', 'business_admin'),
  ('00000000-0000-4000-8000-0000000ab0e4', '00000000-0000-4000-8000-0000000ab0b1',
   '00000000-0000-4000-8000-0000000ab0d1', '00000000-0000-4000-8000-0000000ab0c1',
   'Галя', 'galya@example.test', 3000, 'EUR',
   now() - interval '30 days', now() - interval '30 days' + interval '1 hour',
   'confirmed', 'business_admin');

-- Vera already has her next visit in the diary.
insert into public.appointments (business_id, service_id, staff_profile_id,
                                 customer_name, customer_email, price_cents, currency,
                                 starts_at, ends_at, status, source)
values ('00000000-0000-4000-8000-0000000ab0b1', '00000000-0000-4000-8000-0000000ab0d1',
        '00000000-0000-4000-8000-0000000ab0c1', 'Вера', 'VERA@example.test', 3000, 'EUR',
        now() + interval '10 days', now() + interval '10 days 1 hour', 'confirmed', 'business_admin');

update public.appointments set status = 'completed', completed_at = now()
where id in ('00000000-0000-4000-8000-0000000ab0e1', '00000000-0000-4000-8000-0000000ab0e2',
             '00000000-0000-4000-8000-0000000ab0e3', '00000000-0000-4000-8000-0000000ab0e4');

select set_config('app.trusted_write', 'off', true);

-- ---------------------------------------------------------------------------
-- 1. Queueing
-- ---------------------------------------------------------------------------
select results_eq(
  $$select count(*)::integer,
           bool_and(abs(extract(epoch from (scheduled_for - (a.starts_at + interval '21 days')))) < 1)
    from public.notification_deliveries d
    join public.appointments a on a.id = d.appointment_id
    where d.appointment_id = '00000000-0000-4000-8000-0000000ab0e1'
      and d.event_type = 'rebook_nudge'$$,
  $$values (1, true)$$,
  'a completed visit of a service with an interval queues one invitation, 21 days after the visit'
);

select is(
  (select count(*)::integer from public.notification_deliveries
   where appointment_id = '00000000-0000-4000-8000-0000000ab0e2' and event_type = 'rebook_nudge'),
  0,
  'a service without an interval invites nobody'
);

select is(
  (select count(*)::integer from public.notification_deliveries
   where appointment_id = '00000000-0000-4000-8000-0000000ab0e3' and event_type = 'rebook_nudge'),
  0,
  'a client whose next visit is already booked (email matched case-insensitively) is not invited'
);

select is(
  (select count(*)::integer from public.notification_deliveries
   where appointment_id = '00000000-0000-4000-8000-0000000ab0e4' and event_type = 'rebook_nudge'),
  0,
  'a visit whose invitation date has already passed invites nobody'
);

select set_config('app.trusted_write', 'on', true);
update public.appointments set internal_notes = 'touched', status = 'completed'
where id = '00000000-0000-4000-8000-0000000ab0e1';
select set_config('app.trusted_write', 'off', true);

select is(
  (select count(*)::integer from public.notification_deliveries
   where appointment_id = '00000000-0000-4000-8000-0000000ab0e1' and event_type = 'rebook_nudge'),
  1,
  'touching a completed visit again does not queue a second invitation'
);

-- ---------------------------------------------------------------------------
-- 2. The send-time check
-- ---------------------------------------------------------------------------
select is(
  (select state from public.rebook_invitation_context('00000000-0000-4000-8000-0000000ab0e1')),
  'due',
  'nothing has changed: the invitation is due'
);

select ok(
  (select unsubscribe_token is not null
   from public.rebook_invitation_context('00000000-0000-4000-8000-0000000ab0e1')),
  'the context carries the client''s unsubscribe token for the way out'
);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000ab002", "role": "authenticated"}', true);
select throws_ok(
  $$select * from public.rebook_invitation_context('00000000-0000-4000-8000-0000000ab0e1')$$,
  '42501',
  null,
  'only the worker (service role) may ask for the context'
);
reset role;

update public.services set rebook_after_days = null
where id = '00000000-0000-4000-8000-0000000ab0d1';
select is(
  (select state from public.rebook_invitation_context('00000000-0000-4000-8000-0000000ab0e1')),
  'switched_off',
  'the salon switching the interval off stops invitations already queued'
);
update public.services set rebook_after_days = 21
where id = '00000000-0000-4000-8000-0000000ab0d1';

-- Ana books again herself before the invitation goes out.
select set_config('app.trusted_write', 'on', true);
insert into public.appointments (id, business_id, service_id, staff_profile_id,
                                 customer_name, customer_email, price_cents, currency,
                                 starts_at, ends_at, status, source)
values ('00000000-0000-4000-8000-0000000ab0e9', '00000000-0000-4000-8000-0000000ab0b1',
        '00000000-0000-4000-8000-0000000ab0d1', '00000000-0000-4000-8000-0000000ab0c1',
        'Ана', 'ana@example.test', 3000, 'EUR',
        now() + interval '5 days', now() + interval '5 days 1 hour', 'confirmed', 'customer_web');
select set_config('app.trusted_write', 'off', true);

select is(
  (select state from public.rebook_invitation_context('00000000-0000-4000-8000-0000000ab0e1')),
  'returned',
  'a client who booked again is not invited'
);

-- She cancels it: the invitation is due again.
select set_config('app.trusted_write', 'on', true);
update public.appointments set status = 'cancelled', cancelled_at = now()
where id = '00000000-0000-4000-8000-0000000ab0e9';
select set_config('app.trusted_write', 'off', true);
select is(
  (select state from public.rebook_invitation_context('00000000-0000-4000-8000-0000000ab0e1')),
  'due',
  'a cancelled booking does not count as coming back'
);

-- ---------------------------------------------------------------------------
-- 3. The way out
-- ---------------------------------------------------------------------------
select results_eq(
  $$select already_unsubscribed from public.unsubscribe_marketing(
      (select unsubscribe_token from public.rebook_invitation_context('00000000-0000-4000-8000-0000000ab0e1')))$$,
  $$values (false)$$,
  'a client who was never asked can still say no, and it is recorded'
);

select results_eq(
  $$select status, error from public.notification_deliveries
    where appointment_id = '00000000-0000-4000-8000-0000000ab0e1' and event_type = 'rebook_nudge'$$,
  $$values ('skipped'::text, 'unsubscribed'::text)$$,
  'the queued invitation stops at once'
);

select is(
  (select state from public.rebook_invitation_context('00000000-0000-4000-8000-0000000ab0e1')),
  'declined',
  'and the send-time check agrees'
);

-- ---------------------------------------------------------------------------
-- 4. The value summary reads through RLS
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000ab001", "role": "authenticated"}', true);
select results_eq(
  $$select online_bookings, online_value_cents
    from public.business_value_summary('00000000-0000-4000-8000-0000000ab0b1',
                                       now() - interval '1 day', now() + interval '1 day')$$,
  $$values (2, 3000::bigint)$$,
  'the owner sees the online bookings made in the window (a cancelled one has no value)'
);

select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000ab002", "role": "authenticated"}', true);
select results_eq(
  $$select online_bookings, online_value_cents
    from public.business_value_summary('00000000-0000-4000-8000-0000000ab0b1',
                                       now() - interval '1 day', now() + interval '1 day')$$,
  $$values (0, 0::bigint)$$,
  'somebody else gets zeros, not the salon''s numbers'
);
reset role;

select * from finish();
rollback;
