-- ---------------------------------------------------------------------------
-- Lavena · integrations
--
-- A salon that already has a website (and maybe its own admin) can connect it:
--
--   * api_keys           - a secret per salon for the partner API (/api/v1).
--                          Only the SHA-256 hash is stored; the key is shown once.
--   * webhook_endpoints  - URLs Lavena calls when a booking is created,
--     webhook_deliveries   moved or cancelled (signed, retried, outbox like the
--                          notification queue).
--   * calendar_feeds     - a private iCal URL of the salon's own calendar. Its
--                          busy time is copied into `staff_time_off`, so the
--                          one availability function every booking path uses
--                          already honours it (nothing new to keep in sync).
--
-- API bookings go through `api_book_appointment`, which re-runs
-- `get_available_slots` and leaves the double-booking guarantee to the
-- exclusion constraint, exactly like a booking made on the site.
-- ---------------------------------------------------------------------------

-- --- columns the integrations hang on ---------------------------------------

alter table public.appointments
  add column external_ref text check (external_ref is null or char_length(external_ref) between 1 and 120);

-- The caller's own reference makes a retried POST return the booking it
-- already made instead of failing or booking twice.
create unique index appointments_external_ref_idx
  on public.appointments (business_id, external_ref)
  where external_ref is not null;

alter table public.services
  add column external_id text check (external_id is null or char_length(external_id) between 1 and 120);

create unique index services_external_id_idx
  on public.services (business_id, external_id)
  where external_id is not null;

-- --- API keys ---------------------------------------------------------------

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  -- First characters of the key, so the owner can tell keys apart. Not secret.
  key_prefix text not null check (char_length(key_prefix) between 8 and 16),
  key_hash text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  scopes text[] not null default array['read', 'bookings']::text[]
    check (
      cardinality(scopes) > 0
      and scopes <@ array['read', 'bookings', 'catalog']::text[]
    ),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index api_keys_business_idx on public.api_keys (business_id);
create index api_keys_created_by_idx on public.api_keys (created_by) where created_by is not null;

alter table public.api_keys enable row level security;

create policy "api_keys_admin_read" on public.api_keys
  for select to authenticated
  using (app.is_business_admin(business_id));

create policy "api_keys_admin_insert" on public.api_keys
  for insert to authenticated
  with check (
    app.is_business_admin(business_id)
    and created_by = (select auth.uid())
  );

-- The only thing an owner can change about a key is revoking it.
create policy "api_keys_admin_revoke" on public.api_keys
  for update to authenticated
  using (app.is_business_admin(business_id))
  with check (app.is_business_admin(business_id));

revoke all on public.api_keys from anon, authenticated;
grant select (id, business_id, name, key_prefix, scopes, created_by, created_at, last_used_at, revoked_at)
  on public.api_keys to authenticated;
grant insert (business_id, name, key_prefix, key_hash, scopes, created_by)
  on public.api_keys to authenticated;
grant update (revoked_at) on public.api_keys to authenticated;
grant select, insert, update, delete on public.api_keys to service_role;

-- --- webhooks ---------------------------------------------------------------

create table public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  url text not null check (url ~ '^https://[^\s]+$' and char_length(url) <= 500),
  description text check (description is null or char_length(description) <= 120),
  -- Empty means every event.
  events text[] not null default '{}'::text[]
    check (
      events <@ array[
        'booking.created', 'booking.rescheduled', 'booking.cancelled', 'booking.status_changed'
      ]::text[]
    ),
  -- Signs each delivery. Never readable by the browser; shown once on creation.
  secret text not null check (char_length(secret) >= 24),
  is_active boolean not null default true,
  consecutive_failures integer not null default 0,
  disabled_reason text,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index webhook_endpoints_business_idx on public.webhook_endpoints (business_id);
create index webhook_endpoints_created_by_idx on public.webhook_endpoints (created_by) where created_by is not null;

alter table public.webhook_endpoints enable row level security;

create policy "webhook_endpoints_admin_read" on public.webhook_endpoints
  for select to authenticated
  using (app.is_business_admin(business_id));

create policy "webhook_endpoints_admin_insert" on public.webhook_endpoints
  for insert to authenticated
  with check (
    app.is_business_admin(business_id)
    and created_by = (select auth.uid())
  );

create policy "webhook_endpoints_admin_update" on public.webhook_endpoints
  for update to authenticated
  using (app.is_business_admin(business_id))
  with check (app.is_business_admin(business_id));

create policy "webhook_endpoints_admin_delete" on public.webhook_endpoints
  for delete to authenticated
  using (app.is_business_admin(business_id));

revoke all on public.webhook_endpoints from anon, authenticated;
grant select (id, business_id, url, description, events, is_active, consecutive_failures,
              disabled_reason, last_success_at, last_failure_at, created_by, created_at)
  on public.webhook_endpoints to authenticated;
grant insert (business_id, url, description, events, secret, created_by)
  on public.webhook_endpoints to authenticated;
grant update (url, description, events, is_active) on public.webhook_endpoints to authenticated;
grant delete on public.webhook_endpoints to authenticated;
grant select, insert, update, delete on public.webhook_endpoints to service_role;

create table public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null references public.webhook_endpoints (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  event text not null,
  payload jsonb not null,
  status text not null default 'queued'
    check (status in ('queued', 'sending', 'delivered', 'failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  last_status_code integer,
  last_error text check (last_error is null or char_length(last_error) <= 300),
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create index webhook_deliveries_due_idx
  on public.webhook_deliveries (next_attempt_at)
  where status in ('queued', 'sending');
create index webhook_deliveries_endpoint_idx
  on public.webhook_deliveries (endpoint_id, created_at desc);
create index webhook_deliveries_business_idx on public.webhook_deliveries (business_id);

alter table public.webhook_deliveries enable row level security;

-- Owners see what was sent (and why it failed). Nobody writes through the API.
create policy "webhook_deliveries_admin_read" on public.webhook_deliveries
  for select to authenticated
  using (app.is_business_admin(business_id));

revoke all on public.webhook_deliveries from anon, authenticated;
grant select (id, endpoint_id, business_id, event, status, attempts, next_attempt_at,
              last_attempt_at, last_status_code, last_error, delivered_at, created_at)
  on public.webhook_deliveries to authenticated;
grant select, insert, update, delete on public.webhook_deliveries to service_role;

-- What a partner receives about a booking. Built in one place so the hook and
-- the API list the same shape.
create or replace function app.booking_json(a public.appointments)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', a.id,
    'status', a.status,
    'source', a.source,
    'starts_at', a.starts_at,
    'ends_at', a.ends_at,
    'price_cents', a.price_cents,
    'currency', a.currency,
    'external_ref', a.external_ref,
    'customer', jsonb_build_object(
      'name', a.customer_name,
      'email', a.customer_email,
      'phone', a.customer_phone
    ),
    'notes', a.customer_notes,
    'service', (
      select jsonb_build_object('id', s.id, 'external_id', s.external_id, 'name', s.name)
      from public.services s where s.id = a.service_id
    ),
    'staff', (
      select jsonb_build_object('id', sp.id, 'name', sp.display_name)
      from public.staff_profiles sp where sp.id = a.staff_profile_id
    ),
    'created_at', a.created_at,
    'updated_at', a.updated_at
  );
$$;

revoke all on function app.booking_json(public.appointments) from public, anon, authenticated;

create or replace function app.enqueue_booking_webhooks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event text;
begin
  if new.is_demo then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_event := 'booking.created';
  elsif new.status is distinct from old.status then
    v_event := case when new.status = 'cancelled'
      then 'booking.cancelled' else 'booking.status_changed' end;
  elsif new.starts_at is distinct from old.starts_at
    or new.staff_profile_id is distinct from old.staff_profile_id
  then
    v_event := 'booking.rescheduled';
  else
    return new;
  end if;

  insert into public.webhook_deliveries (endpoint_id, business_id, event, payload)
  select
    e.id, e.business_id, v_event,
    jsonb_build_object(
      'type', v_event,
      'created_at', now(),
      'data', jsonb_build_object('booking', app.booking_json(new))
    )
  from public.webhook_endpoints e
  where e.business_id = new.business_id
    and e.is_active
    and (cardinality(e.events) = 0 or v_event = any (e.events));

  return new;
end;
$$;

revoke all on function app.enqueue_booking_webhooks() from public, anon, authenticated;

create trigger appointments_enqueue_webhooks
  after insert or update on public.appointments
  for each row execute function app.enqueue_booking_webhooks();

-- Same claim pattern as the notification outbox: safe on several instances.
create or replace function public.claim_webhook_deliveries(p_limit integer default 25)
returns setof public.webhook_deliveries
language sql
volatile
security definer
set search_path = ''
as $$
  update public.webhook_deliveries d
  set status = 'sending',
      attempts = d.attempts + 1,
      last_attempt_at = now()
  where d.id in (
    select c.id
    from public.webhook_deliveries c
    where c.attempts < 6
      and (
        (c.status = 'queued' and c.next_attempt_at <= now())
        or (c.status = 'sending' and c.last_attempt_at < now() - interval '10 minutes')
      )
    order by c.next_attempt_at
    for update skip locked
    limit least(greatest(p_limit, 1), 100)
  )
  returning d.*;
$$;

revoke execute on function public.claim_webhook_deliveries(integer) from public, anon, authenticated;
grant execute on function public.claim_webhook_deliveries(integer) to service_role;

-- --- external calendar feeds ------------------------------------------------

create table public.calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  staff_profile_id uuid not null references public.staff_profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  -- Private iCal addresses carry a secret token: admin-only, never logged.
  url text not null check (url ~ '^https://[^\s]+$' and char_length(url) <= 1000),
  is_active boolean not null default true,
  last_synced_at timestamptz,
  last_error text check (last_error is null or char_length(last_error) <= 300),
  last_event_count integer,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (staff_profile_id, url)
);

create index calendar_feeds_business_idx on public.calendar_feeds (business_id);
create index calendar_feeds_created_by_idx on public.calendar_feeds (created_by) where created_by is not null;

create or replace function app.check_feed_staff()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.staff_profiles sp
    where sp.id = new.staff_profile_id and sp.business_id = new.business_id
  ) then
    raise exception 'Staff member does not belong to this business'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function app.check_feed_staff() from public, anon, authenticated;

create trigger calendar_feeds_staff_guard
  before insert or update on public.calendar_feeds
  for each row execute function app.check_feed_staff();

alter table public.calendar_feeds enable row level security;

create policy "calendar_feeds_admin_read" on public.calendar_feeds
  for select to authenticated
  using (app.is_business_admin(business_id));

create policy "calendar_feeds_admin_insert" on public.calendar_feeds
  for insert to authenticated
  with check (
    app.is_business_admin(business_id)
    and created_by = (select auth.uid())
  );

create policy "calendar_feeds_admin_update" on public.calendar_feeds
  for update to authenticated
  using (app.is_business_admin(business_id))
  with check (app.is_business_admin(business_id));

create policy "calendar_feeds_admin_delete" on public.calendar_feeds
  for delete to authenticated
  using (app.is_business_admin(business_id));

revoke all on public.calendar_feeds from anon, authenticated;
grant select, delete on public.calendar_feeds to authenticated;
grant insert (business_id, staff_profile_id, name, url, created_by) on public.calendar_feeds to authenticated;
grant update (name, is_active) on public.calendar_feeds to authenticated;
grant select, insert, update, delete on public.calendar_feeds to service_role;

alter table public.staff_time_off
  add column feed_id uuid references public.calendar_feeds (id) on delete cascade;

create index staff_time_off_feed_idx on public.staff_time_off (feed_id) where feed_id is not null;

-- Replaces a feed's busy blocks in one transaction, so a sync that fails half
-- way never leaves the stylist half blocked. Service role only.
create or replace function public.apply_calendar_feed(
  p_feed_id uuid,
  p_blocks jsonb,
  p_error text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_feed public.calendar_feeds%rowtype;
  v_count integer := 0;
begin
  select * into v_feed from public.calendar_feeds where id = p_feed_id;
  if not found then
    return 0;
  end if;

  -- A failed fetch keeps the previous blocks: stale busy time is safer than
  -- silently opening a stylist's whole calendar.
  if p_error is not null then
    update public.calendar_feeds
    set last_error = left(p_error, 300), last_synced_at = now()
    where id = p_feed_id;
    return 0;
  end if;

  delete from public.staff_time_off where feed_id = p_feed_id;

  insert into public.staff_time_off (staff_profile_id, starts_at, ends_at, reason, feed_id)
  select v_feed.staff_profile_id, b.starts_at, b.ends_at, null, p_feed_id
  from jsonb_to_recordset(coalesce(p_blocks, '[]'::jsonb))
    as b(starts_at timestamptz, ends_at timestamptz)
  where b.ends_at > b.starts_at
  limit 2000;

  get diagnostics v_count = row_count;

  update public.calendar_feeds
  set last_error = null, last_synced_at = now(), last_event_count = v_count
  where id = p_feed_id;

  return v_count;
end;
$$;

revoke execute on function public.apply_calendar_feed(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.apply_calendar_feed(uuid, jsonb, text) to service_role;

-- --- API key lookup ---------------------------------------------------------

create or replace function public.verify_api_key(p_key_hash text)
returns table (api_key_id uuid, business_id uuid, scopes text[])
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return query
  select k.id, k.business_id, k.scopes
  from public.api_keys k
  join public.businesses b on b.id = k.business_id
  where k.key_hash = p_key_hash
    and k.revoked_at is null
    and b.status = 'active';

  -- Cheap "last used": at most one write a minute per key.
  update public.api_keys
  set last_used_at = now()
  where key_hash = p_key_hash
    and revoked_at is null
    and (last_used_at is null or last_used_at < now() - interval '1 minute');
end;
$$;

revoke execute on function public.verify_api_key(text) from public, anon, authenticated;
grant execute on function public.verify_api_key(text) to service_role;

-- --- booking through the partner API ----------------------------------------

create or replace function public.api_book_appointment(
  p_business_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_customer_name text,
  p_staff_profile_id uuid default null,
  p_customer_email text default null,
  p_customer_phone text default null,
  p_notes text default null,
  p_external_ref text default null,
  p_location_id uuid default null
)
returns public.appointments
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_service public.services%rowtype;
  v_business public.businesses%rowtype;
  v_day date;
  v_staff uuid := p_staff_profile_id;
  v_row public.appointments%rowtype;
  v_name text := nullif(btrim(coalesce(p_customer_name, '')), '');
  v_email text := nullif(btrim(coalesce(p_customer_email, '')), '');
  v_phone text := nullif(btrim(coalesce(p_customer_phone, '')), '');
  v_ref text := nullif(btrim(coalesce(p_external_ref, '')), '');
begin
  -- A retried request returns the booking it already made.
  if v_ref is not null then
    select * into v_row
    from public.appointments a
    where a.business_id = p_business_id and a.external_ref = v_ref;
    if found then
      return v_row;
    end if;
  end if;

  select * into v_business
  from public.businesses b where b.id = p_business_id and b.status = 'active';
  if not found then
    raise exception 'Business is not accepting bookings' using errcode = 'check_violation';
  end if;

  select * into v_service
  from public.services s
  where s.id = p_service_id and s.business_id = p_business_id and s.is_active;
  if not found then
    raise exception 'Service is not bookable' using errcode = 'check_violation';
  end if;

  if v_name is null or (v_email is null and v_phone is null) then
    raise exception 'A name and an email or phone are required'
      using errcode = 'check_violation', hint = 'customer_required';
  end if;

  v_day := (p_starts_at at time zone v_business.timezone)::date;

  -- No stylist given: take the first one free at that moment.
  if v_staff is null then
    select slot.staff_profile_id into v_staff
    from public.get_available_slots(p_service_id, v_day, v_day, null, p_location_id) slot
    where slot.starts_at = p_starts_at
    order by slot.staff_profile_id
    limit 1;
  end if;

  if v_staff is null or not exists (
    select 1
    from public.get_available_slots(p_service_id, v_day, v_day, v_staff, p_location_id) slot
    where slot.starts_at = p_starts_at and slot.staff_profile_id = v_staff
  ) then
    raise exception 'That time is no longer available'
      using errcode = 'check_violation', hint = 'slot_unavailable';
  end if;

  perform set_config('app.trusted_write', 'on', true);

  begin
    insert into public.appointments (
      business_id, location_id, service_id, staff_profile_id,
      customer_name, customer_email, customer_phone,
      service_name_snapshot, price_cents, currency,
      starts_at, ends_at, status, source, customer_notes, external_ref,
      is_demo
    )
    values (
      p_business_id, p_location_id, p_service_id, v_staff,
      v_name, v_email, v_phone,
      v_service.name, v_service.price_cents, v_service.currency,
      p_starts_at,
      p_starts_at + make_interval(mins => v_service.duration_minutes),
      'confirmed', 'api',
      nullif(btrim(coalesce(p_notes, '')), ''), v_ref,
      false
    )
    returning * into v_row;
  exception when exclusion_violation then
    perform set_config('app.trusted_write', 'off', true);
    raise exception 'That time was just taken'
      using errcode = 'check_violation', hint = 'slot_taken';
  end;

  perform set_config('app.trusted_write', 'off', true);
  return v_row;
end;
$$;

revoke execute on function public.api_book_appointment(
  uuid, uuid, timestamptz, text, uuid, text, text, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.api_book_appointment(
  uuid, uuid, timestamptz, text, uuid, text, text, text, text, uuid
) to service_role;

create or replace function public.api_cancel_appointment(
  p_business_id uuid,
  p_appointment_id uuid,
  p_reason text default null
)
returns public.appointments
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.appointments%rowtype;
begin
  select * into v_row
  from public.appointments a
  where a.id = p_appointment_id and a.business_id = p_business_id
  for update;

  if not found then
    raise exception 'Booking not found' using errcode = 'no_data_found';
  end if;

  if v_row.status = 'cancelled' then
    return v_row;
  end if;

  if v_row.status not in ('pending', 'confirmed') then
    raise exception 'Only a pending or confirmed booking can be cancelled'
      using errcode = 'check_violation', hint = 'not_cancellable';
  end if;

  perform set_config('app.trusted_write', 'on', true);

  update public.appointments
  set status = 'cancelled',
      cancelled_at = now(),
      cancellation_reason = nullif(left(btrim(coalesce(p_reason, '')), 500), '')
  where id = v_row.id
  returning * into v_row;

  perform set_config('app.trusted_write', 'off', true);
  return v_row;
end;
$$;

revoke execute on function public.api_cancel_appointment(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.api_cancel_appointment(uuid, uuid, text) to service_role;
