-- ---------------------------------------------------------------------------
-- GLOWA · 0022a · "open on" without exposing staff time off
--
-- Applied to the live project on 2026-09-23 (version 20260923093334) but never
-- committed, so any database built from this repository - a fresh
-- `supabase start`, a branch, a new environment - kept the 0022 body.
--
-- That body reads `public.staff_time_off` inline. `search_businesses` is
-- SECURITY INVOKER and `anon` has no SELECT on time off (deliberately: a
-- stylist's absences are not public). Postgres checks table permissions for
-- every relation in the plan at executor start, whether or not the branch that
-- reads it ever runs, so *every* anonymous search failed with 42501 - including
-- the landing page, which calls it with no filters at all.
--
-- The staff half moves into `app.has_bookable_staff_on`, a SECURITY DEFINER
-- helper that answers yes or no and never returns a row. This file reproduces
-- the live statements exactly.
-- ---------------------------------------------------------------------------

create or replace function app.has_bookable_staff_on(
  p_business_id uuid,
  p_day date
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_profiles sp
    where sp.business_id = p_business_id
      and sp.is_bookable
      and not exists (
        select 1
        from public.staff_time_off sto
        where sto.staff_profile_id = sp.id
          and sto.starts_at <= p_day::timestamptz
          and sto.ends_at >= (p_day + 1)::timestamptz
      )
  );
$$;

revoke execute on function app.has_bookable_staff_on(uuid, date) from public;
grant execute on function app.has_bookable_staff_on(uuid, date) to anon, authenticated;

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
