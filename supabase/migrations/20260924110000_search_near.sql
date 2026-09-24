-- ---------------------------------------------------------------------------
-- GLOWA · 0030 · search by distance
--
-- "Where" used to mean "type a city that already has a salon". Someone in a
-- town with no salon yet got an empty page, and nobody could say "near me".
--
-- Search now takes an optional point. Every result carries its distance from
-- it (great-circle, from the salon's primary location), and `p_sort =
-- 'distance'` puts the nearest first. A point with no salon in its own town
-- still returns the closest ones, with how far away they are - which is the
-- answer the person actually wanted.
--
-- The point is never stored. Callers round it before it reaches the URL (see
-- `lib/places.ts`), so a shared search link does not carry a home address.
-- ---------------------------------------------------------------------------

drop function if exists public.search_businesses(
  text, public.business_category, text, integer, integer, integer, date, text
);

create or replace function public.search_businesses(
  p_query text default null,
  p_category public.business_category default null,
  p_city text default null,
  p_limit integer default 24,
  p_offset integer default 0,
  p_max_price_cents integer default null,
  p_open_on date default null,
  p_sort text default 'rating',
  p_near_lat double precision default null,
  p_near_lng double precision default null
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
  service_categories public.service_category[],
  distance_km double precision
)
language sql
stable
set search_path = ''
as $$
  with origin as (
    -- A point outside the globe is ignored rather than trusted.
    select
      case when p_near_lat between -90 and 90 and p_near_lng between -180 and 180
        then p_near_lat end as lat,
      case when p_near_lat between -90 and 90 and p_near_lng between -180 and 180
        then p_near_lng end as lng
  )
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
    sv.service_categories,
    d.distance_km
  from public.businesses b
  cross join origin o
  left join lateral (
    select loc.city, loc.country_code, loc.id as location_id,
           loc.latitude::double precision as latitude,
           loc.longitude::double precision as longitude
    from public.locations loc
    where loc.business_id = b.id and loc.is_active
    order by loc.is_primary desc, loc.created_at
    limit 1
  ) l on true
  left join lateral (
    -- Haversine on a 6371 km sphere: well inside a kilometre at city scale,
    -- which is all "2.4 km away" needs.
    select case
      when o.lat is null or l.latitude is null or l.longitude is null then null
      else 2 * 6371 * asin(sqrt(
        power(sin(radians(l.latitude - o.lat) / 2), 2)
        + cos(radians(o.lat)) * cos(radians(l.latitude))
          * power(sin(radians(l.longitude - o.lng) / 2), 2)
      ))
    end as distance_km
  ) d on true
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
    and (p_max_price_cents is null or sv.min_price_cents <= p_max_price_cents)
    and (
      p_open_on is null
      or (
        exists (
          select 1
          from public.business_hours bh
          where bh.location_id = l.location_id
            and bh.day_of_week = extract(dow from p_open_on)::smallint
        )
        and app.has_bookable_staff_on(b.id, p_open_on)
      )
    )
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
  order by
    case when p_sort = 'distance' then d.distance_km end asc nulls last,
    case when p_sort = 'price' then sv.min_price_cents end asc nulls last,
    case when p_sort = 'name' then b.name end asc,
    case when p_sort not in ('price', 'name', 'distance') then coalesce(rs.average_rating, 0) end desc,
    b.name
  limit least(greatest(p_limit, 1), 60)
  offset greatest(p_offset, 0);
$$;

revoke execute on function public.search_businesses(
  text, public.business_category, text, integer, integer, integer, date, text,
  double precision, double precision
) from public;
grant execute on function public.search_businesses(
  text, public.business_category, text, integer, integer, integer, date, text,
  double precision, double precision
) to anon, authenticated;
