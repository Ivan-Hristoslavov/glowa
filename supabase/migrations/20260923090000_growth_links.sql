-- ---------------------------------------------------------------------------
-- GLOWA · 0018 · growth links (QR in the salon, referrals from clients)
--
-- One short code, one destination, one honest counter. A salon prints a QR for
-- the window or the back of a card; a happy client shares their own link. Both
-- are the same object with a different `kind`, because the only real
-- difference is who the credit belongs to.
--
-- What is deliberately *not* here: no IP address, no user agent, no visitor
-- identifier, no cookie written by the database. A visit is a number going up.
-- That is enough to tell a salon which chair's QR works, and it is the most a
-- booking platform should know about someone who only walked past a poster.
-- ---------------------------------------------------------------------------

create table public.growth_links (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  -- Short, unambiguous, and typed by hand off a printed card when the camera
  -- fails: the generator omits l/o/0/1.
  code text not null unique check (code ~ '^[a-z0-9]{6,16}$'),
  kind text not null default 'qr' check (kind in ('qr', 'referral', 'campaign')),
  label text not null check (length(btrim(label)) between 1 and 80),
  target text not null default 'book' check (target in ('business', 'book')),
  service_id uuid references public.services (id) on delete set null,
  -- Whose referral this is. A profile for a GLOWA account, a business client
  -- for someone the salon knows but who has no account.
  referrer_profile_id uuid references public.profiles (id) on delete set null,
  referrer_client_id uuid references public.business_clients (id) on delete set null,
  is_active boolean not null default true,
  visit_count integer not null default 0 check (visit_count >= 0),
  booking_count integer not null default 0 check (booking_count >= 0),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint growth_links_referrer_is_one_kind
    check (referrer_profile_id is null or referrer_client_id is null)
);

create index growth_links_business_idx
  on public.growth_links (business_id, created_at desc);
create index growth_links_service_idx on public.growth_links (service_id);
create index growth_links_referrer_profile_idx
  on public.growth_links (referrer_profile_id) where referrer_profile_id is not null;
create index growth_links_referrer_client_idx
  on public.growth_links (referrer_client_id) where referrer_client_id is not null;

create trigger growth_links_updated_at
  before update on public.growth_links
  for each row execute function app.set_updated_at();

-- --- code generation -------------------------------------------------------

create or replace function app.generate_link_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  -- No l, o, 0 or 1: a code gets read aloud and typed in.
  v_alphabet text := 'abcdefghijkmnpqrstuvwxyz23456789';
  v_code text;
  v_i integer;
  v_try integer := 0;
begin
  loop
    v_code := '';
    for v_i in 1..8 loop
      v_code := v_code
        || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (
      select 1 from public.growth_links gl where gl.code = v_code
    );
    v_try := v_try + 1;
    if v_try > 20 then
      raise exception 'Could not allocate a link code' using errcode = 'check_violation';
    end if;
  end loop;
  return v_code;
end;
$$;

revoke execute on function app.generate_link_code() from public, anon;

-- The code is assigned here rather than by the caller, so a manager cannot
-- squat on a short or misleading one, and the client never has to retry a
-- collision.
create or replace function app.set_growth_link_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.code := app.generate_link_code();
  new.visit_count := 0;
  new.booking_count := 0;
  return new;
end;
$$;

create trigger growth_links_assign_code
  before insert on public.growth_links
  for each row execute function app.set_growth_link_code();

-- The counters are facts about what happened; nobody edits them by hand.
create or replace function app.freeze_growth_link_counters()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.trusted_write', true), 'off') = 'on' then
    return new;
  end if;
  new.code := old.code;
  new.visit_count := old.visit_count;
  new.booking_count := old.booking_count;
  new.business_id := old.business_id;
  return new;
end;
$$;

create trigger growth_links_freeze_counters
  before update on public.growth_links
  for each row execute function app.freeze_growth_link_counters();

-- --- RLS -------------------------------------------------------------------

alter table public.growth_links enable row level security;

create policy "growth_links_member_read" on public.growth_links
  for select to authenticated
  using (app.is_business_member(business_id));

create policy "growth_links_insert_manager" on public.growth_links
  for insert to authenticated
  with check (app.is_business_manager(business_id));

create policy "growth_links_update_manager" on public.growth_links
  for update to authenticated
  using (app.is_business_manager(business_id))
  with check (app.is_business_manager(business_id));

create policy "growth_links_delete_manager" on public.growth_links
  for delete to authenticated
  using (app.is_business_manager(business_id));

grant select, insert, update, delete on public.growth_links to authenticated;
revoke all on public.growth_links from anon;

-- --- attribution -----------------------------------------------------------

alter table public.appointments
  add column growth_link_id uuid references public.growth_links (id) on delete set null;

create index appointments_growth_link_idx
  on public.appointments (growth_link_id) where growth_link_id is not null;

create or replace function app.count_growth_link_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.growth_link_id is not null and not new.is_demo then
    update public.growth_links
    set booking_count = booking_count + 1
    where id = new.growth_link_id;
  end if;
  return new;
end;
$$;

create trigger appointments_count_growth_link
  after insert on public.appointments
  for each row execute function app.count_growth_link_booking();

-- --- the redirect ----------------------------------------------------------

-- Signed out is the normal case here: someone scans a poster. SECURITY
-- DEFINER because `anon` has no read on growth_links at all - the only thing
-- it can learn is where this one code points, which is the entire purpose.
create or replace function public.resolve_growth_link(p_code text)
returns table (
  link_id uuid,
  business_slug text,
  target text,
  service_id uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row record;
begin
  select gl.id, gl.target, gl.service_id, b.slug, b.status
  into v_row
  from public.growth_links gl
  join public.businesses b on b.id = gl.business_id
  where gl.code = lower(btrim(p_code))
    and gl.is_active;

  -- A draft or suspended business must not be reachable through a link that
  -- was printed while it was live.
  if not found or v_row.status <> 'active' then
    return;
  end if;

  update public.growth_links
  set visit_count = visit_count + 1
  where id = v_row.id;

  link_id := v_row.id;
  business_slug := v_row.slug;
  target := v_row.target;
  service_id := v_row.service_id;
  return next;
end;
$$;

revoke execute on function public.resolve_growth_link(text) from public;
grant execute on function public.resolve_growth_link(text) to anon, authenticated;

-- --- booking with attribution ----------------------------------------------

-- The guard has to learn about the new column: a hostile direct insert must
-- not be able to credit another business's link, or an inactive one.
create or replace function app.enforce_customer_booking_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_service public.services%rowtype;
  v_is_staff boolean;
  v_window_hours integer;
  v_uid uuid := (select auth.uid());
begin
  if coalesce(current_setting('app.trusted_write', true), 'off') = 'on' then
    return new;
  end if;

  v_is_staff := new.business_id is not null and app.is_business_member(new.business_id);

  if tg_op = 'INSERT' then
    -- Whoever is inserting, the credited link must belong to this business
    -- and still be active.
    if new.growth_link_id is not null and not exists (
      select 1 from public.growth_links gl
      where gl.id = new.growth_link_id
        and gl.is_active
        and gl.business_id = coalesce(
          new.business_id,
          (select s.business_id from public.services s where s.id = new.service_id)
        )
    ) then
      new.growth_link_id := null;
    end if;

    if v_is_staff then
      return new;
    end if;

    if new.service_id is null then
      raise exception 'A service is required when booking as a customer'
        using errcode = 'check_violation';
    end if;

    select * into v_service from public.services s where s.id = new.service_id;

    if not found or not v_service.is_active then
      raise exception 'Service is not bookable' using errcode = 'check_violation';
    end if;

    if not app.is_business_public(v_service.business_id) then
      raise exception 'Business is not accepting bookings' using errcode = 'check_violation';
    end if;

    new.business_id := v_service.business_id;
    new.customer_profile_id := v_uid;
    new.price_cents := v_service.price_cents;
    new.currency := v_service.currency;
    new.ends_at := new.starts_at + make_interval(mins => v_service.duration_minutes);
    new.service_name_snapshot := v_service.name;
    new.status := 'pending';
    new.source := 'customer_web';
    new.internal_notes := null;
    new.is_demo := false;
    new.created_by := v_uid;

    select p.full_name into new.customer_name from public.profiles p where p.id = v_uid;
    select u.email into new.customer_email from auth.users u where u.id = v_uid;

    return new;
  end if;

  if v_is_staff then
    return new;
  end if;

  if new.status <> 'cancelled' or old.status not in ('pending', 'confirmed') then
    raise exception 'Customers may only cancel a pending or confirmed appointment'
      using errcode = 'insufficient_privilege';
  end if;

  select coalesce((b.booking_policy ->> 'cancellation_window_hours')::integer, 24)
  into v_window_hours
  from public.businesses b where b.id = old.business_id;

  if old.starts_at - make_interval(hours => coalesce(v_window_hours, 24)) < now() then
    raise exception 'Too late to cancel online; please contact the business'
      using errcode = 'check_violation';
  end if;

  new.business_id := old.business_id;
  new.service_id := old.service_id;
  new.staff_profile_id := old.staff_profile_id;
  new.customer_profile_id := old.customer_profile_id;
  new.price_cents := old.price_cents;
  new.currency := old.currency;
  new.starts_at := old.starts_at;
  new.ends_at := old.ends_at;
  new.internal_notes := old.internal_notes;
  new.is_demo := old.is_demo;
  new.growth_link_id := old.growth_link_id;
  new.cancelled_at := now();
  return new;
end;
$$;

-- `book_appointment` gains the code. Resolving it here rather than trusting an
-- id from the browser is what keeps the credit inside the right business.
create or replace function public.book_appointment(
  p_service_id uuid,
  p_starts_at timestamptz,
  p_staff_profile_id uuid,
  p_location_id uuid default null,
  p_customer_notes text default null,
  p_growth_code text default null
)
returns public.appointments
language plpgsql
set search_path = ''
as $$
declare
  v_timezone text;
  v_local_day date;
  v_service public.services%rowtype;
  v_me record;
  v_link_id uuid;
  v_row public.appointments%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to book' using errcode = 'insufficient_privilege';
  end if;

  select s.* into v_service
  from public.services s
  join public.businesses b on b.id = s.business_id
  where s.id = p_service_id and s.is_active and b.status = 'active';

  if not found then
    raise exception 'Service is not bookable' using errcode = 'check_violation';
  end if;

  select b.timezone into v_timezone
  from public.businesses b where b.id = v_service.business_id;

  v_local_day := (p_starts_at at time zone v_timezone)::date;

  if not exists (
    select 1
    from public.get_available_slots(
      p_service_id, v_local_day, v_local_day, p_staff_profile_id, p_location_id
    ) slot
    where slot.starts_at = p_starts_at
  ) then
    raise exception 'That time is no longer available'
      using errcode = 'check_violation', hint = 'slot_unavailable';
  end if;

  select * into v_me from app.current_identity();

  if p_growth_code is not null then
    select gl.id into v_link_id
    from public.growth_links gl
    where gl.code = lower(btrim(p_growth_code))
      and gl.is_active
      and gl.business_id = v_service.business_id;
  end if;

  begin
    insert into public.appointments (
      business_id, location_id, service_id, staff_profile_id,
      customer_profile_id, customer_name, customer_email,
      service_name_snapshot, price_cents, currency,
      starts_at, ends_at, status, source, customer_notes, is_demo, created_by,
      growth_link_id
    )
    values (
      v_service.business_id, p_location_id, p_service_id, p_staff_profile_id,
      v_me.profile_id, v_me.full_name, v_me.email,
      v_service.name, v_service.price_cents, v_service.currency,
      p_starts_at,
      p_starts_at + make_interval(mins => v_service.duration_minutes),
      'pending', 'customer_web',
      nullif(btrim(coalesce(p_customer_notes, '')), ''),
      false, v_me.profile_id,
      v_link_id
    )
    returning * into v_row;
  exception when exclusion_violation then
    raise exception 'That time was just taken'
      using errcode = 'check_violation', hint = 'slot_taken';
  end;

  return v_row;
end;
$$;

-- The five-argument version is gone; drop it so no caller keeps the old shape.
drop function if exists public.book_appointment(uuid, timestamptz, uuid, uuid, text);

revoke execute on function public.book_appointment(
  uuid, timestamptz, uuid, uuid, text, text
) from public, anon;
grant execute on function public.book_appointment(
  uuid, timestamptz, uuid, uuid, text, text
) to authenticated;
