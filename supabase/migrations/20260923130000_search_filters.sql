-- ---------------------------------------------------------------------------
-- GLOWA · 0022 · price, day and sort in discovery
--
-- The brief asks for filtering by availability and price. Price is a straight
-- comparison against the cheapest active service.
--
-- "Availability" is deliberately the weaker claim: this filters to businesses
-- that are *open* on the chosen day, not ones with a confirmed free slot.
-- Computing real openings means expanding every service against every
-- stylist's hours, time off and existing bookings for each candidate - a cost
-- that belongs on one salon's page, not on a result list. Promising "free at
-- 14:00" and then showing a full calendar is worse than promising nothing, so
-- the UI calls this what it is: open on that day.
-- ---------------------------------------------------------------------------

drop function if exists public.search_businesses(
  text, public.business_category, text, integer, integer
);

create or replace function public.search_businesses(
  p_query text default null,
  p_category public.business_category default null,
  p_city text default null,
  p_limit integer default 24,
  p_offset integer default 0,
  p_max_price_cents integer default null,
  p_open_on date default null,
  p_sort text default 'rating'
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
    select loc.city, loc.country_code, loc.id as location_id
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
    and (p_max_price_cents is null or sv.min_price_cents <= p_max_price_cents)
    -- Open on the chosen weekday, and not with every stylist away that day.
    and (
      p_open_on is null
      or (
        exists (
          select 1
          from public.business_hours bh
          where bh.location_id = l.location_id
            and bh.day_of_week = extract(dow from p_open_on)::smallint
        )
        and exists (
          select 1
          from public.staff_profiles sp
          where sp.business_id = b.id
            and sp.is_bookable
            and not exists (
              select 1
              from public.staff_time_off sto
              where sto.staff_profile_id = sp.id
                and sto.starts_at <= p_open_on::timestamptz
                and sto.ends_at >= (p_open_on + 1)::timestamptz
            )
        )
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
    -- A business with no price yet sorts last under a price sort rather than
    -- first, which is what `nulls last` buys.
    case when p_sort = 'price' then sv.min_price_cents end asc nulls last,
    case when p_sort = 'name' then b.name end asc,
    case when p_sort not in ('price', 'name') then coalesce(rs.average_rating, 0) end desc,
    b.name
  limit least(greatest(p_limit, 1), 60)
  offset greatest(p_offset, 0);
$$;

revoke execute on function public.search_businesses(
  text, public.business_category, text, integer, integer, integer, date, text
) from public;
grant execute on function public.search_businesses(
  text, public.business_category, text, integer, integer, integer, date, text
) to anon, authenticated;

-- No new indexes: `business_hours_location_idx` is already
-- (location_id, day_of_week) and `staff_time_off_staff_idx` already leads with
-- (staff_profile_id, starts_at). Adding near-duplicates would cost writes for
-- nothing.
