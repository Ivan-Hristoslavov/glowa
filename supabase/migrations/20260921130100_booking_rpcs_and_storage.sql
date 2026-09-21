-- ---------------------------------------------------------------------------
-- GLOWA · 0008 · booking RPCs, reschedule/cancel policy, storage
-- ---------------------------------------------------------------------------

create or replace function app.try_uuid(value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return value::uuid;
exception when others then
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Customer write guard, v2.
--
-- Adds three things to the original: a transaction-local trusted-write escape
-- hatch used only by public.reschedule_appointment (PostgREST gives clients no
-- way to set it), a snapshot of the service name and customer identity at
-- booking time, and the cancellation window from the business policy.
-- ---------------------------------------------------------------------------
create or replace function app.enforce_customer_booking_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_service public.services%rowtype;
  v_is_staff boolean;
  v_window_hours integer;
  v_uid uuid := (select auth.uid());
begin
  -- Set only by our own SECURITY DEFINER RPCs, for the duration of their
  -- transaction, after they have done the equivalent checks themselves.
  if coalesce(current_setting('app.trusted_write', true), 'off') = 'on' then
    return new;
  end if;

  v_is_staff := new.business_id is not null and app.is_business_member(new.business_id);

  if tg_op = 'INSERT' then
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
    new.status := 'pending';
    new.source := 'customer_web';
    new.internal_notes := null;
    new.is_demo := false;
    new.created_by := v_uid;

    select p.full_name into new.customer_name
    from public.profiles p where p.id = v_uid;
    select u.email into new.customer_email
    from auth.users u where u.id = v_uid;

    return new;
  end if;

  -- UPDATE
  if v_is_staff then
    return new;
  end if;

  if new.status <> 'cancelled' or old.status not in ('pending', 'confirmed') then
    raise exception 'Customers may only cancel a pending or confirmed appointment'
      using errcode = 'insufficient_privilege';
  end if;

  select coalesce((b.booking_policy ->> 'cancellation_window_hours')::integer, 24)
  into v_window_hours
  from public.businesses b
  where b.id = old.business_id;

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
  new.cancelled_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Booking
--
-- SECURITY INVOKER on purpose: the insert goes through RLS and the guard
-- trigger exactly as a direct insert would. What this adds is the policy
-- check against real availability. The exclusion constraint remains the
-- authority on races - two callers can pass the availability check at the
-- same instant, and Postgres rejects the loser.
-- ---------------------------------------------------------------------------
create or replace function public.book_appointment(
  p_service_id uuid,
  p_starts_at timestamptz,
  p_staff_profile_id uuid,
  p_location_id uuid default null,
  p_customer_notes text default null
)
returns public.appointments
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_timezone text;
  v_local_day date;
  v_row public.appointments%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to book' using errcode = 'insufficient_privilege';
  end if;

  select b.timezone into v_timezone
  from public.services s
  join public.businesses b on b.id = s.business_id
  where s.id = p_service_id and s.is_active and b.status = 'active';

  if v_timezone is null then
    raise exception 'Service is not bookable' using errcode = 'check_violation';
  end if;

  v_local_day := (p_starts_at at time zone v_timezone)::date;

  if not exists (
    select 1
    from public.get_available_slots(
      p_service_id, v_local_day, v_local_day, p_staff_profile_id, p_location_id
    ) slot
    where slot.starts_at = p_starts_at
  ) then
    raise exception 'That time is no longer available'
      using errcode = 'check_violation', hint = 'slot_unavailable';
  end if;

  begin
    insert into public.appointments (
      business_id, location_id, service_id, staff_profile_id,
      starts_at, ends_at, customer_notes
    )
    values (
      -- business_id, price, currency, ends_at and status are overwritten by
      -- the guard trigger; these are placeholders it replaces.
      (select s.business_id from public.services s where s.id = p_service_id),
      p_location_id, p_service_id, p_staff_profile_id,
      p_starts_at, p_starts_at + interval '1 minute',
      nullif(btrim(coalesce(p_customer_notes, '')), '')
    )
    returning * into v_row;
  exception when exclusion_violation then
    raise exception 'That time was just taken'
      using errcode = 'check_violation', hint = 'slot_taken';
  end;

  return v_row;
end;
$$;

grant execute on function public.book_appointment(uuid, timestamptz, uuid, uuid, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Cancel. Invoker, so RLS decides whose appointment this is and the guard
-- trigger enforces the cancellation window.
-- ---------------------------------------------------------------------------
create or replace function public.cancel_appointment(
  p_appointment_id uuid,
  p_reason text default null
)
returns public.appointments
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.appointments%rowtype;
begin
  update public.appointments a
  set status = 'cancelled',
      cancellation_reason = nullif(btrim(coalesce(p_reason, '')), '')
  where a.id = p_appointment_id
    and a.status in ('pending', 'confirmed')
  returning * into v_row;

  if not found then
    raise exception 'Appointment cannot be cancelled'
      using errcode = 'check_violation', hint = 'not_cancellable';
  end if;

  return v_row;
end;
$$;

grant execute on function public.cancel_appointment(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Reschedule. SECURITY DEFINER because moving an appointment in time is
-- exactly what the customer guard trigger forbids, so the checks the trigger
-- would have made are made here instead, explicitly, before the write.
-- ---------------------------------------------------------------------------
create or replace function public.reschedule_appointment(
  p_appointment_id uuid,
  p_new_starts_at timestamptz,
  p_new_staff_profile_id uuid default null
)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_appointment public.appointments%rowtype;
  v_business public.businesses%rowtype;
  v_service public.services%rowtype;
  v_is_member boolean;
  v_staff uuid;
  v_local_day date;
  v_window_hours integer;
begin
  if v_uid is null then
    raise exception 'Sign in to reschedule' using errcode = 'insufficient_privilege';
  end if;

  select * into v_appointment from public.appointments a where a.id = p_appointment_id;
  if not found then
    raise exception 'Appointment not found' using errcode = 'no_data_found';
  end if;

  v_is_member := app.is_business_member(v_appointment.business_id);

  if not v_is_member and v_appointment.customer_profile_id is distinct from v_uid then
    raise exception 'Not your appointment' using errcode = 'insufficient_privilege';
  end if;

  if v_appointment.status not in ('pending', 'confirmed') then
    raise exception 'Only a pending or confirmed appointment can be moved'
      using errcode = 'check_violation', hint = 'not_reschedulable';
  end if;

  select * into v_business from public.businesses b where b.id = v_appointment.business_id;
  select * into v_service from public.services s where s.id = v_appointment.service_id;

  if v_service.id is null then
    raise exception 'The original service no longer exists'
      using errcode = 'check_violation', hint = 'service_missing';
  end if;

  if not v_is_member then
    if coalesce((v_business.booking_policy ->> 'allow_customer_reschedule')::boolean, true) is not true then
      raise exception 'This business does not allow online rescheduling'
        using errcode = 'insufficient_privilege', hint = 'reschedule_disabled';
    end if;

    v_window_hours := coalesce((v_business.booking_policy ->> 'cancellation_window_hours')::integer, 24);
    if v_appointment.starts_at - make_interval(hours => v_window_hours) < now() then
      raise exception 'Too late to reschedule online; please contact the business'
        using errcode = 'check_violation', hint = 'window_closed';
    end if;
  end if;

  v_staff := coalesce(p_new_staff_profile_id, v_appointment.staff_profile_id);
  v_local_day := (p_new_starts_at at time zone v_business.timezone)::date;

  if not exists (
    select 1
    from public.get_available_slots(
      v_service.id, v_local_day, v_local_day, v_staff, v_appointment.location_id
    ) slot
    where slot.starts_at = p_new_starts_at
  ) then
    -- The appointment's own current slot is excluded from availability, so a
    -- no-op move is reported as unavailable rather than silently accepted.
    raise exception 'That time is not available'
      using errcode = 'check_violation', hint = 'slot_unavailable';
  end if;

  perform set_config('app.trusted_write', 'on', true);

  begin
    update public.appointments a
    set starts_at = p_new_starts_at,
        ends_at = p_new_starts_at + make_interval(mins => v_service.duration_minutes),
        staff_profile_id = v_staff
    where a.id = p_appointment_id
    returning * into v_appointment;
  exception when exclusion_violation then
    perform set_config('app.trusted_write', 'off', true);
    raise exception 'That time was just taken'
      using errcode = 'check_violation', hint = 'slot_taken';
  end;

  perform set_config('app.trusted_write', 'off', true);

  insert into public.audit_logs (business_id, actor_profile_id, action, entity_type, entity_id, metadata)
  values (
    v_appointment.business_id, v_uid, 'appointment.rescheduled', 'appointment',
    p_appointment_id::text,
    jsonb_build_object('new_starts_at', p_new_starts_at, 'staff_profile_id', v_staff)
  );

  return v_appointment;
end;
$$;

grant execute on function public.reschedule_appointment(uuid, timestamptz, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2097152,
   array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('business-media', 'business-media', true, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml'])
on conflict (id) do nothing;

-- Avatars: first path segment is the owner's user id.
create policy "avatars_public_read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'avatars');

create policy "avatars_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars_owner_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Business media: first path segment is the business id.
create policy "business_media_public_read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'business-media');

create policy "business_media_manager_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'business-media'
    and app.is_business_manager(app.try_uuid((storage.foldername(name))[1]))
  );

create policy "business_media_manager_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'business-media'
    and app.is_business_manager(app.try_uuid((storage.foldername(name))[1]))
  )
  with check (
    bucket_id = 'business-media'
    and app.is_business_manager(app.try_uuid((storage.foldername(name))[1]))
  );

create policy "business_media_manager_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'business-media'
    and app.is_business_manager(app.try_uuid((storage.foldername(name))[1]))
  );
