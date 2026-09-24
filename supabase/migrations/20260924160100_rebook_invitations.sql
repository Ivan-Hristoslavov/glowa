-- ---------------------------------------------------------------------------
-- GLOWA · rebook invitations, part 2
--
-- A gel manicure lasts about three weeks and a cut about six. When that time
-- is up and the client has not booked again, the salon invites them back:
-- one email with the next free times at that salon, ideally with the same
-- stylist. The salon chooses the interval per service; no interval, no
-- invitation.
--
-- Rules:
--   * The invitation is queued when a visit is completed, for the visit's
--     start + the interval, and never for a visit whose moment has passed
--     (a diary tidied up two months late must not mail everybody at once).
--   * A client who already has their next visit in the diary is not invited.
--     The same check runs again at send time, because in the weeks between
--     they may have booked, visited, or both.
--   * A client who said no to the salon's messages is not invited, and every
--     invitation carries a one-click way out (the client's existing
--     unsubscribe token). This is the existing-customer exception for
--     electronic marketing (ePrivacy Directive art. 13(2)): same salon,
--     same service, an opt-out in every message.
--   * Account holders can also switch the event off in their settings; that
--     goes through `app.notifications_enabled` like every other event.
-- ---------------------------------------------------------------------------

alter table public.services
  add column rebook_after_days smallint
    check (rebook_after_days between 7 and 365);

comment on column public.services.rebook_after_days is
  'Days after a completed visit at which the client is invited back. Null: never.';

-- --- who is this client, at this salon ---------------------------------------

-- The same matching rule as `app.sync_business_client`: the profile when there
-- is one, otherwise the email address.
create or replace function app.match_business_client(
  p_business_id uuid,
  p_profile_id uuid,
  p_email text
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select bc.id
  from public.business_clients bc
  where bc.business_id = p_business_id
    and (
      (p_profile_id is not null and bc.profile_id = p_profile_id)
      or (p_profile_id is null and p_email is not null
          and lower(bc.email) = lower(p_email))
    )
  limit 1;
$$;

revoke execute on function app.match_business_client(uuid, uuid, text)
  from public, anon, authenticated;

-- Has the client been back, or booked to come back, since this visit?
create or replace function app.client_returned_since(
  p_business_id uuid,
  p_profile_id uuid,
  p_email text,
  p_since timestamptz,
  p_exclude uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.appointments a
    where a.business_id = p_business_id
      and a.id <> p_exclude
      and a.starts_at > p_since
      and a.status in ('pending', 'confirmed', 'completed')
      and (
        (p_profile_id is not null and a.customer_profile_id = p_profile_id)
        or (p_email is not null and lower(a.customer_email) = lower(p_email))
      )
  );
$$;

revoke execute on function app.client_returned_since(uuid, uuid, text, timestamptz, uuid)
  from public, anon, authenticated;

-- "Said no" is an explicit act: consent switched off *and* a timestamp saying
-- when. A client nobody ever asked has no timestamp and may be invited, with
-- the way out in the message.
create or replace function app.client_declined_messages(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select not bc.consent_marketing and bc.consent_updated_at is not null
     from public.business_clients bc
     where bc.id = p_client_id),
    false
  );
$$;

revoke execute on function app.client_declined_messages(uuid)
  from public, anon, authenticated;

-- --- queueing ------------------------------------------------------------------

-- Demo data and imported history are records, not conversations: neither is
-- invited.

create or replace function app.queue_rebook_invitation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days smallint;
  v_due timestamptz;
begin
  if new.status <> 'completed' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'completed' then
    return new;
  end if;

  if new.is_demo or new.source = 'import' or new.service_id is null then
    return new;
  end if;
  if new.customer_profile_id is null and new.customer_email is null then
    return new;
  end if;

  select s.rebook_after_days into v_days
  from public.services s
  where s.id = new.service_id;
  if v_days is null then
    return new;
  end if;

  v_due := new.starts_at + make_interval(days => v_days);
  if v_due <= now() then
    return new;
  end if;

  if app.client_returned_since(
    new.business_id, new.customer_profile_id, new.customer_email,
    new.starts_at, new.id
  ) then
    return new;
  end if;

  if app.client_declined_messages(
    app.match_business_client(new.business_id, new.customer_profile_id, new.customer_email)
  ) then
    return new;
  end if;

  perform app.enqueue_notification(
    new.business_id, new.id, new.customer_profile_id, 'rebook_nudge',
    app.appointment_locale(new.customer_profile_id, new.business_id),
    'rebook_nudge:' || new.id::text,
    v_due
  );

  return new;
end;
$$;

revoke execute on function app.queue_rebook_invitation() from public, anon, authenticated;

create trigger appointments_rebook_invitation
  after insert or update of status on public.appointments
  for each row execute function app.queue_rebook_invitation();

-- --- sending -------------------------------------------------------------------

-- Everything the worker needs to decide, in one call, from the database's own
-- point of view at send time. Service role only: the worker is the caller.
-- `switched_off` covers a salon that removed the interval, retired the
-- service, or is no longer live.
create or replace function public.rebook_invitation_context(p_appointment_id uuid)
returns table (
  state text,
  service_id uuid,
  staff_profile_id uuid,
  location_id uuid,
  rebook_after_days smallint,
  unsubscribe_token uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_appointment public.appointments%rowtype;
  v_service public.services%rowtype;
  v_business_status public.business_status;
  v_client_id uuid;
begin
  select * into v_appointment
  from public.appointments a
  where a.id = p_appointment_id;
  if not found then
    state := 'missing';
    return next;
    return;
  end if;

  select * into v_service
  from public.services s
  where s.id = v_appointment.service_id;

  select b.status into v_business_status
  from public.businesses b
  where b.id = v_appointment.business_id;

  v_client_id := app.match_business_client(
    v_appointment.business_id,
    v_appointment.customer_profile_id,
    v_appointment.customer_email
  );

  service_id := v_appointment.service_id;
  staff_profile_id := v_appointment.staff_profile_id;
  location_id := v_appointment.location_id;
  rebook_after_days := v_service.rebook_after_days;
  unsubscribe_token := (
    select bc.unsubscribe_token from public.business_clients bc where bc.id = v_client_id
  );

  if v_service.id is null
    or not v_service.is_active
    or v_service.rebook_after_days is null
    or v_business_status is distinct from 'active'
  then
    state := 'switched_off';
  elsif app.client_declined_messages(v_client_id) then
    state := 'declined';
  elsif app.client_returned_since(
    v_appointment.business_id, v_appointment.customer_profile_id,
    v_appointment.customer_email, v_appointment.starts_at, v_appointment.id
  ) then
    state := 'returned';
  else
    state := 'due';
  end if;

  return next;
end;
$$;

revoke execute on function public.rebook_invitation_context(uuid)
  from public, anon, authenticated;
grant execute on function public.rebook_invitation_context(uuid) to service_role;

-- --- the way out ---------------------------------------------------------------

-- Unchanged for campaigns, with two differences. The withdrawal is stamped
-- even when consent was never given, because an invitation reaches people who
-- were never asked and their "no" has to be recorded to be honoured. And a
-- queued invitation stops here too, not only queued campaign mail: an
-- unsubscribe that only takes effect next time is not an unsubscribe.
create or replace function public.unsubscribe_marketing(p_token uuid)
returns table (business_name text, already_unsubscribed boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row record;
begin
  select bc.id, bc.business_id, bc.profile_id, bc.email,
         bc.consent_marketing, bc.consent_updated_at, b.name
  into v_row
  from public.business_clients bc
  join public.businesses b on b.id = bc.business_id
  where bc.unsubscribe_token = p_token;

  if not found then
    return;
  end if;

  already_unsubscribed :=
    not v_row.consent_marketing and v_row.consent_updated_at is not null;

  if not already_unsubscribed then
    perform set_config('app.trusted_write', 'on', true);
    update public.business_clients
    set consent_marketing = false, consent_updated_at = now()
    where id = v_row.id;
    perform set_config('app.trusted_write', 'off', true);

    update public.notification_deliveries
    set status = 'skipped', error = 'unsubscribed'
    where business_client_id = v_row.id
      and event_type = 'marketing'
      and status = 'queued';

    update public.notification_deliveries d
    set status = 'skipped', error = 'unsubscribed'
    from public.appointments a
    where d.appointment_id = a.id
      and d.event_type = 'rebook_nudge'
      and d.status = 'queued'
      and a.business_id = v_row.business_id
      and (
        (v_row.profile_id is not null and a.customer_profile_id = v_row.profile_id)
        or (v_row.email is not null and lower(a.customer_email) = lower(v_row.email))
      );
  end if;

  business_name := v_row.name;
  return next;
end;
$$;

revoke execute on function public.unsubscribe_marketing(uuid) from public;
grant execute on function public.unsubscribe_marketing(uuid) to anon, authenticated;
