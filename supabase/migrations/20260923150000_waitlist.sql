-- ---------------------------------------------------------------------------
-- GLOWA · 0024 · the waitlist
--
-- A cancelled slot is the most valuable thing a salon has: it is revenue that
-- already existed and is about to evaporate. Today it evaporates silently.
--
-- This turns it into an offer. Someone who wanted that day says so, and when a
-- slot opens they are told - first come, first served, one message, no
-- auto-booking. Auto-booking somebody into a time they did not confirm would
-- be worse than losing the slot.
-- ---------------------------------------------------------------------------

create table public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  -- Null means "any": any service, any stylist. The narrower the entry, the
  -- fewer openings match it, which is the customer's own trade-off to make.
  service_id uuid references public.services (id) on delete cascade,
  staff_profile_id uuid references public.staff_profiles (id) on delete set null,
  -- The window the customer is actually willing to come in.
  from_date date not null,
  to_date date not null,
  -- Minutes from local midnight; null means the whole working day.
  earliest_minutes smallint check (earliest_minutes between 0 and 1440),
  latest_minutes smallint check (latest_minutes between 0 and 1440),
  status text not null default 'waiting'
    check (status in ('waiting', 'offered', 'booked', 'expired', 'cancelled')),
  offered_at timestamptz,
  offer_count smallint not null default 0 check (offer_count >= 0),
  note text check (length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint waitlist_valid_range check (to_date >= from_date),
  constraint waitlist_valid_time_range check (
    earliest_minutes is null
    or latest_minutes is null
    or latest_minutes > earliest_minutes
  )
);

-- One live entry per person per business: a waitlist is not a queue you can
-- stuff. Re-joining after being served or cancelling is fine.
create unique index waitlist_one_active_per_person_idx
  on public.waitlist_entries (business_id, profile_id)
  where status in ('waiting', 'offered');

create index waitlist_business_idx
  on public.waitlist_entries (business_id, from_date)
  where status = 'waiting';
create index waitlist_profile_idx on public.waitlist_entries (profile_id);

create trigger waitlist_entries_updated_at
  before update on public.waitlist_entries
  for each row execute function app.set_updated_at();

alter table public.waitlist_entries enable row level security;

-- The customer owns their entry; the salon can see and clear its own list.
create policy "waitlist_own_read" on public.waitlist_entries
  for select to authenticated
  using ((select auth.uid()) = profile_id or app.is_business_member(business_id));

create policy "waitlist_own_insert" on public.waitlist_entries
  for insert to authenticated
  with check ((select auth.uid()) = profile_id);

create policy "waitlist_own_update" on public.waitlist_entries
  for update to authenticated
  using ((select auth.uid()) = profile_id or app.is_business_manager(business_id))
  with check ((select auth.uid()) = profile_id or app.is_business_manager(business_id));

create policy "waitlist_own_delete" on public.waitlist_entries
  for delete to authenticated
  using ((select auth.uid()) = profile_id or app.is_business_manager(business_id));

grant select, insert, update, delete on public.waitlist_entries to authenticated;
revoke all on public.waitlist_entries from anon;

-- A customer must not be able to mint an "offered" entry or inflate the
-- counter; those are the system's to set.
create or replace function app.guard_waitlist_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.trusted_write', true), 'off') = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'waiting';
    new.offered_at := null;
    new.offer_count := 0;
    -- A window in the past would never match anything.
    if new.from_date < current_date then
      new.from_date := current_date;
    end if;
    return new;
  end if;

  -- A member may mark an entry booked or expired; the customer may only leave.
  if not app.is_business_manager(new.business_id) then
    new.status := case when new.status = 'cancelled' then 'cancelled' else old.status end;
    new.offered_at := old.offered_at;
    new.offer_count := old.offer_count;
    new.business_id := old.business_id;
    new.profile_id := old.profile_id;
  end if;

  return new;
end;
$$;

create trigger waitlist_entries_guard
  before insert or update on public.waitlist_entries
  for each row execute function app.guard_waitlist_entry();

-- ---------------------------------------------------------------------------
-- The offer
--
-- Fires when an appointment leaves the active statuses, which is exactly the
-- moment a slot opens. It notifies rather than books: the customer still has
-- to choose, and the first one to do so gets it.
-- ---------------------------------------------------------------------------
create or replace function app.offer_freed_slot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date;
  v_minutes integer;
  v_timezone text;
  v_locale text;
  v_row record;
  v_offered integer := 0;
begin
  if old.status not in ('pending', 'confirmed')
     or new.status in ('pending', 'confirmed')
     or old.is_demo
  then
    return new;
  end if;

  -- Only a slot in the future is worth offering.
  if old.starts_at <= now() then
    return new;
  end if;

  select b.timezone into v_timezone
  from public.businesses b where b.id = old.business_id;

  v_day := (old.starts_at at time zone v_timezone)::date;
  v_minutes := extract(hour from (old.starts_at at time zone v_timezone)) * 60
             + extract(minute from (old.starts_at at time zone v_timezone));

  -- Oldest entry first: waiting longer should count for something. Capped at
  -- three so one cancellation does not spam a list of two hundred people into
  -- a race for a single slot.
  for v_row in
    select w.id, w.profile_id, w.business_id
    from public.waitlist_entries w
    where w.business_id = old.business_id
      and w.status = 'waiting'
      and v_day between w.from_date and w.to_date
      and (w.service_id is null or w.service_id = old.service_id)
      and (w.staff_profile_id is null or w.staff_profile_id = old.staff_profile_id)
      and (w.earliest_minutes is null or v_minutes >= w.earliest_minutes)
      and (w.latest_minutes is null or v_minutes <= w.latest_minutes)
    order by w.created_at
    limit 3
  loop
    v_locale := app.appointment_locale(v_row.profile_id, v_row.business_id);

    -- Keyed on the freed appointment and the entry, so the same opening is
    -- never offered to the same person twice.
    perform app.enqueue_notification(
      v_row.business_id, old.id, v_row.profile_id, 'waitlist_offer', v_locale,
      'waitlist:' || old.id::text || ':' || v_row.id::text, now()
    );

    update public.waitlist_entries
    set status = 'offered', offered_at = now(), offer_count = offer_count + 1
    where id = v_row.id;

    v_offered := v_offered + 1;
  end loop;

  return new;
end;
$$;

create trigger appointments_offer_waitlist
  after update of status on public.appointments
  for each row execute function app.offer_freed_slot();

-- ---------------------------------------------------------------------------
-- Housekeeping
--
-- An entry whose window has passed is not waiting for anything, and an offer
-- nobody acted on should return to waiting rather than block the list.
-- ---------------------------------------------------------------------------
create or replace function public.sweep_waitlist()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_touched integer := 0;
begin
  perform set_config('app.trusted_write', 'on', true);

  update public.waitlist_entries
  set status = 'expired'
  where status in ('waiting', 'offered') and to_date < current_date;
  get diagnostics v_touched = row_count;

  -- Two days is long enough to have seen the email and decided.
  update public.waitlist_entries
  set status = 'waiting'
  where status = 'offered' and offered_at < now() - interval '2 days';

  perform set_config('app.trusted_write', 'off', true);
  return v_touched;
end;
$$;

revoke execute on function public.sweep_waitlist() from public, anon, authenticated;
grant execute on function public.sweep_waitlist() to service_role;
