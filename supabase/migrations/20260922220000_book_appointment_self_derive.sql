-- ---------------------------------------------------------------------------
-- GLOWA · 0017 · book_appointment stops depending on the customer guard
--
-- `app.enforce_customer_booking_fields` derives business, price, duration,
-- snapshot and customer identity for a customer INSERT, and returns early for
-- a business member, because a member using the admin calendar supplies those
-- fields themselves.
--
-- `book_appointment` leaned on that derivation: it inserted a placeholder
-- one-minute range and no identity at all. For anyone who is a member of the
-- business they are booking at - an owner booking a treatment at their own
-- salon, a stylist booking with a colleague - the guard took the member branch
-- and the placeholders stood. The row then failed
-- `appointments_identified_customer` outright, and would have been priced at
-- zero and one minute long if it had not.
--
-- The fix is to stop treating a trigger as the constructor. The RPC now writes
-- a complete row. The guard still runs and still overrides everything for a
-- non-member, so the trust boundary is unchanged - it is just no longer the
-- only thing standing between a booking and a valid row.
-- ---------------------------------------------------------------------------

-- The email lives in auth.users, which `authenticated` cannot read. A narrow
-- definer helper exposes exactly the caller's own row and nothing else.
create or replace function app.current_identity()
returns table (profile_id uuid, full_name text, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name, u.email::text
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = (select auth.uid());
$$;

revoke execute on function app.current_identity() from public, anon;
grant execute on function app.current_identity() to authenticated;

create or replace function public.book_appointment(
  p_service_id uuid,
  p_starts_at timestamptz,
  p_staff_profile_id uuid,
  p_location_id uuid default null,
  p_customer_notes text default null
)
returns public.appointments
language plpgsql
set search_path = ''
as $$
declare
  v_timezone text;
  v_local_day date;
  v_service public.services%rowtype;
  v_me record;
  v_row public.appointments%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to book' using errcode = 'insufficient_privilege';
  end if;

  select s.* into v_service
  from public.services s
  join public.businesses b on b.id = s.business_id
  where s.id = p_service_id and s.is_active and b.status = 'active';

  if not found then
    raise exception 'Service is not bookable' using errcode = 'check_violation';
  end if;

  select b.timezone into v_timezone
  from public.businesses b where b.id = v_service.business_id;

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

  select * into v_me from app.current_identity();

  begin
    insert into public.appointments (
      business_id, location_id, service_id, staff_profile_id,
      customer_profile_id, customer_name, customer_email,
      service_name_snapshot, price_cents, currency,
      starts_at, ends_at, status, source, customer_notes, is_demo, created_by
    )
    values (
      v_service.business_id, p_location_id, p_service_id, p_staff_profile_id,
      v_me.profile_id, v_me.full_name, v_me.email,
      v_service.name, v_service.price_cents, v_service.currency,
      p_starts_at,
      p_starts_at + make_interval(mins => v_service.duration_minutes),
      'pending', 'customer_web',
      nullif(btrim(coalesce(p_customer_notes, '')), ''),
      false, v_me.profile_id
    )
    returning * into v_row;
  exception when exclusion_violation then
    raise exception 'That time was just taken'
      using errcode = 'check_violation', hint = 'slot_taken';
  end;

  return v_row;
end;
$$;

revoke execute on function public.book_appointment(
  uuid, timestamptz, uuid, uuid, text
) from public, anon;
grant execute on function public.book_appointment(
  uuid, timestamptz, uuid, uuid, text
) to authenticated;
