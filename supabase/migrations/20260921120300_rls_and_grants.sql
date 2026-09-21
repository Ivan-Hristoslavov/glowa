-- ---------------------------------------------------------------------------
-- GLOWA · 0004 · authorization
--   Helpers in `app` are SECURITY DEFINER so that a policy on
--   business_members can ask "is this user a member?" without recursing.
--   Every helper checks auth.uid() itself and lives outside the exposed
--   schema, so it is not a callable public endpoint.
-- ---------------------------------------------------------------------------

create or replace function app.is_business_member(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members bm
    where bm.business_id = p_business_id
      and bm.profile_id = (select auth.uid())
      and bm.status = 'active'
  );
$$;

create or replace function app.has_business_role(
  p_business_id uuid,
  p_roles public.business_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members bm
    where bm.business_id = p_business_id
      and bm.profile_id = (select auth.uid())
      and bm.status = 'active'
      and bm.role = any (p_roles)
  );
$$;

create or replace function app.is_business_manager(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.has_business_role(p_business_id, array['owner', 'admin', 'manager']::public.business_role[]);
$$;

create or replace function app.is_business_admin(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.has_business_role(p_business_id, array['owner', 'admin']::public.business_role[]);
$$;

create or replace function app.is_business_public(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.businesses b
    where b.id = p_business_id and b.status = 'active'
  );
$$;

create or replace function app.business_of_location(p_location_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select l.business_id from public.locations l where l.id = p_location_id;
$$;

create or replace function app.business_of_staff(p_staff_profile_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.business_id from public.staff_profiles s where s.id = p_staff_profile_id;
$$;

create or replace function app.business_of_service(p_service_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.business_id from public.services s where s.id = p_service_id;
$$;

create or replace function app.business_of_appointment(p_appointment_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select a.business_id from public.appointments a where a.id = p_appointment_id;
$$;

create or replace function app.owns_appointment(p_appointment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.appointments a
    where a.id = p_appointment_id
      and a.customer_profile_id = (select auth.uid())
  );
$$;

create or replace function app.owns_calendar_connection(p_connection_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.external_calendar_connections c
    where c.id = p_connection_id
      and (
        c.profile_id = (select auth.uid())
        or (c.business_id is not null and app.is_business_member(c.business_id))
      )
  );
$$;

-- Helpers are not a public API surface.
revoke all on all functions in schema app from public;
grant execute on function
  app.is_business_member(uuid),
  app.has_business_role(uuid, public.business_role[]),
  app.is_business_manager(uuid),
  app.is_business_admin(uuid),
  app.is_business_public(uuid),
  app.business_of_location(uuid),
  app.business_of_staff(uuid),
  app.business_of_service(uuid),
  app.business_of_appointment(uuid),
  app.owns_appointment(uuid),
  app.owns_calendar_connection(uuid)
to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Integrity triggers: the parts of a booking that a client must never choose.
-- ---------------------------------------------------------------------------

-- Creating a business makes the creator its owner, in the same transaction.
create or replace function app.attach_business_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null then
    insert into public.business_members (business_id, profile_id, role, status)
    values (new.id, new.created_by, 'owner', 'active')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger businesses_attach_owner
  after insert on public.businesses
  for each row execute function app.attach_business_owner();

-- A customer booking for themselves may choose the service, the staff member
-- and the start time. Price, duration, tenant and status come from the
-- database, never from the request body.
create or replace function app.enforce_customer_booking_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_service public.services%rowtype;
  v_is_staff boolean;
begin
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
    new.customer_profile_id := (select auth.uid());
    new.price_cents := v_service.price_cents;
    new.currency := v_service.currency;
    new.ends_at := new.starts_at + make_interval(mins => v_service.duration_minutes);
    new.status := 'pending';
    new.source := 'customer_web';
    new.internal_notes := null;
    new.is_demo := false;
    new.created_by := (select auth.uid());
    return new;
  end if;

  -- UPDATE
  if v_is_staff then
    return new;
  end if;

  -- The only change a customer may make directly is cancelling their own
  -- booking. Rescheduling goes through the server so availability is
  -- re-checked inside a transaction.
  if new.status <> 'cancelled' or old.status not in ('pending', 'confirmed') then
    raise exception 'Customers may only cancel a pending or confirmed appointment'
      using errcode = 'insufficient_privilege';
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

create trigger appointments_enforce_customer_fields
  before insert or update on public.appointments
  for each row execute function app.enforce_customer_booking_fields();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.locations enable row level security;
alter table public.business_hours enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.staff_working_hours enable row level security;
alter table public.staff_time_off enable row level security;
alter table public.services enable row level security;
alter table public.service_staff enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_status_history enable row level security;
alter table public.business_clients enable row level security;
alter table public.customer_preferences enable row level security;
alter table public.saved_businesses enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.reviews enable row level security;
alter table public.review_invitations enable row level security;
alter table public.payment_records enable row level security;
alter table public.external_calendar_connections enable row level security;
alter table public.calendar_event_links enable row level security;
alter table public.marketing_campaigns enable row level security;
alter table public.marketing_messages enable row level security;
alter table public.audit_logs enable row level security;
alter table private.calendar_credentials enable row level security;

-- --- profiles: owned by the person -----------------------------------------

create policy "profiles_select_own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- --- businesses ------------------------------------------------------------

create policy "businesses_select_public_or_member" on public.businesses
  for select to anon, authenticated
  using (status = 'active' or app.is_business_member(id));

create policy "businesses_insert_self_owned" on public.businesses
  for insert to authenticated
  with check ((select auth.uid()) = created_by);

create policy "businesses_update_admin" on public.businesses
  for update to authenticated
  using (app.is_business_admin(id))
  with check (app.is_business_admin(id));

create policy "businesses_delete_owner" on public.businesses
  for delete to authenticated
  using (app.has_business_role(id, array['owner']::public.business_role[]));

-- --- membership ------------------------------------------------------------

create policy "business_members_select_team" on public.business_members
  for select to authenticated
  using (profile_id = (select auth.uid()) or app.is_business_member(business_id));

create policy "business_members_write_admin" on public.business_members
  for all to authenticated
  using (app.is_business_admin(business_id))
  with check (app.is_business_admin(business_id));

-- --- locations and opening hours -------------------------------------------

create policy "locations_select_public_or_member" on public.locations
  for select to anon, authenticated
  using (app.is_business_public(business_id) or app.is_business_member(business_id));

create policy "locations_write_manager" on public.locations
  for all to authenticated
  using (app.is_business_manager(business_id))
  with check (app.is_business_manager(business_id));

create policy "business_hours_select_public_or_member" on public.business_hours
  for select to anon, authenticated
  using (
    app.is_business_public(app.business_of_location(location_id))
    or app.is_business_member(app.business_of_location(location_id))
  );

create policy "business_hours_write_manager" on public.business_hours
  for all to authenticated
  using (app.is_business_manager(app.business_of_location(location_id)))
  with check (app.is_business_manager(app.business_of_location(location_id)));

-- --- staff -----------------------------------------------------------------

create policy "staff_profiles_select_public_or_member" on public.staff_profiles
  for select to anon, authenticated
  using (app.is_business_public(business_id) or app.is_business_member(business_id));

create policy "staff_profiles_write_manager" on public.staff_profiles
  for all to authenticated
  using (app.is_business_manager(business_id))
  with check (app.is_business_manager(business_id));

-- Working hours are public so the booking UI can show real availability.
create policy "staff_working_hours_select_public_or_member" on public.staff_working_hours
  for select to anon, authenticated
  using (
    app.is_business_public(app.business_of_staff(staff_profile_id))
    or app.is_business_member(app.business_of_staff(staff_profile_id))
  );

create policy "staff_working_hours_write_manager" on public.staff_working_hours
  for all to authenticated
  using (app.is_business_manager(app.business_of_staff(staff_profile_id)))
  with check (app.is_business_manager(app.business_of_staff(staff_profile_id)));

-- Time off is internal: the reason is nobody else's business. Public
-- availability is derived server-side instead.
create policy "staff_time_off_member_only" on public.staff_time_off
  for select to authenticated
  using (app.is_business_member(app.business_of_staff(staff_profile_id)));

create policy "staff_time_off_write_manager" on public.staff_time_off
  for all to authenticated
  using (app.is_business_manager(app.business_of_staff(staff_profile_id)))
  with check (app.is_business_manager(app.business_of_staff(staff_profile_id)));

-- --- catalog ---------------------------------------------------------------

create policy "services_select_public_or_member" on public.services
  for select to anon, authenticated
  using (
    (is_active and app.is_business_public(business_id))
    or app.is_business_member(business_id)
  );

create policy "services_write_manager" on public.services
  for all to authenticated
  using (app.is_business_manager(business_id))
  with check (app.is_business_manager(business_id));

create policy "service_staff_select_public_or_member" on public.service_staff
  for select to anon, authenticated
  using (
    app.is_business_public(app.business_of_service(service_id))
    or app.is_business_member(app.business_of_service(service_id))
  );

create policy "service_staff_write_manager" on public.service_staff
  for all to authenticated
  using (app.is_business_manager(app.business_of_service(service_id)))
  with check (app.is_business_manager(app.business_of_service(service_id)));

-- --- appointments ----------------------------------------------------------

create policy "appointments_select_owner_or_member" on public.appointments
  for select to authenticated
  using (
    customer_profile_id = (select auth.uid())
    or app.is_business_member(business_id)
  );

create policy "appointments_insert_customer_or_member" on public.appointments
  for insert to authenticated
  with check (
    app.is_business_member(business_id)
    or customer_profile_id = (select auth.uid())
    or (
      -- Tenant and customer are rewritten by the BEFORE INSERT trigger for
      -- customer bookings; this branch admits that shape.
      service_id is not null and app.is_business_public(app.business_of_service(service_id))
    )
  );

create policy "appointments_update_owner_or_member" on public.appointments
  for update to authenticated
  using (
    customer_profile_id = (select auth.uid())
    or app.is_business_member(business_id)
  )
  with check (
    customer_profile_id = (select auth.uid())
    or app.is_business_member(business_id)
  );

create policy "appointments_delete_admin" on public.appointments
  for delete to authenticated
  using (app.is_business_admin(business_id));

-- History is written by a trigger; clients may only read it.
create policy "appointment_status_history_select" on public.appointment_status_history
  for select to authenticated
  using (
    app.owns_appointment(appointment_id)
    or app.is_business_member(app.business_of_appointment(appointment_id))
  );

-- --- CRM -------------------------------------------------------------------

create policy "business_clients_member_only" on public.business_clients
  for select to authenticated using (app.is_business_member(business_id));

create policy "business_clients_write_manager" on public.business_clients
  for all to authenticated
  using (app.is_business_manager(business_id))
  with check (app.is_business_manager(business_id));

-- --- customer-owned rows ---------------------------------------------------

create policy "customer_preferences_own" on public.customer_preferences
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy "saved_businesses_own" on public.saved_businesses
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy "notification_preferences_own" on public.notification_preferences
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- --- reviews ---------------------------------------------------------------

create policy "reviews_select_published_or_related" on public.reviews
  for select to anon, authenticated
  using (
    (status = 'published' and app.is_business_public(business_id))
    or author_profile_id = (select auth.uid())
    or app.is_business_member(business_id)
  );

-- A review must belong to the author's own completed appointment.
create policy "reviews_insert_after_own_appointment" on public.reviews
  for insert to authenticated
  with check (
    author_profile_id = (select auth.uid())
    and appointment_id is not null
    and app.owns_appointment(appointment_id)
    and business_id = app.business_of_appointment(appointment_id)
  );

create policy "reviews_update_author" on public.reviews
  for update to authenticated
  using (author_profile_id = (select auth.uid()))
  with check (author_profile_id = (select auth.uid()));

create policy "reviews_update_business" on public.reviews
  for update to authenticated
  using (app.is_business_manager(business_id))
  with check (app.is_business_manager(business_id));

create policy "reviews_delete_author" on public.reviews
  for delete to authenticated
  using (author_profile_id = (select auth.uid()));

create policy "review_invitations_member_only" on public.review_invitations
  for all to authenticated
  using (app.is_business_member(business_id))
  with check (app.is_business_manager(business_id));

-- --- payments --------------------------------------------------------------

create policy "payment_records_select_payer_or_member" on public.payment_records
  for select to authenticated
  using (profile_id = (select auth.uid()) or app.is_business_member(business_id));

create policy "payment_records_write_manager" on public.payment_records
  for all to authenticated
  using (app.is_business_manager(business_id))
  with check (app.is_business_manager(business_id));

-- --- calendars -------------------------------------------------------------

create policy "external_calendar_connections_own" on public.external_calendar_connections
  for all to authenticated
  using (
    profile_id = (select auth.uid())
    or (business_id is not null and app.is_business_admin(business_id))
  )
  with check (
    profile_id = (select auth.uid())
    or (business_id is not null and app.is_business_admin(business_id))
  );

create policy "calendar_event_links_own" on public.calendar_event_links
  for all to authenticated
  using (app.owns_calendar_connection(connection_id))
  with check (app.owns_calendar_connection(connection_id));

-- private.calendar_credentials deliberately has no policy and no grant:
-- it is reachable only by the service role / server-side code.

-- --- marketing and audit ---------------------------------------------------

create policy "marketing_campaigns_member_read" on public.marketing_campaigns
  for select to authenticated using (app.is_business_member(business_id));

create policy "marketing_campaigns_write_manager" on public.marketing_campaigns
  for all to authenticated
  using (app.is_business_manager(business_id))
  with check (app.is_business_manager(business_id));

create policy "marketing_messages_member_read" on public.marketing_messages
  for select to authenticated using (app.is_business_member(business_id));

create policy "marketing_messages_write_manager" on public.marketing_messages
  for all to authenticated
  using (app.is_business_manager(business_id))
  with check (app.is_business_manager(business_id));

create policy "audit_logs_select_admin" on public.audit_logs
  for select to authenticated using (app.is_business_admin(business_id));

-- ---------------------------------------------------------------------------
-- Data API grants. RLS decides which rows; these decide which tables are
-- reachable at all.
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

grant select on
  public.businesses, public.locations, public.business_hours,
  public.staff_profiles, public.staff_working_hours, public.services,
  public.service_staff, public.reviews
to anon;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- The audit trail is append-only from the application's point of view.
revoke insert, update, delete on public.audit_logs from authenticated;
revoke insert, update, delete on public.appointment_status_history from authenticated;

revoke all on all tables in schema private from anon, authenticated;
