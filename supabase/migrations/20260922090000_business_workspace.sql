-- ---------------------------------------------------------------------------
-- GLOWA · 0012 · business workspace
--   onboarding, CRM maintenance, dashboard metrics, campaign audiences,
--   realtime for the shared calendar
-- ---------------------------------------------------------------------------

-- --- onboarding ------------------------------------------------------------

-- Finds a free slug near the requested one. SECURITY DEFINER because slugs of
-- draft businesses are not readable by the caller, so an invoker-side check
-- would happily hand out a slug that is already taken.
create or replace function app.next_free_slug(p_base text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base text;
  v_candidate text;
  v_suffix integer := 1;
begin
  v_base := regexp_replace(lower(coalesce(p_base, '')), '[^a-z0-9]+', '-', 'g');
  v_base := btrim(v_base, '-');
  if length(v_base) < 3 then
    v_base := 'salon-' || substr(md5(random()::text), 1, 6);
  end if;
  v_base := left(v_base, 48);

  v_candidate := v_base;
  while exists (select 1 from public.businesses b where b.slug = v_candidate) loop
    v_suffix := v_suffix + 1;
    v_candidate := v_base || '-' || v_suffix;
    if v_suffix > 200 then
      v_candidate := v_base || '-' || substr(md5(random()::text), 1, 6);
      exit;
    end if;
  end loop;

  return v_candidate;
end;
$$;

revoke execute on function app.next_free_slug(text) from public;
grant execute on function app.next_free_slug(text) to authenticated;

-- Creates the business, its first location, a Tuesday-Saturday default week and
-- a bookable staff profile for the owner, in one transaction. SECURITY INVOKER:
-- the `businesses` insert goes through RLS, the owner-membership trigger fires
-- inside the same transaction, and the later inserts are then authorised by it.
create or replace function public.create_business(
  p_name text,
  p_category public.business_category,
  p_city text,
  p_address text default null,
  p_phone text default null,
  p_timezone text default 'Europe/Sofia',
  p_currency text default 'BGN',
  p_locale text default 'bg'
)
returns public.businesses
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_business public.businesses%rowtype;
  v_location_id uuid;
  v_display_name text;
begin
  if v_uid is null then
    raise exception 'Sign in to create a business' using errcode = 'insufficient_privilege';
  end if;

  if length(btrim(coalesce(p_name, ''))) < 2 then
    raise exception 'A business name is required'
      using errcode = 'check_violation', hint = 'name_required';
  end if;

  -- The city lives on the location, not the business.
  insert into public.businesses (
    slug, name, category, currency, timezone, default_locale,
    phone, status, created_by
  )
  values (
    app.next_free_slug(p_name), btrim(p_name), p_category,
    upper(p_currency), p_timezone, p_locale,
    nullif(btrim(coalesce(p_phone, '')), ''), 'draft', v_uid
  )
  returning * into v_business;

  insert into public.locations (
    business_id, name, address_line1, city, timezone, is_primary, is_active
  )
  values (
    v_business.id, btrim(p_name), nullif(btrim(coalesce(p_address, '')), ''),
    nullif(btrim(coalesce(p_city, '')), ''), p_timezone, true, true
  )
  returning id into v_location_id;

  -- A sensible starting week the owner can edit, rather than an empty calendar
  -- that silently offers no availability.
  insert into public.business_hours (location_id, day_of_week, opens_at, closes_at)
  select v_location_id, d.dow, d.opens, d.closes
  from (values
    (2, time '09:00', time '19:00'),
    (3, time '09:00', time '19:00'),
    (4, time '09:00', time '19:00'),
    (5, time '09:00', time '19:00'),
    (6, time '09:00', time '17:00')
  ) as d(dow, opens, closes);

  select coalesce(nullif(btrim(p.full_name), ''), 'Owner') into v_display_name
  from public.profiles p where p.id = v_uid;

  insert into public.staff_profiles (business_id, member_id, display_name, is_bookable, sort_order)
  select v_business.id, bm.id, coalesce(v_display_name, 'Owner'), true, 1
  from public.business_members bm
  where bm.business_id = v_business.id and bm.profile_id = v_uid;

  insert into public.staff_working_hours (staff_profile_id, location_id, day_of_week, starts_at, ends_at)
  select sp.id, v_location_id, d.dow, time '09:00', time '18:00'
  from public.staff_profiles sp
  cross join (values (2), (3), (4), (5), (6)) as d(dow)
  where sp.business_id = v_business.id;

  insert into public.audit_logs (business_id, actor_profile_id, action, entity_type, entity_id)
  values (v_business.id, v_uid, 'business.created', 'business', v_business.id::text);

  return v_business;
end;
$$;

revoke execute on function public.create_business(
  text, public.business_category, text, text, text, text, text, text
) from public;
grant execute on function public.create_business(
  text, public.business_category, text, text, text, text, text, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- CRM maintenance
--
-- The salon's client record is derived from appointments rather than typed in
-- twice. Only a transition *into* `completed` moves the totals, so replaying an
-- update never double-counts a visit.
-- ---------------------------------------------------------------------------
create or replace function app.sync_business_client()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id uuid;
  v_name text;
  v_completed boolean;
begin
  if new.customer_profile_id is null and new.customer_email is null
     and new.customer_phone is null then
    return new;
  end if;

  v_completed := new.status = 'completed'
    and (tg_op = 'INSERT' or old.status is distinct from 'completed');

  v_name := coalesce(
    new.customer_name,
    (select p.full_name from public.profiles p where p.id = new.customer_profile_id)
  );

  -- Match on the profile when there is one, otherwise on email, otherwise phone.
  select bc.id into v_client_id
  from public.business_clients bc
  where bc.business_id = new.business_id
    and (
      (new.customer_profile_id is not null and bc.profile_id = new.customer_profile_id)
      or (new.customer_profile_id is null and new.customer_email is not null
          and lower(bc.email) = lower(new.customer_email))
      or (new.customer_profile_id is null and new.customer_email is null
          and new.customer_phone is not null and bc.phone = new.customer_phone)
    )
  limit 1;

  if v_client_id is null then
    insert into public.business_clients (
      business_id, profile_id, full_name, email, phone, is_demo
    )
    values (
      new.business_id, new.customer_profile_id, v_name,
      new.customer_email, new.customer_phone, new.is_demo
    )
    returning id into v_client_id;
  else
    update public.business_clients bc
    set full_name = coalesce(bc.full_name, v_name),
        email = coalesce(bc.email, new.customer_email),
        phone = coalesce(bc.phone, new.customer_phone),
        profile_id = coalesce(bc.profile_id, new.customer_profile_id)
    where bc.id = v_client_id;
  end if;

  if v_completed then
    update public.business_clients bc
    set total_visits = bc.total_visits + 1,
        total_spend_cents = bc.total_spend_cents + new.price_cents,
        last_visit_at = greatest(coalesce(bc.last_visit_at, new.starts_at), new.starts_at),
        first_visit_at = least(coalesce(bc.first_visit_at, new.starts_at), new.starts_at)
    where bc.id = v_client_id;
  end if;

  return new;
end;
$$;

create trigger appointments_sync_business_client
  after insert or update of status, customer_profile_id, customer_email, customer_phone
  on public.appointments
  for each row execute function app.sync_business_client();

-- ---------------------------------------------------------------------------
-- Dashboard metrics
--
-- SECURITY INVOKER, so every underlying read is still filtered by RLS. The
-- explicit membership check only turns "silently all zeros" into a clear error.
-- ---------------------------------------------------------------------------
create or replace function public.get_business_dashboard(
  p_business_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  appointments_total integer,
  appointments_completed integer,
  appointments_cancelled integer,
  appointments_no_show integer,
  expected_revenue_cents bigint,
  completed_revenue_cents bigint,
  new_clients integer,
  returning_clients integer,
  booked_minutes integer,
  capacity_minutes integer,
  average_rating numeric,
  review_count integer,
  unanswered_reviews integer
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_timezone text;
begin
  if not app.is_business_member(p_business_id) then
    raise exception 'Not a member of this business'
      using errcode = 'insufficient_privilege', hint = 'not_a_member';
  end if;

  select b.timezone into v_timezone
  from public.businesses b where b.id = p_business_id;

  return query
  with appts as (
    select a.*
    from public.appointments a
    where a.business_id = p_business_id
      and a.starts_at >= p_from
      and a.starts_at < p_to
  ),
  -- A client is "new" when this range contains their first visit to this salon.
  first_visits as (
    select a.customer_profile_id, a.customer_email, min(a.starts_at) as first_at
    from public.appointments a
    where a.business_id = p_business_id
      and a.status in ('completed', 'confirmed', 'pending')
    group by a.customer_profile_id, a.customer_email
  ),
  capacity as (
    select coalesce(sum(
      extract(epoch from (swh.ends_at - swh.starts_at)) / 60
    ), 0)::integer as minutes
    from generate_series(p_from::date, (p_to - interval '1 day')::date, interval '1 day') as d
    join public.staff_working_hours swh
      on swh.day_of_week = extract(dow from d)::smallint
    join public.staff_profiles sp
      on sp.id = swh.staff_profile_id
     and sp.business_id = p_business_id
     and sp.is_bookable
  )
  select
    count(*)::integer,
    count(*) filter (where a.status = 'completed')::integer,
    count(*) filter (where a.status = 'cancelled')::integer,
    count(*) filter (where a.status = 'no_show')::integer,
    coalesce(sum(a.price_cents) filter (where a.status in ('pending', 'confirmed', 'completed')), 0)::bigint,
    coalesce(sum(a.price_cents) filter (where a.status = 'completed'), 0)::bigint,
    count(distinct coalesce(a.customer_profile_id::text, a.customer_email))
      filter (where exists (
        select 1 from first_visits fv
        where fv.customer_profile_id is not distinct from a.customer_profile_id
          and fv.customer_email is not distinct from a.customer_email
          and fv.first_at >= p_from
      ))::integer,
    count(distinct coalesce(a.customer_profile_id::text, a.customer_email))
      filter (where exists (
        select 1 from first_visits fv
        where fv.customer_profile_id is not distinct from a.customer_profile_id
          and fv.customer_email is not distinct from a.customer_email
          and fv.first_at < p_from
      ))::integer,
    coalesce(sum(
      extract(epoch from (a.ends_at - a.starts_at)) / 60
    ) filter (where a.status in ('pending', 'confirmed', 'completed')), 0)::integer,
    (select minutes from capacity),
    (select round(avg(r.rating)::numeric, 2)
     from public.reviews r
     where r.business_id = p_business_id and r.status = 'published'),
    (select count(*)::integer
     from public.reviews r
     where r.business_id = p_business_id and r.status = 'published'),
    (select count(*)::integer
     from public.reviews r
     where r.business_id = p_business_id
       and r.status = 'published'
       and r.business_response is null)
  from appts a;
end;
$$;

revoke execute on function public.get_business_dashboard(uuid, timestamptz, timestamptz) from public;
grant execute on function public.get_business_dashboard(uuid, timestamptz, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- Campaign audiences
--
-- The segment is declarative jsonb on the campaign; this resolves it to real
-- clients so the owner sees who a campaign would reach before sending.
-- Only clients who consented to marketing are ever returned.
-- ---------------------------------------------------------------------------
create or replace function public.preview_campaign_audience(
  p_business_id uuid,
  p_audience jsonb default '{}'::jsonb,
  p_limit integer default 50
)
returns table (
  id uuid,
  full_name text,
  email text,
  phone text,
  last_visit_at timestamptz,
  total_visits integer,
  total_spend_cents bigint,
  tags text[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    bc.id, bc.full_name, bc.email, bc.phone, bc.last_visit_at,
    bc.total_visits, bc.total_spend_cents, bc.tags
  from public.business_clients bc
  where bc.business_id = p_business_id
    and bc.consent_marketing
    and (
      (p_audience ->> 'last_visit_before_days') is null
      or bc.last_visit_at is null
      or bc.last_visit_at < now() - make_interval(days => (p_audience ->> 'last_visit_before_days')::integer)
    )
    and (
      (p_audience ->> 'min_visits') is null
      or bc.total_visits >= (p_audience ->> 'min_visits')::integer
    )
    and (
      (p_audience -> 'tags') is null
      or jsonb_array_length(p_audience -> 'tags') = 0
      or bc.tags && (select array_agg(value::text) from jsonb_array_elements_text(p_audience -> 'tags'))
    )
  order by bc.last_visit_at desc nulls last
  limit least(greatest(p_limit, 1), 500);
$$;

revoke execute on function public.preview_campaign_audience(uuid, jsonb, integer) from public;
grant execute on function public.preview_campaign_audience(uuid, jsonb, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime
--
-- The calendar is a shared surface: two staff members editing the same day must
-- not work from stale screens. Realtime respects RLS, so a subscriber only
-- receives rows their policies already allow.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'appointments'
  ) then
    alter publication supabase_realtime add table public.appointments;
  end if;
end;
$$;

-- Realtime needs the full old row to match deletes and updates against RLS.
alter table public.appointments replica identity full;
