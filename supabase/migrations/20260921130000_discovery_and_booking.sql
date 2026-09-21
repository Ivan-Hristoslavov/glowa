-- ---------------------------------------------------------------------------
-- GLOWA · 0007 · customer surface: search, availability, booking
--
-- Availability and booking are database functions rather than application
-- code so that the rules (opening hours, staff hours, time off, lead time,
-- cancellation window) are evaluated in one place, in the same transaction
-- that writes the row.
-- ---------------------------------------------------------------------------

create extension if not exists pg_trgm with schema extensions;

-- --- search ----------------------------------------------------------------

-- 'simple' rather than a language configuration: one column has to serve
-- Bulgarian, English and Romanian, and Postgres ships no Bulgarian stemmer.
alter table public.businesses
  add column search_vector tsvector
  generated always as (
    to_tsvector(
      'simple',
      coalesce(name, '') || ' ' ||
      coalesce(description ->> 'bg', '') || ' ' ||
      coalesce(description ->> 'en', '') || ' ' ||
      coalesce(description ->> 'ro', '') || ' ' ||
      coalesce(short_pitch ->> 'bg', '') || ' ' ||
      coalesce(short_pitch ->> 'en', '') || ' ' ||
      coalesce(short_pitch ->> 'ro', '')
    )
  ) stored;

create index businesses_search_vector_idx on public.businesses using gin (search_vector);
create index businesses_name_trgm_idx on public.businesses using gin (name extensions.gin_trgm_ops);
create index locations_city_trgm_idx on public.locations using gin (city extensions.gin_trgm_ops);

-- Published ratings, aggregated. security_invoker keeps the caller's RLS on
-- `reviews` in force, so a hidden review never reaches the average.
create view public.business_rating_summary
with (security_invoker = true) as
select
  r.business_id,
  count(*)::integer as review_count,
  round(avg(r.rating)::numeric, 2) as average_rating
from public.reviews r
where r.status = 'published'
group by r.business_id;

grant select on public.business_rating_summary to anon, authenticated;

-- One query behind the whole results grid: match, filter, rate and price.
create or replace function public.search_businesses(
  p_query text default null,
  p_category public.business_category default null,
  p_city text default null,
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  id uuid,
  slug text,
  name text,
  short_pitch jsonb,
  category public.business_category,
  logo_url text,
  cover_image_url text,
  city text,
  country_code text,
  average_rating numeric,
  review_count integer,
  min_price_cents integer,
  currency text,
  service_categories public.service_category[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    b.id,
    b.slug,
    b.name,
    b.short_pitch,
    b.category,
    b.logo_url,
    b.cover_image_url,
    l.city,
    l.country_code,
    rs.average_rating,
    coalesce(rs.review_count, 0) as review_count,
    sv.min_price_cents,
    b.currency,
    sv.service_categories
  from public.businesses b
  left join lateral (
    select loc.city, loc.country_code
    from public.locations loc
    where loc.business_id = b.id and loc.is_active
    order by loc.is_primary desc, loc.created_at
    limit 1
  ) l on true
  left join public.business_rating_summary rs on rs.business_id = b.id
  left join lateral (
    select
      min(s.price_cents)::integer as min_price_cents,
      array_agg(distinct s.category) as service_categories
    from public.services s
    where s.business_id = b.id and s.is_active
  ) sv on true
  where b.status = 'active'
    and (p_category is null or b.category = p_category)
    and (p_city is null or l.city ilike '%' || p_city || '%')
    and (
      p_query is null
      or btrim(p_query) = ''
      or b.search_vector @@ plainto_tsquery('simple', p_query)
      or b.name ilike '%' || p_query || '%'
      or exists (
        select 1
        from public.services s2
        where s2.business_id = b.id
          and s2.is_active
          and (
            s2.name ->> 'bg' ilike '%' || p_query || '%'
            or s2.name ->> 'en' ilike '%' || p_query || '%'
            or s2.name ->> 'ro' ilike '%' || p_query || '%'
          )
      )
    )
  order by coalesce(rs.average_rating, 0) desc, b.name
  limit least(greatest(p_limit, 1), 60)
  offset greatest(p_offset, 0);
$$;

grant execute on function public.search_businesses(text, public.business_category, text, integer, integer)
  to anon, authenticated;

-- --- availability ----------------------------------------------------------

-- SECURITY DEFINER because public availability has to account for staff time
-- off, which is deliberately not readable by customers. Only slot boundaries
-- leave the function; no reason, note or client detail does.
create or replace function public.get_available_slots(
  p_service_id uuid,
  p_from date,
  p_to date,
  p_staff_profile_id uuid default null,
  p_location_id uuid default null
)
returns table (
  starts_at timestamptz,
  ends_at timestamptz,
  staff_profile_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_service public.services%rowtype;
  v_business public.businesses%rowtype;
  v_step constant interval := interval '15 minutes';
  v_occupied interval;
  v_duration interval;
  v_min_lead interval;
  v_max_advance integer;
begin
  select * into v_service
  from public.services s
  where s.id = p_service_id and s.is_active;
  if not found then
    return;
  end if;

  select * into v_business
  from public.businesses b
  where b.id = v_service.business_id and b.status = 'active';
  if not found then
    return;
  end if;

  if p_to < p_from or (p_to - p_from) > 62 then
    raise exception 'Requested range must be between 1 and 62 days'
      using errcode = 'check_violation';
  end if;

  v_duration := make_interval(mins => v_service.duration_minutes);
  v_occupied := make_interval(
    mins => v_service.duration_minutes
          + v_service.buffer_before_minutes
          + v_service.buffer_after_minutes
  );
  v_min_lead := make_interval(
    mins => coalesce((v_business.booking_policy ->> 'min_lead_minutes')::integer, 60)
  );
  v_max_advance := coalesce((v_business.booking_policy ->> 'max_advance_days')::integer, 90);

  return query
  with days as (
    select d::date as day
    from generate_series(p_from, p_to, interval '1 day') as d
  ),
  bookable_staff as (
    select sp.id
    from public.staff_profiles sp
    join public.service_staff ss on ss.staff_profile_id = sp.id
    where ss.service_id = p_service_id
      and sp.is_bookable
      and (p_staff_profile_id is null or sp.id = p_staff_profile_id)
  ),
  windows as (
    select distinct
      st.id as staff_id,
      greatest(
        (d.day + bh.opens_at) at time zone v_business.timezone,
        (d.day + swh.starts_at) at time zone v_business.timezone
      ) as win_start,
      least(
        (d.day + bh.closes_at) at time zone v_business.timezone,
        (d.day + swh.ends_at) at time zone v_business.timezone
      ) as win_end
    from days d
    cross join bookable_staff st
    join public.staff_working_hours swh
      on swh.staff_profile_id = st.id
     and swh.day_of_week = extract(dow from d.day)::smallint
    join public.locations l
      on l.business_id = v_business.id
     and l.is_active
     and (p_location_id is null or l.id = p_location_id)
     and (swh.location_id is null or swh.location_id = l.id)
    join public.business_hours bh
      on bh.location_id = l.id
     and bh.day_of_week = extract(dow from d.day)::smallint
  ),
  candidate as (
    select
      w.staff_id,
      g as slot_start,
      g + v_duration as slot_end
    from windows w
    cross join lateral generate_series(w.win_start, w.win_end - v_occupied, v_step) as g
    where w.win_end - w.win_start >= v_occupied
  )
  select c.slot_start, c.slot_end, c.staff_id
  from candidate c
  where c.slot_start >= now() + v_min_lead
    and c.slot_start <= now() + make_interval(days => v_max_advance)
    and not exists (
      select 1
      from public.appointments a
      where a.staff_profile_id = c.staff_id
        and a.status in ('pending', 'confirmed')
        and tstzrange(a.starts_at, a.ends_at, '[)')
            && tstzrange(c.slot_start, c.slot_end, '[)')
    )
    and not exists (
      select 1
      from public.staff_time_off t
      where t.staff_profile_id = c.staff_id
        and tstzrange(t.starts_at, t.ends_at, '[)')
            && tstzrange(c.slot_start, c.slot_end, '[)')
    )
  order by c.slot_start, c.staff_id;
end;
$$;

grant execute on function public.get_available_slots(uuid, date, date, uuid, uuid)
  to anon, authenticated;
