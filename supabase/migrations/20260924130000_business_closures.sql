-- ---------------------------------------------------------------------------
-- GLOWA · business closures: days and hours a salon does not take bookings
--
-- `staff_time_off` answers "Maria is away on Friday". It cannot answer "we are
-- closed from 24 to 26 December" without a row per stylist, and a stylist
-- hired after the holiday was entered would be bookable on it. A closure
-- belongs to the business (optionally to one location), not to a person.
--
-- Stored as `timestamptz`. The admin enters dates and times on the salon's
-- own clock; the application converts them with the business timezone
-- (DST-safe, `lib/timezone.ts`), so the same row means the same hours in
-- Sofia, Bucharest or anywhere else the product runs.
--
-- Enforcement is in `get_available_slots`, which `book_appointment` already
-- consults, so a closure is honoured by every booking path customers have.
-- The front desk can still write someone in by hand - it is their salon.
-- ---------------------------------------------------------------------------

create table public.business_closures (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  -- Null means every location of the business.
  location_id uuid references public.locations (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- Internal. Customers see that the salon is closed, never why.
  reason text check (reason is null or char_length(reason) <= 200),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint business_closures_valid_range check (ends_at > starts_at),
  -- A typo in the year should not close a salon for a decade.
  constraint business_closures_reasonable_length check (ends_at - starts_at <= interval '400 days')
);

create index business_closures_business_idx
  on public.business_closures (business_id, starts_at);
create index business_closures_location_idx
  on public.business_closures (location_id) where location_id is not null;
create index business_closures_created_by_idx
  on public.business_closures (created_by) where created_by is not null;

-- A closure for a location must be a closure of that location's business.
create or replace function app.check_closure_location()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.location_id is not null and not exists (
    select 1 from public.locations l
    where l.id = new.location_id and l.business_id = new.business_id
  ) then
    raise exception 'Location does not belong to this business'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger business_closures_location_guard
  before insert or update on public.business_closures
  for each row execute function app.check_closure_location();

alter table public.business_closures enable row level security;

-- Members read (the calendar shades closed time for everyone on the team);
-- managers write, the same split as staff time off.
create policy "business_closures_member_read" on public.business_closures
  for select to authenticated
  using (app.is_business_member(business_id));

create policy "business_closures_manager_insert" on public.business_closures
  for insert to authenticated
  with check (app.is_business_manager(business_id));

create policy "business_closures_manager_update" on public.business_closures
  for update to authenticated
  using (app.is_business_manager(business_id))
  with check (app.is_business_manager(business_id));

create policy "business_closures_manager_delete" on public.business_closures
  for delete to authenticated
  using (app.is_business_manager(business_id));

grant select, insert, update, delete on public.business_closures to authenticated;
revoke all on public.business_closures from anon;

-- --- public: when, never why -------------------------------------------------

-- The salon page tells customers "closed 24-26 December" before they try to
-- book. Only the interval leaves; the reason stays internal. Active
-- businesses only, the next 120 days, at most 20 rows.
create or replace function public.upcoming_business_closures(p_business_id uuid)
returns table (starts_at timestamptz, ends_at timestamptz, location_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select bc.starts_at, bc.ends_at, bc.location_id
  from public.business_closures bc
  join public.businesses b on b.id = bc.business_id and b.status = 'active'
  where bc.business_id = p_business_id
    and bc.ends_at > now()
    and bc.starts_at < now() + interval '120 days'
  order by bc.starts_at
  limit 20;
$$;

revoke execute on function public.upcoming_business_closures(uuid) from public;
grant execute on function public.upcoming_business_closures(uuid) to anon, authenticated;

-- --- availability ------------------------------------------------------------

-- Same body as 0007 with one more exclusion. The candidate now carries the
-- location it was generated for, so a closure of one branch does not close
-- the others; `distinct` folds the duplicate a stylist working at two
-- locations would otherwise produce. `create or replace` keeps the grants
-- set by 0010/0011.
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
      l.id as location_id,
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
      w.location_id,
      g as slot_start,
      g + v_duration as slot_end
    from windows w
    cross join lateral generate_series(w.win_start, w.win_end - v_occupied, v_step) as g
    where w.win_end - w.win_start >= v_occupied
  )
  select distinct c.slot_start, c.slot_end, c.staff_id
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
    and not exists (
      select 1
      from public.business_closures bc
      where bc.business_id = v_business.id
        and (bc.location_id is null or bc.location_id = c.location_id)
        and tstzrange(bc.starts_at, bc.ends_at, '[)')
            && tstzrange(c.slot_start, c.slot_end, '[)')
    )
  order by c.slot_start, c.staff_id;
end;
$$;

-- --- search: "open on" knows about closures too ------------------------------

-- A salon closed for the whole day is not open on it, whatever its weekly
-- hours say. The day's bounds are taken on the salon's own clock rather than
-- UTC midnight, which the previous body used.
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
  with bounds as (
    select
      (p_day::timestamp) at time zone b.timezone as day_start,
      ((p_day + 1)::timestamp) at time zone b.timezone as day_end
    from public.businesses b
    where b.id = p_business_id
  )
  select exists (
    select 1
    from public.staff_profiles sp, bounds
    where sp.business_id = p_business_id
      and sp.is_bookable
      and not exists (
        select 1
        from public.staff_time_off sto
        where sto.staff_profile_id = sp.id
          and sto.starts_at <= bounds.day_start
          and sto.ends_at >= bounds.day_end
      )
  )
  and not exists (
    select 1
    from public.business_closures bc, bounds
    where bc.business_id = p_business_id
      and bc.location_id is null
      and bc.starts_at <= bounds.day_start
      and bc.ends_at >= bounds.day_end
  );
$$;
