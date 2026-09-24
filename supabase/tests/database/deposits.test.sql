-- ---------------------------------------------------------------------------
-- GLOWA · deposits
--
-- Run with `supabase test db`. The deposit lifecycle is enforced in Postgres
-- because every path that touches an appointment - the booking RPC, a direct
-- REST insert, the admin calendar, the webhook, the sweep - has to agree on
-- it, and the only place they all pass through is the table.
-- ---------------------------------------------------------------------------
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

-- --- fixtures --------------------------------------------------------------
select set_config('app.trusted_write', 'on', true);

insert into auth.users (id, email, aud, role)
values ('00000000-0000-4000-8000-00000000c0de', 'deposit.customer@example.test',
        'authenticated', 'authenticated');

insert into public.businesses (id, slug, name, status, timezone, default_locale, currency)
values ('00000000-0000-4000-8000-0000000000d1', 'test-deposit-salon', 'Deposit Salon',
        'active', 'Europe/Sofia', 'bg', 'EUR');

insert into public.staff_profiles (id, business_id, display_name, is_bookable)
values ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000d1',
        'Stylist', true);

insert into public.services (
  id, business_id, name, duration_minutes, price_cents, currency, is_active,
  requires_deposit, deposit_cents
)
values ('00000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-0000000000d1',
        '{"bg": "Балеаж"}'::jsonb, 60, 10000, 'EUR', true, true, 2000);

select set_config('app.trusted_write', 'off', true);

-- ---------------------------------------------------------------------------
-- 1. The "accepts deposits" flag belongs to Stripe's state, not to the salon
-- ---------------------------------------------------------------------------
update public.businesses set deposits_enabled = true
where id = '00000000-0000-4000-8000-0000000000d1';

select is(
  (select deposits_enabled from public.businesses where id = '00000000-0000-4000-8000-0000000000d1'),
  false,
  'deposits_enabled cannot be switched on by a plain update'
);

select public.link_payment_account('00000000-0000-4000-8000-0000000000d1', 'acct_test_deposits');
select public.sync_payment_account('acct_test_deposits', true, true, true);

select is(
  (select deposits_enabled from public.businesses where id = '00000000-0000-4000-8000-0000000000d1'),
  true,
  'sync_payment_account mirrors charges_enabled onto the business'
);

-- ---------------------------------------------------------------------------
-- 2. A customer booking a deposit service is held, not confirmed
-- ---------------------------------------------------------------------------
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000c0de", "role": "authenticated"}',
  true
);
set local role authenticated;

insert into public.appointments (service_id, staff_profile_id, starts_at, ends_at)
values ('00000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-0000000000d2',
        now() + interval '3 days', now() + interval '3 days 1 hour');

select throws_ok(
  $$update public.appointments set deposit_status = 'paid'
    where customer_profile_id = '00000000-0000-4000-8000-00000000c0de'$$,
  '42501',
  null,
  'a customer cannot mark their own deposit paid'
);

reset role;

select results_eq(
  $$select deposit_status::text, deposit_cents, payment_due_at > now() + interval '30 minutes'
    from public.appointments where customer_profile_id = '00000000-0000-4000-8000-00000000c0de'$$,
  $$values ('awaiting', 2000, true)$$,
  'the booking awaits a 20 € deposit and holds the slot for over half an hour'
);

select is(
  (select count(*)::integer from public.notification_deliveries n
   join public.appointments a on a.id = n.appointment_id
   where a.customer_profile_id = '00000000-0000-4000-8000-00000000c0de'),
  0,
  'no confirmation is sent for a booking that is not yet secured'
);

-- ---------------------------------------------------------------------------
-- 3. Paying settles it, once
-- ---------------------------------------------------------------------------
select is(
  public.settle_deposit(
    (select id from public.appointments where customer_profile_id = '00000000-0000-4000-8000-00000000c0de'),
    'cs_test_1', 'pi_test_1', 2000, 'eur'
  ),
  'paid',
  'settle_deposit marks the deposit paid'
);

select is(
  public.settle_deposit(
    (select id from public.appointments where customer_profile_id = '00000000-0000-4000-8000-00000000c0de'),
    'cs_test_1', 'pi_test_1', 2000, 'eur'
  ),
  'already',
  'the webhook and the return page can both settle without double-counting'
);

select ok(
  exists (
    select 1 from public.notification_deliveries n
    join public.appointments a on a.id = n.appointment_id
    where a.customer_profile_id = '00000000-0000-4000-8000-00000000c0de'
      and n.event_type = 'booking_confirmation'
  ),
  'the confirmation goes out when the deposit lands'
);

-- ---------------------------------------------------------------------------
-- 4. Cancelling in time queues the refund in the same transaction
-- ---------------------------------------------------------------------------
set local role authenticated;
select public.cancel_appointment(
  (select id from public.appointments where customer_profile_id = '00000000-0000-4000-8000-00000000c0de'),
  'test'
);
reset role;

select results_eq(
  $$select a.deposit_status::text,
           (select count(*)::integer from public.payment_records p
            where p.appointment_id = a.id and p.kind = 'refund' and p.status = 'pending')
    from public.appointments a
    where a.customer_profile_id = '00000000-0000-4000-8000-00000000c0de'$$,
  $$values ('refund_pending', 1)$$,
  'a customer cancellation queues exactly one refund'
);

select results_eq(
  $$select payment_reference, account_id from public.pending_deposit_refunds(10)
    where appointment_id = (select id from public.appointments
                            where customer_profile_id = '00000000-0000-4000-8000-00000000c0de')$$,
  $$values ('pi_test_1'::text, 'acct_test_deposits'::text)$$,
  'the refund worker sees the payment to refund and the account to refund it on'
);

select public.complete_deposit_refund(
  (select refund_id from public.pending_deposit_refunds(10)
   where appointment_id = (select id from public.appointments
                           where customer_profile_id = '00000000-0000-4000-8000-00000000c0de')),
  're_test_1', true
);

select is(
  (select deposit_status::text from public.appointments
   where customer_profile_id = '00000000-0000-4000-8000-00000000c0de'),
  'refunded',
  'a completed refund marks the deposit refunded'
);

-- ---------------------------------------------------------------------------
-- 5. An unpaid hold lapses and frees the slot; a late payment goes back
-- ---------------------------------------------------------------------------
set local role authenticated;
insert into public.appointments (service_id, staff_profile_id, starts_at, ends_at)
values ('00000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-0000000000d2',
        now() + interval '4 days', now() + interval '4 days 1 hour');
reset role;

select set_config('app.trusted_write', 'on', true);
update public.appointments set payment_due_at = now() - interval '10 minutes'
where customer_profile_id = '00000000-0000-4000-8000-00000000c0de'
  and deposit_status = 'awaiting';
select set_config('app.trusted_write', 'off', true);

select is(public.expire_unpaid_deposits(), 1, 'the sweep releases the lapsed hold');

select results_eq(
  $$select status::text, deposit_status::text from public.appointments
    where customer_profile_id = '00000000-0000-4000-8000-00000000c0de'
      and starts_at > now() + interval '3 days 12 hours'$$,
  $$values ('cancelled', 'void')$$,
  'a lapsed hold is cancelled and its deposit void'
);

select is(
  public.settle_deposit(
    (select id from public.appointments
     where customer_profile_id = '00000000-0000-4000-8000-00000000c0de'
       and starts_at > now() + interval '3 days 12 hours'),
    'cs_test_2', 'pi_test_2', 2000, 'eur'
  ),
  'refunding',
  'money that arrives after the hold lapsed is refunded, not kept'
);

select * from finish();
rollback;
