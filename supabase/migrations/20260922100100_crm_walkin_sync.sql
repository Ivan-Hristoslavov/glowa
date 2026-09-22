-- ---------------------------------------------------------------------------
-- GLOWA · 0014 · the CRM must pick up walk-ins too
--
-- app.sync_business_client() returned early unless the appointment carried a
-- profile, an email or a phone, so a front-desk walk-in entered by name alone
-- created no client record - the row the salon most wants to build history on.
--
-- Accept a name as an identity, and match on it when there is nothing stronger.
-- Name matching is weaker than an email, so it is the last branch, and it is
-- case-insensitive and trimmed to avoid obvious duplicates.
--
-- `business_clients_identified` carried the same assumption as the appointment
-- constraint fixed in 0013, so it is relaxed the same way.
-- ---------------------------------------------------------------------------

alter table public.business_clients
  drop constraint business_clients_identified;

alter table public.business_clients
  add constraint business_clients_identified
  check (
    profile_id is not null
    or nullif(btrim(coalesce(full_name, '')), '') is not null
    or email is not null
    or phone is not null
  );

create or replace function app.sync_business_client()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id uuid;
  v_name text;
  v_completed boolean;
begin
  v_name := nullif(btrim(coalesce(
    new.customer_name,
    (select p.full_name from public.profiles p where p.id = new.customer_profile_id)
  )), '');

  if new.customer_profile_id is null
     and new.customer_email is null
     and new.customer_phone is null
     and v_name is null then
    return new;
  end if;

  v_completed := new.status = 'completed'
    and (tg_op = 'INSERT' or old.status is distinct from 'completed');

  select bc.id into v_client_id
  from public.business_clients bc
  where bc.business_id = new.business_id
    and (
      (new.customer_profile_id is not null and bc.profile_id = new.customer_profile_id)
      or (new.customer_profile_id is null and new.customer_email is not null
          and lower(bc.email) = lower(new.customer_email))
      or (new.customer_profile_id is null and new.customer_email is null
          and new.customer_phone is not null and bc.phone = new.customer_phone)
      or (new.customer_profile_id is null and new.customer_email is null
          and new.customer_phone is null and v_name is not null
          and lower(btrim(bc.full_name)) = lower(v_name))
    )
  limit 1;

  if v_client_id is null then
    insert into public.business_clients (
      business_id, profile_id, full_name, email, phone, is_demo
    )
    values (
      new.business_id, new.customer_profile_id, v_name,
      new.customer_email, new.customer_phone, new.is_demo
    )
    returning id into v_client_id;
  else
    update public.business_clients bc
    set full_name = coalesce(bc.full_name, v_name),
        email = coalesce(bc.email, new.customer_email),
        phone = coalesce(bc.phone, new.customer_phone),
        profile_id = coalesce(bc.profile_id, new.customer_profile_id)
    where bc.id = v_client_id;
  end if;

  if v_completed then
    update public.business_clients bc
    set total_visits = bc.total_visits + 1,
        total_spend_cents = bc.total_spend_cents + new.price_cents,
        last_visit_at = greatest(coalesce(bc.last_visit_at, new.starts_at), new.starts_at),
        first_visit_at = least(coalesce(bc.first_visit_at, new.starts_at), new.starts_at)
    where bc.id = v_client_id;
  end if;

  return new;
end;
$$;

-- Also fire when the name changes, so a corrected spelling reaches the CRM.
drop trigger if exists appointments_sync_business_client on public.appointments;
create trigger appointments_sync_business_client
  after insert or update of
    status, customer_profile_id, customer_email, customer_phone, customer_name
  on public.appointments
  for each row execute function app.sync_business_client();

-- Backfill the clients that the earlier version skipped.
do $$
declare
  v_row record;
begin
  -- The customer guard refuses a bare UPDATE from a non-member, and a migration
  -- runs as the owner. This is what the trusted-write flag exists for, and it
  -- is scoped to this transaction.
  perform set_config('app.trusted_write', 'on', true);

  for v_row in
    select a.id
    from public.appointments a
    where a.customer_profile_id is null
      and a.customer_email is null
      and a.customer_phone is null
      and nullif(btrim(coalesce(a.customer_name, '')), '') is not null
      and not exists (
        select 1 from public.business_clients bc
        where bc.business_id = a.business_id
          and lower(btrim(bc.full_name)) = lower(btrim(a.customer_name))
      )
  loop
    -- Re-run the trigger by touching the column it now watches.
    update public.appointments a
    set customer_name = a.customer_name
    where a.id = v_row.id;
  end loop;

  perform set_config('app.trusted_write', 'off', true);
end;
$$;
