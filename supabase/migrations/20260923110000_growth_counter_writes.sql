-- ---------------------------------------------------------------------------
-- GLOWA · 0020 · let the counters actually count
--
-- `growth_links_freeze_counters` refuses every write to `visit_count` and
-- `booking_count`, which is right for a manager editing a link and wrong for
-- the two places that are supposed to move them: the redirect that records a
-- scan, and the trigger that records a booking. Both were silently no-ops.
--
-- The exemption is its own setting rather than `app.trusted_write`. That flag
-- means "this statement is a migration or a trusted backfill" and also
-- disables the customer booking guard; a counter increment has no business
-- carrying that much authority, and it is set inside a transaction that is
-- still writing appointments.
-- ---------------------------------------------------------------------------

create or replace function app.freeze_growth_link_counters()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.trusted_write', true), 'off') = 'on'
    or coalesce(current_setting('app.counter_write', true), 'off') = 'on'
  then
    return new;
  end if;
  new.code := old.code;
  new.visit_count := old.visit_count;
  new.booking_count := old.booking_count;
  new.business_id := old.business_id;
  return new;
end;
$$;

create or replace function app.count_growth_link_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.growth_link_id is not null and not new.is_demo then
    -- Local to this statement: `set_config(..., true)` is transaction-scoped
    -- and reset when it ends, so nothing leaks into a later write.
    perform set_config('app.counter_write', 'on', true);
    update public.growth_links
    set booking_count = booking_count + 1
    where id = new.growth_link_id;
    perform set_config('app.counter_write', 'off', true);
  end if;
  return new;
end;
$$;

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
  select gl.id as id, gl.target as target, gl.service_id as service_id,
         b.slug as slug, b.status as status
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

  perform set_config('app.counter_write', 'on', true);
  update public.growth_links
  set visit_count = visit_count + 1
  where id = v_row.id;
  perform set_config('app.counter_write', 'off', true);

  link_id := v_row.id;
  business_slug := v_row.slug;
  target := v_row.target;
  service_id := v_row.service_id;
  return next;
end;
$$;

revoke execute on function public.resolve_growth_link(text) from public;
grant execute on function public.resolve_growth_link(text) to anon, authenticated;
