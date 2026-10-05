-- Customers' online bookings are confirmed immediately (no deposit required).
--
-- Until now every online booking arrived `pending` and waited for the salon to
-- confirm it by hand, while the landing page, the salon page and the
-- confirmation email all told the customer it was confirmed. A salon owner who
-- did not open the calendar left customers in limbo. A booking that needs a
-- deposit still starts `pending` (the deposit hold depends on it) and is
-- confirmed by the payment path.
CREATE OR REPLACE FUNCTION app.enforce_customer_booking_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_service public.services%rowtype;
  v_is_staff boolean;
  v_window_hours integer;
  v_uid uuid := (select auth.uid());
  v_deposit boolean;
begin
  if coalesce(current_setting('app.trusted_write', true), 'off') = 'on' then
    return new;
  end if;

  v_is_staff := new.business_id is not null and app.is_business_member(new.business_id);

  if tg_op = 'INSERT' then
    -- Whoever is inserting, the credited link must belong to this business
    -- and still be active.
    if new.growth_link_id is not null and not exists (
      select 1 from public.growth_links gl
      where gl.id = new.growth_link_id
        and gl.is_active
        and gl.business_id = coalesce(
          new.business_id,
          (select s.business_id from public.services s where s.id = new.service_id)
        )
    ) then
      new.growth_link_id := null;
    end if;

    if v_is_staff then
      return new;
    end if;

    if new.service_id is null then
      raise exception 'A service is required when booking as a customer'
        using errcode = 'check_violation';
    end if;

    select * into v_service from public.services s where s.id = new.service_id;

    if not found or not v_service.is_active then
      raise exception 'Service is not bookable' using errcode = 'check_violation';
    end if;

    if not app.is_business_public(v_service.business_id) then
      raise exception 'Business is not accepting bookings' using errcode = 'check_violation';
    end if;

    new.business_id := v_service.business_id;
    new.customer_profile_id := v_uid;
    new.price_cents := v_service.price_cents;
    new.currency := v_service.currency;
    new.ends_at := new.starts_at + make_interval(mins => v_service.duration_minutes);
    new.service_name_snapshot := v_service.name;
    -- A booking made against real, exclusion-constrained availability needs no
    -- approval: it is confirmed on the spot, which is what the product tells
    -- the customer. The one exception is a booking that asks for a deposit; it
    -- stays pending while the slot is held, and the deposit path confirms it.
    select (v_service.requires_deposit and v_service.deposit_cents > 0 and b.deposits_enabled)
    into v_deposit
    from public.businesses b where b.id = v_service.business_id;

    new.status := case when coalesce(v_deposit, false) then 'pending' else 'confirmed' end;
    new.source := 'customer_web';
    new.internal_notes := null;
    new.is_demo := false;
    new.created_by := v_uid;

    select p.full_name into new.customer_name from public.profiles p where p.id = v_uid;
    select u.email into new.customer_email from auth.users u where u.id = v_uid;

    return new;
  end if;

  if v_is_staff then
    return new;
  end if;

  if new.status <> 'cancelled' or old.status not in ('pending', 'confirmed') then
    raise exception 'Customers may only cancel a pending or confirmed appointment'
      using errcode = 'insufficient_privilege';
  end if;

  select coalesce((b.booking_policy ->> 'cancellation_window_hours')::integer, 24)
  into v_window_hours
  from public.businesses b where b.id = old.business_id;

  if old.starts_at - make_interval(hours => coalesce(v_window_hours, 24)) < now() then
    raise exception 'Too late to cancel online; please contact the business'
      using errcode = 'check_violation';
  end if;

  new.business_id := old.business_id;
  new.service_id := old.service_id;
  new.staff_profile_id := old.staff_profile_id;
  new.customer_profile_id := old.customer_profile_id;
  new.price_cents := old.price_cents;
  new.currency := old.currency;
  new.starts_at := old.starts_at;
  new.ends_at := old.ends_at;
  new.internal_notes := old.internal_notes;
  new.is_demo := old.is_demo;
  new.growth_link_id := old.growth_link_id;
  new.cancelled_at := now();
  return new;
end;
$function$;

-- A deposit booking is confirmed when its deposit is paid.
CREATE OR REPLACE FUNCTION public.settle_deposit(p_appointment_id uuid, p_session_id text, p_payment_reference text, p_amount_cents integer, p_currency text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    -- Paying the deposit is what confirms a booking that asked for one.
    set deposit_status = 'paid', payment_due_at = null,
        status = case when status = 'pending' then 'confirmed' else status end
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
$function$;
