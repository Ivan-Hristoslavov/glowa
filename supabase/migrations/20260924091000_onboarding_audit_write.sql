-- ---------------------------------------------------------------------------
-- GLOWA · 0027 · onboarding writes its audit entry from the trigger
--
-- The second thing blocking onboarding. `create_business` is SECURITY INVOKER
-- by design - every row it writes should be governed by the caller's own RLS -
-- but it finished by inserting into `audit_logs`, and `authenticated` has
-- INSERT revoked there on purpose: a client must not be able to forge an
-- audit trail.
--
-- The tempting fixes are both wrong. Granting INSERT on `audit_logs` to
-- `authenticated` hands every client the ability to write history. Making the
-- whole RPC SECURITY DEFINER turns off RLS for every row it touches, to solve
-- a problem with one of them.
--
-- Instead the entry moves into `app.attach_business_owner`, the AFTER INSERT
-- trigger that already runs SECURITY DEFINER and already fires exactly once
-- per business. No new client-callable surface at all.
-- ---------------------------------------------------------------------------

create or replace function app.attach_business_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null then
    insert into public.business_members (business_id, profile_id, role, status)
    values (new.id, new.created_by, 'owner', 'active')
    on conflict do nothing;

    -- Written here rather than by the caller: `audit_logs` is deliberately
    -- not writable by `authenticated`, and history nobody can forge is the
    -- entire point of the table.
    insert into public.audit_logs (
      business_id, actor_profile_id, action, entity_type, entity_id
    )
    values (new.id, new.created_by, 'business.created', 'business', new.id::text);
  end if;

  return new;
end;
$$;

create or replace function public.create_business(
  p_name text,
  p_category public.business_category,
  p_city text,
  p_address text default null,
  p_phone text default null,
  p_timezone text default 'Europe/Sofia',
  p_currency text default 'EUR',
  p_locale text default 'bg'
)
returns public.businesses
language plpgsql
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

  -- The audit entry is written by `app.attach_business_owner`.

  return v_business;
end;
$$;

revoke execute on function public.create_business(
  text, public.business_category, text, text, text, text, text, text
) from public, anon;
grant execute on function public.create_business(
  text, public.business_category, text, text, text, text, text, text
) to authenticated;
