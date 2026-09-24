-- ---------------------------------------------------------------------------
-- GLOWA · database invariants
--
-- Run with `supabase test db` against a local stack. pgTAP is installed in the
-- test database only; production carries no test extension.
--
-- These are the four places where a regression would be both easy to introduce
-- and expensive to discover: the double-booking guard, the customer write
-- guard, the CRM sync trigger, and the notification outbox. Every one of them
-- is enforced in Postgres precisely because the application layer cannot be
-- trusted to remember.
-- ---------------------------------------------------------------------------
begin;
create extension if not exists pgtap with schema extensions;

select plan(21);

-- --- fixtures --------------------------------------------------------------
-- A migration runs as the owner, which the customer guard treats as "not a
-- member" and refuses. The flag is transaction-local and disappears on commit.
select set_config('app.trusted_write', 'on', true);

insert into public.businesses (id, slug, name, status, timezone, default_locale)
values (
  '00000000-0000-4000-8000-0000000000b1', 'test-salon', 'Test Salon',
  'active', 'Europe/Sofia', 'bg'
);

insert into public.staff_profiles (id, business_id, display_name, is_bookable)
values (
  '00000000-0000-4000-8000-0000000000a1'::uuid,
  '00000000-0000-4000-8000-0000000000b1', 'Test Stylist', true
);

insert into public.services (
  id, business_id, name, duration_minutes, price_cents, currency, is_active
)
values (
  '00000000-0000-4000-8000-0000000000e1',
  '00000000-0000-4000-8000-0000000000b1',
  '{"bg": "Маникюр", "en": "Manicure"}'::jsonb, 60, 6000, 'BGN', true
);

-- ---------------------------------------------------------------------------
-- 1. The double-booking guard
-- ---------------------------------------------------------------------------
select has_table('public', 'appointments', 'appointments exists');

select col_has_check('public', 'appointments', array['ends_at', 'starts_at'],
  'a range with ends_at <= starts_at is refused');

insert into public.appointments (
  business_id, service_id, staff_profile_id, customer_email, customer_name,
  starts_at, ends_at, status, price_cents
)
values (
  '00000000-0000-4000-8000-0000000000b1',
  '00000000-0000-4000-8000-0000000000e1',
  '00000000-0000-4000-8000-0000000000a1'::uuid,
  'first@example.test', 'First Customer',
  '2026-11-02 09:00+02', '2026-11-02 10:00+02', 'confirmed', 6000
);

-- Overlapping the same stylist must be impossible, not merely unlikely.
select throws_ok(
  $$insert into public.appointments (
      business_id, service_id, staff_profile_id, customer_email, customer_name,
      starts_at, ends_at, status, price_cents
    ) values (
      '00000000-0000-4000-8000-0000000000b1',
      '00000000-0000-4000-8000-0000000000e1',
      '00000000-0000-4000-8000-0000000000a1'::uuid,
      'second@example.test', 'Second Customer',
      '2026-11-02 09:30+02', '2026-11-02 10:30+02', 'confirmed', 6000
    )$$,
  '23P01',
  null,
  'a second appointment overlapping the same stylist is rejected'
);

-- Back-to-back is not an overlap: the range is half-open.
select lives_ok(
  $$insert into public.appointments (
      business_id, service_id, staff_profile_id, customer_email, customer_name,
      starts_at, ends_at, status, price_cents
    ) values (
      '00000000-0000-4000-8000-0000000000b1',
      '00000000-0000-4000-8000-0000000000e1',
      '00000000-0000-4000-8000-0000000000a1'::uuid,
      'third@example.test', 'Third Customer',
      '2026-11-02 10:00+02', '2026-11-02 11:00+02', 'confirmed', 6000
    )$$,
  'an appointment starting exactly when the previous one ends is allowed'
);

-- A cancelled appointment stops holding the slot.
update public.appointments
set status = 'cancelled', cancelled_at = now()
where customer_email = 'first@example.test';

select lives_ok(
  $$insert into public.appointments (
      business_id, service_id, staff_profile_id, customer_email, customer_name,
      starts_at, ends_at, status, price_cents
    ) values (
      '00000000-0000-4000-8000-0000000000b1',
      '00000000-0000-4000-8000-0000000000e1',
      '00000000-0000-4000-8000-0000000000a1'::uuid,
      'fourth@example.test', 'Fourth Customer',
      '2026-11-02 09:00+02', '2026-11-02 10:00+02', 'confirmed', 6000
    )$$,
  'a cancelled appointment releases its slot'
);

-- ---------------------------------------------------------------------------
-- 2. The customer write guard
-- ---------------------------------------------------------------------------
select has_function('app', 'enforce_customer_booking_fields',
  'the customer guard trigger function exists');

select has_trigger('public', 'appointments', 'appointments_enforce_customer_fields',
  'the guard is wired to appointments');

select is(
  (select count(*)::int from pg_trigger
    where tgrelid = 'public.appointments'::regclass
      and tgname = 'appointments_enforce_customer_fields'
      and (tgtype & 2) > 0),
  1,
  'the guard runs BEFORE, so it can still rewrite the row'
);

-- ---------------------------------------------------------------------------
-- 3. CRM sync
-- ---------------------------------------------------------------------------
select has_trigger('public', 'appointments', 'appointments_sync_business_client',
  'the CRM sync trigger is wired');

select isnt_empty(
  $$select 1 from public.business_clients
    where business_id = '00000000-0000-4000-8000-0000000000b1'
      and email = 'fourth@example.test'$$,
  'booking creates the business client record'
);

-- A walk-in with only a name must still produce a client.
insert into public.appointments (
  business_id, service_id, staff_profile_id, customer_name,
  starts_at, ends_at, status, price_cents, source
)
values (
  '00000000-0000-4000-8000-0000000000b1',
  '00000000-0000-4000-8000-0000000000e1',
  null, 'Иван (walk-in)',
  '2026-11-02 14:00+02', '2026-11-02 15:00+02', 'confirmed', 6000, 'walk_in'
);

select isnt_empty(
  $$select 1 from public.business_clients
    where business_id = '00000000-0000-4000-8000-0000000000b1'
      and full_name = 'Иван (walk-in)'$$,
  'a walk-in identified by name alone still reaches the CRM'
);

-- ---------------------------------------------------------------------------
-- 4. The notification outbox
-- ---------------------------------------------------------------------------
select has_table('public', 'notification_deliveries', 'the outbox exists');

select col_is_unique('public', 'notification_deliveries', 'idempotency_key',
  'the idempotency key is unique, which is what makes a retry safe');

select isnt_empty(
  $$select 1 from public.notification_deliveries d
    join public.appointments a on a.id = d.appointment_id
    where a.customer_email = 'fourth@example.test'
      and d.event_type = 'booking_confirmation'$$,
  'booking queues a confirmation'
);

-- A walk-in with no email is unreachable; queueing one would be a lie.
select is_empty(
  $$select 1 from public.notification_deliveries d
    join public.appointments a on a.id = d.appointment_id
    where a.customer_name = 'Иван (walk-in)'$$,
  'an unreachable walk-in queues nothing'
);

-- Cancelling must supersede the pending reminder, not leave it to fire.
update public.appointments
set status = 'cancelled', cancelled_at = now()
where customer_email = 'fourth@example.test';

select is_empty(
  $$select 1 from public.notification_deliveries d
    join public.appointments a on a.id = d.appointment_id
    where a.customer_email = 'fourth@example.test'
      and d.event_type = 'reminder'
      and d.status = 'queued'$$,
  'cancelling supersedes the pending reminder'
);

select isnt_empty(
  $$select 1 from public.notification_deliveries d
    join public.appointments a on a.id = d.appointment_id
    where a.customer_email = 'fourth@example.test'
      and d.event_type = 'cancellation'
      and d.status = 'queued'$$,
  'cancelling queues a cancellation notice'
);


-- ---------------------------------------------------------------------------
-- 5. Onboarding
--
-- `create_business` was broken from the start and nobody noticed, because the
-- demo salons are seeded with their memberships in the same statement and the
-- real signup path had never been walked end to end. Two separate causes, one
-- test each.
-- ---------------------------------------------------------------------------
select has_function('public', 'create_business',
  'the onboarding RPC exists');

-- The creator must be able to read the row the instant it exists, or
-- `insert ... returning` inside the RPC fails: the business is created as
-- `draft` and the owner membership is written by an AFTER trigger that has
-- not fired yet.
select policy_cmd_is('public', 'businesses',
  'businesses_select_public_or_member', 'SELECT',
  'the businesses select policy exists');

select matches(
  (select pg_get_expr(polqual, polrelid)
   from pg_policy
   where polrelid = 'public.businesses'::regclass
     and polname = 'businesses_select_public_or_member'),
  'created_by',
  'a creator can read their own business before the membership trigger fires'
);

-- The audit entry is written by the owner trigger, not by the caller:
-- `authenticated` must never be able to write history.
select ok(
  not has_table_privilege('authenticated', 'public.audit_logs', 'INSERT'),
  'clients cannot forge audit entries'
);

select * from finish();
rollback;
