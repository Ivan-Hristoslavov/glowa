-- ---------------------------------------------------------------------------
-- GLOWA · 0028 · deposits
--
-- A no-show is an hour of a stylist's day that nobody pays for. A deposit is
-- the one thing that reliably stops it, and it is what salons pay a booking
-- platform for. The schema had `requires_deposit` and `payment_records` from
-- the start; nothing ever charged anything.
--
-- The money never touches GLOWA. Each salon connects its own Stripe account
-- and the deposit is a direct charge on it: the salon is the merchant, its
-- name is on the statement, refunds and disputes are between it and its
-- client. GLOWA holds no funds, so it needs no licence to hold them.
--
-- The lifecycle, and who is allowed to move it:
--
--   none ─ the booking needs no deposit (or came from the salon's own desk)
--   awaiting ─ booked online, slot held for ~30 minutes until the deposit is
--              paid; confirmation email is held back until then
--   paid ─ Stripe says so (webhook or the return-page check)
--   void ─ never paid: the hold lapsed or the customer walked away
--   waived ─ the salon confirmed without waiting for it
--   refund_pending → refunded ─ cancelled in time, money goes back
--   retained ─ no-show, or a late cancellation the salon chose to keep
--   applied ─ the visit happened; the deposit is part of the bill
--
-- Nobody writes these columns directly. A customer cannot mark their own
-- deposit paid, and a salon cannot either - only the payment path (service
-- role, `app.trusted_write`) and the status transitions below move them.
-- ---------------------------------------------------------------------------

create type public.deposit_status as enum (
  'none', 'awaiting', 'paid', 'waived', 'void',
  'refund_pending', 'refunded', 'retained', 'applied'
);

-- --- the salon's payment account ------------------------------------------

-- Metadata only. The Stripe account id is an identifier, not a credential:
-- without GLOWA's platform key it opens nothing. Still, only a salon's
-- administrators need to see it.
create table public.business_payment_accounts (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  provider text not null default 'stripe' check (provider = 'stripe'),
  account_id text not null unique,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.business_payment_accounts
  for each row execute function app.set_updated_at();

alter table public.business_payment_accounts enable row level security;

-- Read-only for the salon's admins. Every write comes from Stripe's own state
-- through the service-role functions below; a salon cannot claim to be able
-- to take payments by editing a row.
create policy "business_payment_accounts_select_admin"
  on public.business_payment_accounts
  for select to authenticated
  using (app.is_business_admin(business_id));

revoke all on public.business_payment_accounts from anon, authenticated;
grant select on public.business_payment_accounts to authenticated;

-- Public, because the salon page and the booking flow have to say "a deposit
-- of 10 € secures this" before anyone signs in. Maintained by
-- `sync_payment_account`; frozen against every other writer.
alter table public.businesses
  add column deposits_enabled boolean not null default false;

create or replace function app.freeze_deposits_flag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.trusted_write', true), 'off') = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.deposits_enabled := false;
  else
    new.deposits_enabled := old.deposits_enabled;
  end if;
  return new;
end;
$$;

create trigger businesses_freeze_deposits_flag
  before insert or update on public.businesses
  for each row execute function app.freeze_deposits_flag();

-- --- the appointment side --------------------------------------------------

alter table public.appointments
  add column deposit_cents integer not null default 0 check (deposit_cents >= 0),
  add column deposit_status public.deposit_status not null default 'none',
  -- When an unpaid hold lapses. Only meaningful while `awaiting`.
  add column payment_due_at timestamptz,
  add constraint appointments_awaiting_has_due
    check (deposit_status <> 'awaiting' or payment_due_at is not null);

create index appointments_awaiting_deposit_idx
  on public.appointments (payment_due_at)
  where deposit_status = 'awaiting';

alter table public.payment_records
  -- The checkout session is `provider_reference`; the payment it produced is
  -- this, and it is what a refund is issued against.
  add column provider_payment_reference text,
  -- A refund row points at the deposit it returns.
  add column related_payment_id uuid references public.payment_records (id) on delete set null;

create index payment_records_related_idx
  on public.payment_records (related_payment_id)
  where related_payment_id is not null;

create index payment_records_pending_refunds_idx
  on public.payment_records (created_at)
  where kind = 'refund' and status = 'pending';

-- Runs after `appointments_enforce_customer_fields` (triggers fire in name
-- order), so on a customer insert `source`, `service_id` and `price_cents`
-- are already the trusted values when the deposit is derived from them.
create or replace function app.settle_deposit_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trusted boolean :=
    coalesce(current_setting('app.trusted_write', true), 'off') = 'on';
  v_requested public.deposit_status := new.deposit_status;
  v_service public.services%rowtype;
  v_enabled boolean;
begin
  if tg_op = 'INSERT' then
    if v_trusted then
      return new;
    end if;

    new.deposit_cents := 0;
    new.deposit_status := 'none';
    new.payment_due_at := null;

    if new.source = 'customer_web'
      and new.status = 'pending'
      and new.service_id is not null
    then
      select s.* into v_service from public.services s where s.id = new.service_id;
      select b.deposits_enabled into v_enabled
      from public.businesses b where b.id = new.business_id;

      if v_service.id is not null
        and v_service.business_id = new.business_id
        and v_service.requires_deposit
        and v_service.deposit_cents > 0
        and coalesce(v_enabled, false)
      then
        new.deposit_cents := least(v_service.deposit_cents, new.price_cents);
        new.deposit_status := 'awaiting';
        -- Stripe Checkout sessions live at least 30 minutes; the hold is a
        -- little longer so the session always expires first.
        new.payment_due_at := now() + interval '32 minutes';
      end if;
    end if;

    return new;
  end if;

  if not v_trusted then
    new.deposit_cents := old.deposit_cents;
    new.deposit_status := old.deposit_status;
    new.payment_due_at := old.payment_due_at;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'cancelled' then
      if new.deposit_status = 'paid' then
        -- A customer can only cancel inside the window, so their deposit
        -- always goes back. A salon may keep it for a late cancellation
        -- phoned in - that is the salon's call, never the customer's.
        if v_requested = 'retained'
          and (v_trusted or app.is_business_member(new.business_id))
        then
          new.deposit_status := 'retained';
        else
          new.deposit_status := 'refund_pending';
        end if;
      elsif new.deposit_status = 'awaiting' then
        new.deposit_status := 'void';
        new.payment_due_at := null;
      end if;
    elsif new.status = 'no_show' then
      if new.deposit_status = 'paid' then
        new.deposit_status := 'retained';
      elsif new.deposit_status = 'awaiting' then
        new.deposit_status := 'void';
        new.payment_due_at := null;
      end if;
    elsif new.status = 'completed' then
      if new.deposit_status = 'paid' then
        new.deposit_status := 'applied';
      elsif new.deposit_status = 'awaiting' then
        new.deposit_status := 'waived';
        new.payment_due_at := null;
      end if;
    elsif new.status = 'confirmed' and new.deposit_status = 'awaiting' then
      -- The salon confirmed without waiting for the money. Its decision, and
      -- the hold must not then lapse underneath a confirmed booking.
      new.deposit_status := 'waived';
      new.payment_due_at := null;
    end if;
  end if;

  return new;
end;
$$;

create trigger appointments_settle_deposit
  before insert or update on public.appointments
  for each row execute function app.settle_deposit_state();

-- A refund is a row before it is an API call, exactly like a notification:
-- written in the same transaction as the cancellation, so a cancellation that
-- commits always has its refund queued and one that rolls back never does.
create or replace function app.queue_deposit_refund()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.payment_records (
    business_id, appointment_id, profile_id, kind, status,
    amount_cents, currency, provider, related_payment_id, is_demo
  )
  select
    p.business_id, p.appointment_id, p.profile_id, 'refund', 'pending',
    p.amount_cents, p.currency, p.provider, p.id, p.is_demo
  from public.payment_records p
  where p.appointment_id = new.id
    and p.kind = 'deposit'
    and p.status = 'succeeded'
    and not exists (
      select 1 from public.payment_records r
      where r.related_payment_id = p.id
        and r.kind = 'refund'
        and r.status in ('pending', 'succeeded')
    );
  return null;
end;
$$;

create trigger appointments_queue_deposit_refund
  after update on public.appointments
  for each row
  when (
    new.deposit_status = 'refund_pending'
    and old.deposit_status is distinct from new.deposit_status
  )
  execute function app.queue_deposit_refund();

-- --- notifications wait for the money ---------------------------------------

-- A confirmation for a booking that is not yet secured would be a promise the
-- salon has not made. It is held back while the deposit is awaited and sent
-- the moment it is paid (or waived). A hold that lapses unpaid was never
-- confirmed, so it produces no "cancelled" email either - the customer walked
-- away from the payment page and knows.
create or replace function app.appointment_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locale text;
  v_lead integer;
  v_reminder_at timestamptz;
begin
  if new.is_demo or new.source = 'import' then
    return new;
  end if;

  if new.customer_profile_id is null and new.customer_email is null then
    return new;
  end if;

  v_locale := app.appointment_locale(new.customer_profile_id, new.business_id);

  v_lead := coalesce(
    (select cp.reminder_lead_minutes from public.customer_preferences cp
      where cp.profile_id = new.customer_profile_id),
    1440
  );
  v_reminder_at := new.starts_at - make_interval(mins => v_lead);

  if tg_op = 'INSERT' then
    if new.status in ('pending', 'confirmed') and new.deposit_status <> 'awaiting' then
      perform app.enqueue_notification(
        new.business_id, new.id, new.customer_profile_id, 'booking_confirmation',
        v_locale, 'booking_confirmation:' || new.id::text, now()
      );

      if new.starts_at > now() then
        perform app.enqueue_notification(
          new.business_id, new.id, new.customer_profile_id, 'reminder', v_locale,
          'reminder:' || new.id::text || ':'
            || extract(epoch from new.starts_at)::bigint::text,
          v_reminder_at
        );
      end if;
    end if;
    return new;
  end if;

  -- The deposit landed: now the booking is real, and now it is confirmed.
  if old.deposit_status = 'awaiting'
    and new.deposit_status in ('paid', 'waived')
    and new.status in ('pending', 'confirmed')
  then
    perform app.enqueue_notification(
      new.business_id, new.id, new.customer_profile_id, 'booking_confirmation',
      v_locale, 'booking_confirmation:' || new.id::text, now()
    );

    if new.starts_at > now() then
      perform app.enqueue_notification(
        new.business_id, new.id, new.customer_profile_id, 'reminder', v_locale,
        'reminder:' || new.id::text || ':'
          || extract(epoch from new.starts_at)::bigint::text,
        v_reminder_at
      );
    end if;
    return new;
  end if;

  -- Never secured, so never confirmed: nothing to take back.
  if old.deposit_status = 'awaiting' and new.status is distinct from old.status then
    return new;
  end if;

  if new.status is distinct from old.status
    and new.status not in ('pending', 'confirmed')
  then
    update public.notification_deliveries
    set status = 'skipped', error = 'superseded'
    where appointment_id = new.id
      and event_type = 'reminder'
      and status = 'queued';
  elsif new.starts_at is distinct from old.starts_at then
    update public.notification_deliveries
    set status = 'skipped', error = 'superseded'
    where appointment_id = new.id
      and event_type = 'reminder'
      and status = 'queued'
      and idempotency_key <> 'reminder:' || new.id::text || ':'
        || extract(epoch from new.starts_at)::bigint::text;
  end if;

  if new.status is distinct from old.status and new.status = 'cancelled' then
    perform app.enqueue_notification(
      new.business_id, new.id, new.customer_profile_id, 'cancellation',
      v_locale, 'cancellation:' || new.id::text, now()
    );
    return new;
  end if;

  if new.status is distinct from old.status and new.status = 'completed' then
    perform app.enqueue_notification(
      new.business_id, new.id, new.customer_profile_id, 'review_request',
      v_locale, 'review_request:' || new.id::text,
      coalesce(new.completed_at, now()) + interval '3 hours'
    );
    return new;
  end if;

  if new.starts_at is distinct from old.starts_at
    and new.status in ('pending', 'confirmed')
  then
    perform app.enqueue_notification(
      new.business_id, new.id, new.customer_profile_id, 'reschedule', v_locale,
      'reschedule:' || new.id::text || ':'
        || extract(epoch from new.starts_at)::bigint::text,
      now()
    );

    if new.starts_at > now() then
      perform app.enqueue_notification(
        new.business_id, new.id, new.customer_profile_id, 'reminder', v_locale,
        'reminder:' || new.id::text || ':'
          || extract(epoch from new.starts_at)::bigint::text,
        v_reminder_at
      );
    end if;
  end if;

  return new;
end;
$$;

-- `deposit_status` joins the column list: marking a deposit paid changes
-- nothing else, and that is exactly when the confirmation has to go out.
drop trigger appointments_notifications on public.appointments;
create trigger appointments_notifications
  after insert or update of status, starts_at, deposit_status on public.appointments
  for each row execute function app.appointment_notifications();

-- --- the payment path (service role only) ----------------------------------

create or replace function public.link_payment_account(
  p_business_id uuid,
  p_account_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.business_payment_accounts (business_id, account_id)
  values (p_business_id, p_account_id)
  on conflict (business_id) do nothing;
end;
$$;

-- Mirrors what Stripe reports about an account. Keyed by the account id
-- because that is all an `account.updated` webhook carries.
create or replace function public.sync_payment_account(
  p_account_id text,
  p_charges_enabled boolean,
  p_payouts_enabled boolean,
  p_details_submitted boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
begin
  update public.business_payment_accounts
  set charges_enabled = p_charges_enabled,
      payouts_enabled = p_payouts_enabled,
      details_submitted = p_details_submitted
  where account_id = p_account_id
  returning business_id into v_business_id;

  if v_business_id is null then
    return null;
  end if;

  perform set_config('app.trusted_write', 'on', true);
  update public.businesses
  set deposits_enabled = p_charges_enabled
  where id = v_business_id
    and deposits_enabled is distinct from p_charges_enabled;
  perform set_config('app.trusted_write', 'off', true);

  return v_business_id;
end;
$$;

-- Records a paid deposit. Idempotent: the webhook and the customer's return
-- page both call it, in either order, possibly more than once.
--
-- Returns what happened: `paid`, `already`, `refunding` (the money arrived
-- after the hold lapsed, so it goes straight back), `duplicate` (a second
-- payment for a booking already secured - also refunded) or `missing`.
create or replace function public.settle_deposit(
  p_appointment_id uuid,
  p_session_id text,
  p_payment_reference text,
  p_amount_cents integer,
  p_currency text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments%rowtype;
  v_record_id uuid;
begin
  select * into v_appt
  from public.appointments a
  where a.id = p_appointment_id
  for update;

  if not found then
    return 'missing';
  end if;

  -- The money moved whatever state the booking is in, so the record comes
  -- first and unconditionally.
  insert into public.payment_records (
    business_id, appointment_id, profile_id, kind, status, amount_cents,
    currency, provider, provider_reference, provider_payment_reference, is_demo
  )
  values (
    v_appt.business_id, v_appt.id, v_appt.customer_profile_id, 'deposit',
    'succeeded', p_amount_cents, upper(p_currency), 'stripe', p_session_id,
    p_payment_reference, v_appt.is_demo
  )
  on conflict (provider, provider_reference) do update
    set status = 'succeeded',
        amount_cents = excluded.amount_cents,
        provider_payment_reference = excluded.provider_payment_reference,
        failure_reason = null
  returning id into v_record_id;

  perform set_config('app.trusted_write', 'on', true);

  -- `waived` too: the salon confirmed before the customer finished paying,
  -- and the payment still went through. It is a paid deposit now.
  if v_appt.deposit_status in ('awaiting', 'waived')
    and v_appt.status in ('pending', 'confirmed')
  then
    update public.appointments
    set deposit_status = 'paid', payment_due_at = null
    where id = v_appt.id;
    perform set_config('app.trusted_write', 'off', true);
    return 'paid';
  end if;

  if v_appt.deposit_status = 'void' then
    update public.appointments
    set deposit_status = 'refund_pending'
    where id = v_appt.id;
    perform set_config('app.trusted_write', 'off', true);
    return 'refunding';
  end if;

  perform set_config('app.trusted_write', 'off', true);

  if exists (
    select 1 from public.payment_records p
    where p.appointment_id = v_appt.id
      and p.kind = 'deposit'
      and p.status = 'succeeded'
      and p.id <> v_record_id
  ) and not exists (
    select 1 from public.payment_records r
    where r.related_payment_id = v_record_id and r.kind = 'refund'
  ) then
    insert into public.payment_records (
      business_id, appointment_id, profile_id, kind, status,
      amount_cents, currency, provider, related_payment_id, is_demo
    )
    values (
      v_appt.business_id, v_appt.id, v_appt.customer_profile_id, 'refund',
      'pending', p_amount_cents, upper(p_currency), 'stripe', v_record_id,
      v_appt.is_demo
    );
    return 'duplicate';
  end if;

  return 'already';
end;
$$;

-- Lets go of a slot whose deposit never came: the checkout could not be
-- opened, Stripe expired it, or the customer abandoned it.
create or replace function public.release_unpaid_deposit(
  p_appointment_id uuid,
  p_reason text default 'deposit_unpaid'
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_released boolean;
begin
  perform set_config('app.trusted_write', 'on', true);

  update public.appointments
  set status = 'cancelled',
      cancellation_reason = p_reason,
      cancelled_at = now()
  where id = p_appointment_id
    and deposit_status = 'awaiting'
    and status = 'pending';
  v_released := found;

  update public.payment_records
  set status = 'cancelled'
  where appointment_id = p_appointment_id
    and kind = 'deposit'
    and status = 'pending';

  perform set_config('app.trusted_write', 'off', true);
  return v_released;
end;
$$;

-- The sweep behind the webhook: whatever Stripe told us or failed to, a hold
-- past its due time is released. Two minutes of grace so a payment completed
-- in the last second of the session is settled before it is swept.
create or replace function public.expire_unpaid_deposits()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform set_config('app.trusted_write', 'on', true);

  with lapsed as (
    update public.appointments
    set status = 'cancelled',
        cancellation_reason = 'deposit_unpaid',
        cancelled_at = now()
    where deposit_status = 'awaiting'
      and status = 'pending'
      and payment_due_at < now() - interval '2 minutes'
    returning id
  ),
  records as (
    update public.payment_records p
    set status = 'cancelled'
    from lapsed
    where p.appointment_id = lapsed.id
      and p.kind = 'deposit'
      and p.status = 'pending'
    returning p.id
  )
  select count(*) into v_count from lapsed;

  perform set_config('app.trusted_write', 'off', true);
  return v_count;
end;
$$;

-- What the refund worker needs, in one read: the refund row, the payment it
-- returns, and the salon's account to issue it on.
create or replace function public.pending_deposit_refunds(p_limit integer default 20)
returns table (
  refund_id uuid,
  appointment_id uuid,
  amount_cents integer,
  currency text,
  payment_reference text,
  account_id text
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.appointment_id, r.amount_cents, r.currency,
         d.provider_payment_reference, acct.account_id
  from public.payment_records r
  join public.payment_records d on d.id = r.related_payment_id
  join public.business_payment_accounts acct on acct.business_id = r.business_id
  where r.kind = 'refund'
    and r.status = 'pending'
    and r.provider_reference is null
    and d.provider_payment_reference is not null
    and not r.is_demo
  order by r.created_at
  limit greatest(1, least(p_limit, 100));
$$;

create or replace function public.complete_deposit_refund(
  p_refund_id uuid,
  p_provider_reference text,
  p_succeeded boolean,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appointment_id uuid;
begin
  update public.payment_records
  set status = case when p_succeeded then 'succeeded'::public.payment_status
                    else 'failed'::public.payment_status end,
      provider_reference = coalesce(p_provider_reference, provider_reference),
      failure_reason = case when p_succeeded then null else left(p_error, 500) end
  where id = p_refund_id
    and kind = 'refund'
  returning appointment_id into v_appointment_id;

  if p_succeeded and v_appointment_id is not null then
    perform set_config('app.trusted_write', 'on', true);
    update public.appointments
    set deposit_status = 'refunded'
    where id = v_appointment_id
      and deposit_status = 'refund_pending';
    perform set_config('app.trusted_write', 'off', true);
  end if;
end;
$$;

do $$
declare
  v_fn text;
begin
  foreach v_fn in array array[
    'public.link_payment_account(uuid, text)',
    'public.sync_payment_account(text, boolean, boolean, boolean)',
    'public.settle_deposit(uuid, text, text, integer, text)',
    'public.release_unpaid_deposit(uuid, text)',
    'public.expire_unpaid_deposits()',
    'public.pending_deposit_refunds(integer)',
    'public.complete_deposit_refund(uuid, text, boolean, text)'
  ]
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', v_fn);
    execute format('grant execute on function %s to service_role', v_fn);
  end loop;
end;
$$;
