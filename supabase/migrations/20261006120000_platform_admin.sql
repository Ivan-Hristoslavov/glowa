-- ---------------------------------------------------------------------------
-- Platform owner's console.
--
-- Salon roles (owner/admin/manager/staff) are all scoped to one business. The
-- person who runs Lavena itself needs the view across all of them, so that
-- gets its own tiny table: a row here makes a profile a platform admin. There
-- is no policy to write it - rows are added by the project owner in SQL:
--
--   insert into public.platform_admins (profile_id)
--   select id from auth.users where email = '<your email>';
--
-- The console reads everything through one SECURITY DEFINER function that
-- refuses anyone who is not in the table, so no table policy is widened for it
-- and a salon member can never read another salon's rows through this path.
-- ---------------------------------------------------------------------------

create table public.platform_admins (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

create policy "platform_admins_read_self" on public.platform_admins
  for select to authenticated
  using (profile_id = (select auth.uid()));

revoke all on public.platform_admins from anon, authenticated;
grant select on public.platform_admins to authenticated;

create or replace function app.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_admins
    where profile_id = (select auth.uid())
  );
$$;

revoke all on function app.is_platform_admin() from public, anon;
grant execute on function app.is_platform_admin() to authenticated;

-- One round trip for the whole console. Demo data is left out of every number.
create or replace function public.platform_overview(p_days integer default 90)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days integer := greatest(7, least(coalesce(p_days, 90), 365));
  v_zone constant text := 'Europe/Sofia';
  v_today date := (now() at time zone v_zone)::date;
  v_result jsonb;
begin
  if not app.is_platform_admin() then
    raise exception 'Not a platform admin' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'generated_at', now(),
    'days', v_days,

    'totals', jsonb_build_object(
      'businesses', (select count(*) from public.businesses where not is_demo),
      'active_businesses', (select count(*) from public.businesses where not is_demo and status = 'active'),
      'users', (select count(*) from public.profiles where not is_demo),
      'appointments', (select count(*) from public.appointments where not is_demo),
      'appointments_30d', (select count(*) from public.appointments
         where not is_demo and created_at >= now() - interval '30 days'),
      'booked_cents_30d', (select coalesce(sum(price_cents), 0) from public.appointments
         where not is_demo and status <> 'cancelled' and created_at >= now() - interval '30 days'),
      'online_share_30d', (select case when count(*) = 0 then null
           else round(100.0 * count(*) filter (where source = 'customer_web') / count(*)) end
         from public.appointments
         where not is_demo and created_at >= now() - interval '30 days')
    ),

    'daily', (
      select coalesce(jsonb_agg(row order by day), '[]'::jsonb) from (
        select
          d.day,
          jsonb_build_object(
            'day', d.day,
            'businesses', (select count(*) from public.businesses b
               where not b.is_demo and (b.created_at at time zone v_zone)::date = d.day),
            'users', (select count(*) from public.profiles p
               where not p.is_demo and (p.created_at at time zone v_zone)::date = d.day),
            'bookings', (select count(*) from public.appointments a
               where not a.is_demo and (a.created_at at time zone v_zone)::date = d.day),
            'online_bookings', (select count(*) from public.appointments a
               where not a.is_demo and a.source = 'customer_web'
                 and (a.created_at at time zone v_zone)::date = d.day),
            'booked_cents', (select coalesce(sum(a.price_cents), 0) from public.appointments a
               where not a.is_demo and a.status <> 'cancelled'
                 and (a.created_at at time zone v_zone)::date = d.day)
          ) as row
        from generate_series(v_today - (v_days - 1), v_today, interval '1 day') as g(day_ts),
             lateral (select g.day_ts::date as day) d
      ) series
    ),

    'by_status', (
      select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (
        select status, count(*) as n from public.businesses where not is_demo group by status
      ) s
    ),

    'by_category', (
      select coalesce(jsonb_agg(jsonb_build_object('category', category, 'count', n) order by n desc), '[]'::jsonb) from (
        select category, count(*) as n from public.businesses where not is_demo group by category
      ) c
    ),

    'subscriptions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'plan', plan, 'interval', billing_interval, 'status', status, 'count', n)), '[]'::jsonb) from (
        select s.plan, s.billing_interval, s.status, count(*) as n
        from public.business_subscriptions s
        join public.businesses b on b.id = s.business_id and not b.is_demo
        group by 1, 2, 3
      ) x
    ),

    'salons', (
      select coalesce(jsonb_agg(row order by created_at desc), '[]'::jsonb) from (
        select
          b.created_at,
          jsonb_build_object(
            'id', b.id,
            'name', b.name,
            'slug', b.slug,
            'status', b.status,
            'category', b.category,
            'city', (select l.city from public.locations l
                     where l.business_id = b.id order by l.is_primary desc limit 1),
            'created_at', b.created_at,
            'services', (select count(*) from public.services s where s.business_id = b.id and s.is_active),
            'team', (select count(*) from public.staff_profiles sp where sp.business_id = b.id),
            'clients', (select count(*) from public.business_clients c where c.business_id = b.id),
            'bookings_total', (select count(*) from public.appointments a where a.business_id = b.id),
            'bookings_30d', (select count(*) from public.appointments a
               where a.business_id = b.id and a.created_at >= now() - interval '30 days'),
            'last_booking_at', (select max(a.created_at) from public.appointments a where a.business_id = b.id),
            'plan', sub.plan,
            'interval', sub.billing_interval,
            'subscription_status', sub.status,
            'period_end', sub.current_period_end
          ) as row
        from public.businesses b
        left join public.business_subscriptions sub on sub.business_id = b.id
        where not b.is_demo
        order by b.created_at desc
        limit 200
      ) salons
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.platform_overview(integer) from public, anon;
grant execute on function public.platform_overview(integer) to authenticated;
