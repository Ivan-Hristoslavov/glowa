-- ---------------------------------------------------------------------------
-- GLOWA · 0002 · core domain tables
--   profiles -> businesses -> locations / business_hours
--   businesses -> business_members -> staff_profiles -> availability
--   businesses -> services -> service_staff
-- ---------------------------------------------------------------------------

-- --- identity --------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  phone text,
  locale text not null default 'bg' check (locale in ('bg', 'en', 'ro')),
  timezone text not null default 'Europe/Sofia',
  marketing_opt_in boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per auth user. Owned by the user; businesses only see the slice exposed through business_clients.';

-- Every auth user gets a profile, including OAuth sign-ups.
create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, locale)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'locale', ''), 'bg')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

-- --- businesses ------------------------------------------------------------

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 64),
  name text not null check (length(btrim(name)) > 0),
  legal_name text,
  description jsonb check (app.is_localized_text(description)),
  short_pitch jsonb check (app.is_localized_text(short_pitch)),
  category public.business_category not null default 'other',
  logo_url text,
  cover_image_url text,
  gallery jsonb not null default '[]'::jsonb,
  email text,
  phone text,
  website text,
  currency text not null default 'BGN' check (currency ~ '^[A-Z]{3}$'),
  timezone text not null default 'Europe/Sofia',
  default_locale text not null default 'bg' check (default_locale in ('bg', 'en', 'ro')),
  -- Cancellation window, deposit rules, lead time. Read server-side when a
  -- booking is validated; never trusted from the client.
  booking_policy jsonb not null default jsonb_build_object(
    'min_lead_minutes', 60,
    'max_advance_days', 90,
    'cancellation_window_hours', 24,
    'allow_customer_reschedule', true
  ),
  -- Public Google review destination. GLOWA links to it; it never claims to
  -- own or import Google reviews.
  google_review_url text,
  status public.business_status not null default 'draft',
  is_demo boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index businesses_status_idx on public.businesses (status) where status = 'active';
create index businesses_category_idx on public.businesses (category);

create table public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete cascade,
  invited_email text,
  role public.business_role not null default 'staff',
  status public.member_status not null default 'invited',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_members_identified check (profile_id is not null or invited_email is not null)
);

create unique index business_members_unique_profile_idx
  on public.business_members (business_id, profile_id)
  where profile_id is not null;

create index business_members_profile_idx on public.business_members (profile_id);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  address_line1 text,
  address_line2 text,
  city text,
  region text,
  postal_code text,
  country_code text not null default 'BG' check (country_code ~ '^[A-Z]{2}$'),
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  phone text,
  timezone text not null default 'Europe/Sofia',
  is_primary boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index locations_business_idx on public.locations (business_id);
create index locations_city_idx on public.locations (lower(city));
create unique index locations_single_primary_idx
  on public.locations (business_id) where is_primary;

create table public.business_hours (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations (id) on delete cascade,
  -- 0 = Sunday, matching Postgres `extract(dow ...)`.
  day_of_week smallint not null check (day_of_week between 0 and 6),
  opens_at time not null,
  closes_at time not null,
  created_at timestamptz not null default now(),
  constraint business_hours_valid_range check (closes_at > opens_at)
);

create index business_hours_location_idx on public.business_hours (location_id, day_of_week);

-- --- staff -----------------------------------------------------------------

create table public.staff_profiles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  member_id uuid unique references public.business_members (id) on delete set null,
  display_name text not null,
  title jsonb check (app.is_localized_text(title)),
  bio jsonb check (app.is_localized_text(bio)),
  avatar_url text,
  -- Calendar chip colour, picked from the GLOWA palette in the admin UI.
  color text not null default '#D96C61' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  is_bookable boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index staff_profiles_business_idx on public.staff_profiles (business_id);

create table public.staff_working_hours (
  id uuid primary key default gen_random_uuid(),
  staff_profile_id uuid not null references public.staff_profiles (id) on delete cascade,
  location_id uuid references public.locations (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  starts_at time not null,
  ends_at time not null,
  created_at timestamptz not null default now(),
  constraint staff_working_hours_valid_range check (ends_at > starts_at)
);

create index staff_working_hours_staff_idx
  on public.staff_working_hours (staff_profile_id, day_of_week);

create table public.staff_time_off (
  id uuid primary key default gen_random_uuid(),
  staff_profile_id uuid not null references public.staff_profiles (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint staff_time_off_valid_range check (ends_at > starts_at)
);

create index staff_time_off_staff_idx on public.staff_time_off (staff_profile_id, starts_at);

-- --- catalog ---------------------------------------------------------------

create table public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name jsonb not null check (app.is_localized_text(name) and name ? 'bg'),
  description jsonb check (app.is_localized_text(description)),
  category public.service_category not null default 'other',
  duration_minutes integer not null check (duration_minutes between 5 and 1440),
  buffer_before_minutes integer not null default 0 check (buffer_before_minutes between 0 and 240),
  buffer_after_minutes integer not null default 0 check (buffer_after_minutes between 0 and 240),
  -- Money is stored in minor units; never as a float.
  price_cents integer not null default 0 check (price_cents >= 0),
  currency text not null default 'BGN' check (currency ~ '^[A-Z]{3}$'),
  requires_deposit boolean not null default false,
  deposit_cents integer not null default 0 check (deposit_cents >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint services_deposit_within_price
    check (not requires_deposit or deposit_cents <= price_cents)
);

create index services_business_idx on public.services (business_id) where is_active;
create index services_category_idx on public.services (category) where is_active;

create table public.service_staff (
  service_id uuid not null references public.services (id) on delete cascade,
  staff_profile_id uuid not null references public.staff_profiles (id) on delete cascade,
  primary key (service_id, staff_profile_id)
);

create index service_staff_staff_idx on public.service_staff (staff_profile_id);
