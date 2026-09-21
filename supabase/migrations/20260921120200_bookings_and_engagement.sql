-- ---------------------------------------------------------------------------
-- GLOWA · 0003 · bookings, CRM, reviews, payments, notifications, growth
-- ---------------------------------------------------------------------------

-- --- bookings --------------------------------------------------------------

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  location_id uuid references public.locations (id) on delete set null,
  service_id uuid references public.services (id) on delete set null,
  staff_profile_id uuid references public.staff_profiles (id) on delete set null,
  customer_profile_id uuid references public.profiles (id) on delete set null,
  -- Snapshot of who booked and what was agreed. Kept even if the service is
  -- renamed or repriced later, so history stays truthful.
  customer_name text,
  customer_email text,
  customer_phone text,
  service_name_snapshot jsonb check (app.is_localized_text(service_name_snapshot)),
  price_cents integer not null default 0 check (price_cents >= 0),
  currency text not null default 'BGN' check (currency ~ '^[A-Z]{3}$'),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'pending',
  source public.appointment_source not null default 'customer_web',
  customer_notes text,
  internal_notes text,
  cancellation_reason text,
  cancelled_at timestamptz,
  completed_at timestamptz,
  is_demo boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_valid_range check (ends_at > starts_at),
  constraint appointments_identified_customer
    check (customer_profile_id is not null or customer_email is not null or customer_phone is not null)
);

-- The double-booking safeguard. Enforced by Postgres inside the inserting
-- transaction, so two concurrent bookings for the same stylist cannot both
-- win a race that application-level checks would miss.
alter table public.appointments
  add constraint appointments_no_staff_overlap
  exclude using gist (
    staff_profile_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (staff_profile_id is not null and status in ('pending', 'confirmed'));

create index appointments_business_starts_idx
  on public.appointments (business_id, starts_at desc);
create index appointments_staff_starts_idx
  on public.appointments (staff_profile_id, starts_at desc);
create index appointments_customer_starts_idx
  on public.appointments (customer_profile_id, starts_at desc);
create index appointments_status_idx
  on public.appointments (business_id, status);

create table public.appointment_status_history (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  from_status public.appointment_status,
  to_status public.appointment_status not null,
  changed_by uuid references public.profiles (id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

create index appointment_status_history_appointment_idx
  on public.appointment_status_history (appointment_id, created_at desc);

create or replace function app.log_appointment_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.appointment_status_history (appointment_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, new.created_by);
  elsif new.status is distinct from old.status then
    insert into public.appointment_status_history (appointment_id, from_status, to_status, changed_by, reason)
    values (new.id, old.status, new.status, (select auth.uid()), new.cancellation_reason);
  end if;
  return new;
end;
$$;

create trigger appointments_status_history
  after insert or update of status on public.appointments
  for each row execute function app.log_appointment_status_change();

-- --- business-side CRM -----------------------------------------------------

-- The business's own record of a client. Separate from `profiles` so a salon
-- can keep notes and tags without gaining access to the person's global
-- GLOWA profile, and so walk-in clients work without an account.
create table public.business_clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  full_name text,
  email text,
  phone text,
  notes text,
  tags text[] not null default '{}',
  consent_marketing boolean not null default false,
  consent_updated_at timestamptz,
  first_visit_at timestamptz,
  last_visit_at timestamptz,
  total_visits integer not null default 0 check (total_visits >= 0),
  total_spend_cents bigint not null default 0 check (total_spend_cents >= 0),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_clients_identified
    check (profile_id is not null or email is not null or phone is not null)
);

create unique index business_clients_unique_profile_idx
  on public.business_clients (business_id, profile_id)
  where profile_id is not null;
create index business_clients_business_idx on public.business_clients (business_id);

-- --- customer-owned preferences -------------------------------------------

create table public.customer_preferences (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  preferred_locale text check (preferred_locale in ('bg', 'en', 'ro')),
  preferred_channel public.notification_channel not null default 'email',
  reminder_lead_minutes integer not null default 1440
    check (reminder_lead_minutes between 0 and 20160),
  notes text,
  accessibility_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.saved_businesses (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, business_id)
);

create index saved_businesses_business_idx on public.saved_businesses (business_id);

create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  -- Null business_id = the account-wide default for this event.
  business_id uuid references public.businesses (id) on delete cascade,
  channel public.notification_channel not null,
  event_type public.notification_event not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index notification_preferences_unique_idx
  on public.notification_preferences (
    profile_id, coalesce(business_id, '00000000-0000-0000-0000-000000000000'::uuid),
    channel, event_type
  );

-- --- reviews ---------------------------------------------------------------

-- GLOWA's own reviews only. External provider reviews are never copied in
-- here; a business links out to its public Google destination instead.
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  appointment_id uuid unique references public.appointments (id) on delete set null,
  author_profile_id uuid references public.profiles (id) on delete set null,
  staff_profile_id uuid references public.staff_profiles (id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  status public.review_status not null default 'published',
  business_response text,
  responded_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reviews_business_idx
  on public.reviews (business_id, created_at desc) where status = 'published';

-- Invitations to review, so the admin can see who was asked without GLOWA
-- pretending to know anything about Google's own review state.
create table public.review_invitations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  channel public.notification_channel not null default 'email',
  sent_at timestamptz,
  responded_at timestamptz,
  destination text not null default 'glowa' check (destination in ('glowa', 'google')),
  created_at timestamptz not null default now(),
  unique (appointment_id, destination)
);

-- --- payments --------------------------------------------------------------

-- Records only. No card data, no provider secrets: the provider reference is
-- an opaque id resolved server-side.
create table public.payment_records (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete set null,
  profile_id uuid references public.profiles (id) on delete set null,
  kind public.payment_kind not null default 'full',
  status public.payment_status not null default 'pending',
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'BGN' check (currency ~ '^[A-Z]{3}$'),
  provider text,
  provider_reference text,
  failure_reason text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_reference)
);

create index payment_records_business_idx
  on public.payment_records (business_id, created_at desc);
create index payment_records_appointment_idx on public.payment_records (appointment_id);

-- --- external calendars ----------------------------------------------------

-- The connection row is readable by its owner; the OAuth tokens live in
-- `private`, which no client role can reach at all.
create table public.external_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete cascade,
  provider public.calendar_provider not null default 'google',
  account_email text,
  calendar_id text,
  scopes text[] not null default '{}',
  status public.connection_status not null default 'active',
  last_synced_at timestamptz,
  sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_calendar_owner check (profile_id is not null or business_id is not null)
);

create unique index external_calendar_unique_profile_idx
  on public.external_calendar_connections (profile_id, provider, coalesce(calendar_id, ''))
  where profile_id is not null;

create table private.calendar_credentials (
  connection_id uuid primary key
    references public.external_calendar_connections (id) on delete cascade,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Appointments are mapped to provider event ids here rather than carrying a
-- Google column, so a second provider is additive.
create table public.calendar_event_links (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null
    references public.external_calendar_connections (id) on delete cascade,
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  external_event_id text not null,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (connection_id, appointment_id)
);

-- --- marketing -------------------------------------------------------------

create table public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  type public.campaign_type not null default 'custom',
  status public.campaign_status not null default 'draft',
  channel public.notification_channel not null default 'email',
  -- Declarative segment, e.g. {"last_visit_before_days": 60, "tags": ["vip"]}
  audience jsonb not null default '{}'::jsonb,
  template jsonb not null default '{}'::jsonb check (app.is_localized_text(template -> 'subject')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  stats jsonb not null default '{}'::jsonb,
  is_demo boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index marketing_campaigns_business_idx
  on public.marketing_campaigns (business_id, created_at desc);

-- One row per recipient per campaign. The idempotency key is what stops a
-- retried send from messaging the same client twice.
create table public.marketing_messages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.marketing_campaigns (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  business_client_id uuid references public.business_clients (id) on delete set null,
  channel public.notification_channel not null default 'email',
  event_type public.notification_event not null default 'marketing',
  idempotency_key text not null unique,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'failed', 'skipped')),
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create index marketing_messages_campaign_idx on public.marketing_messages (campaign_id);

-- --- audit -----------------------------------------------------------------

create table public.audit_logs (
  id bigint generated always as identity primary key,
  business_id uuid references public.businesses (id) on delete cascade,
  actor_profile_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_business_idx on public.audit_logs (business_id, created_at desc);

-- --- updated_at triggers ---------------------------------------------------

do $$
declare
  target text;
begin
  foreach target in array array[
    'public.profiles', 'public.businesses', 'public.business_members',
    'public.locations', 'public.staff_profiles', 'public.services',
    'public.appointments', 'public.business_clients', 'public.customer_preferences',
    'public.notification_preferences', 'public.reviews', 'public.payment_records',
    'public.external_calendar_connections', 'public.marketing_campaigns',
    'private.calendar_credentials'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on %s
         for each row execute function app.set_updated_at()',
      target
    );
  end loop;
end;
$$;
