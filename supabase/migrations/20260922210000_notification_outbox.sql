-- ---------------------------------------------------------------------------
-- GLOWA · 0016 · the notification outbox
--
-- Every transactional message GLOWA sends is a row here before it is a send.
-- That buys three things the application layer cannot give us on its own:
--
--   1. Idempotency. `idempotency_key` is unique, so the same event enqueued
--      twice is one row. The key is also handed to the provider, which closes
--      the remaining window between "we called the API" and "we recorded it".
--   2. Transactionality. The rows are written by a trigger inside the booking
--      transaction, so a booking that commits always has its confirmation
--      queued, and a booking that rolls back never does.
--   3. A real queue. Reminders are just rows with `scheduled_for` in the
--      future; cancelling one is an UPDATE, not a job-runner API call.
--
-- No message body is stored. The worker renders from the appointment at send
-- time, so a name change or a reschedule cannot be contradicted by a stale
-- snapshot, and the outbox stays free of duplicated personal data.
-- ---------------------------------------------------------------------------

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  channel public.notification_channel not null default 'email',
  event_type public.notification_event not null,
  locale text not null default 'bg' check (locale in ('bg', 'en', 'ro')),
  -- Stable per (event, subject, occurrence). A reschedule mints a new key so
  -- the new reminder is a new row; a retry of the same send reuses it.
  idempotency_key text not null unique,
  status text not null default 'queued'
    check (status in ('queued', 'sending', 'sent', 'failed', 'skipped')),
  attempts smallint not null default 0 check (attempts >= 0),
  scheduled_for timestamptz not null default now(),
  last_attempt_at timestamptz,
  sent_at timestamptz,
  provider text,
  provider_message_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The worker's only query: due rows, oldest first.
create index notification_deliveries_due_idx
  on public.notification_deliveries (scheduled_for)
  where status in ('queued', 'sending');

create index notification_deliveries_business_idx
  on public.notification_deliveries (business_id, created_at desc);

create index notification_deliveries_appointment_idx
  on public.notification_deliveries (appointment_id);

create trigger notification_deliveries_updated_at
  before update on public.notification_deliveries
  for each row execute function app.set_updated_at();

alter table public.notification_deliveries enable row level security;

-- Staff can see what was sent on their business's behalf. Nobody but the
-- service role writes: the rows are produced by triggers and consumed by the
-- worker, never by a browser.
create policy "notification_deliveries_member_read" on public.notification_deliveries
  for select to authenticated
  using (app.is_business_member(business_id));

grant select on public.notification_deliveries to authenticated;
revoke insert, update, delete on public.notification_deliveries from authenticated;
revoke all on public.notification_deliveries from anon;

-- ---------------------------------------------------------------------------
-- Opt-out
--
-- Absence of a row means "yes". A business-specific row wins over the
-- account-wide one, so muting a single salon does not mute the rest.
-- ---------------------------------------------------------------------------
create or replace function app.notifications_enabled(
  p_profile_id uuid,
  p_business_id uuid,
  p_channel public.notification_channel,
  p_event public.notification_event
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select np.enabled
      from public.notification_preferences np
      where np.profile_id = p_profile_id
        and np.channel = p_channel
        and np.event_type = p_event
        and (np.business_id = p_business_id or np.business_id is null)
      order by np.business_id nulls last
      limit 1
    ),
    true
  );
$$;

revoke execute on function app.notifications_enabled(
  uuid, uuid, public.notification_channel, public.notification_event
) from public, anon;

-- ---------------------------------------------------------------------------
-- Enqueueing
-- ---------------------------------------------------------------------------
create or replace function app.enqueue_notification(
  p_business_id uuid,
  p_appointment_id uuid,
  p_profile_id uuid,
  p_event public.notification_event,
  p_locale text,
  p_key text,
  p_scheduled_for timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.notifications_enabled(p_profile_id, p_business_id, 'email', p_event) then
    return;
  end if;

  insert into public.notification_deliveries (
    business_id, appointment_id, profile_id, channel, event_type,
    locale, idempotency_key, scheduled_for
  )
  values (
    p_business_id, p_appointment_id, p_profile_id, 'email', p_event,
    p_locale, p_key, greatest(p_scheduled_for, now())
  )
  on conflict (idempotency_key) do nothing;
end;
$$;

revoke execute on function app.enqueue_notification(
  uuid, uuid, uuid, public.notification_event, text, text, timestamptz
) from public, anon;

-- The customer's preferred locale, falling back to the business's own.
create or replace function app.appointment_locale(
  p_profile_id uuid,
  p_business_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select cp.preferred_locale from public.customer_preferences cp
      where cp.profile_id = p_profile_id),
    (select p.locale from public.profiles p where p.id = p_profile_id),
    (select b.default_locale from public.businesses b where b.id = p_business_id),
    'bg'
  );
$$;

revoke execute on function app.appointment_locale(uuid, uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- The trigger
--
-- Lives on `appointments` rather than in the booking RPC so that every path
-- that creates or changes an appointment - customer web, the admin calendar, a
-- walk-in, a future import - produces the same messages without remembering to.
-- ---------------------------------------------------------------------------
create or replace function app.appointment_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locale text;
  v_lead integer;
  v_reminder_at timestamptz;
begin
  -- Demo data and bulk imports are records, not conversations.
  if new.is_demo or new.source = 'import' then
    return new;
  end if;

  -- Somebody has to be reachable. A walk-in with only a name is not.
  if new.customer_profile_id is null and new.customer_email is null then
    return new;
  end if;

  v_locale := app.appointment_locale(new.customer_profile_id, new.business_id);

  v_lead := coalesce(
    (select cp.reminder_lead_minutes from public.customer_preferences cp
      where cp.profile_id = new.customer_profile_id),
    1440
  );
  v_reminder_at := new.starts_at - make_interval(mins => v_lead);

  if tg_op = 'INSERT' then
    if new.status in ('pending', 'confirmed') then
      perform app.enqueue_notification(
        new.business_id, new.id, new.customer_profile_id, 'booking_confirmation',
        v_locale, 'booking_confirmation:' || new.id::text, now()
      );

      -- A reminder for an appointment that already started is noise.
      if new.starts_at > now() then
        perform app.enqueue_notification(
          new.business_id, new.id, new.customer_profile_id, 'reminder', v_locale,
          'reminder:' || new.id::text || ':'
            || extract(epoch from new.starts_at)::bigint::text,
          v_reminder_at
        );
      end if;
    end if;
    return new;
  end if;

  -- A reminder for a time that is no longer the appointment must not go out.
  -- Leaving the active statuses kills every pending reminder; moving the time
  -- kills the ones for the old time, which is every key but the new one.
  if new.status is distinct from old.status
    and new.status not in ('pending', 'confirmed')
  then
    update public.notification_deliveries
    set status = 'skipped', error = 'superseded'
    where appointment_id = new.id
      and event_type = 'reminder'
      and status = 'queued';
  elsif new.starts_at is distinct from old.starts_at then
    update public.notification_deliveries
    set status = 'skipped', error = 'superseded'
    where appointment_id = new.id
      and event_type = 'reminder'
      and status = 'queued'
      and idempotency_key <> 'reminder:' || new.id::text || ':'
        || extract(epoch from new.starts_at)::bigint::text;
  end if;

  if new.status is distinct from old.status and new.status = 'cancelled' then
    perform app.enqueue_notification(
      new.business_id, new.id, new.customer_profile_id, 'cancellation',
      v_locale, 'cancellation:' || new.id::text, now()
    );
    return new;
  end if;

  -- Three hours is long enough that the client has left and short enough that
  -- the visit is still fresh.
  if new.status is distinct from old.status and new.status = 'completed' then
    perform app.enqueue_notification(
      new.business_id, new.id, new.customer_profile_id, 'review_request',
      v_locale, 'review_request:' || new.id::text,
      coalesce(new.completed_at, now()) + interval '3 hours'
    );
    return new;
  end if;

  if new.starts_at is distinct from old.starts_at
    and new.status in ('pending', 'confirmed')
  then
    perform app.enqueue_notification(
      new.business_id, new.id, new.customer_profile_id, 'reschedule', v_locale,
      'reschedule:' || new.id::text || ':'
        || extract(epoch from new.starts_at)::bigint::text,
      now()
    );

    if new.starts_at > now() then
      perform app.enqueue_notification(
        new.business_id, new.id, new.customer_profile_id, 'reminder', v_locale,
        'reminder:' || new.id::text || ':'
          || extract(epoch from new.starts_at)::bigint::text,
        v_reminder_at
      );
    end if;
  end if;

  return new;
end;
$$;

create trigger appointments_notifications
  after insert or update of status, starts_at on public.appointments
  for each row execute function app.appointment_notifications();

-- ---------------------------------------------------------------------------
-- The worker's claim
--
-- `for update skip locked` is what makes two concurrent workers safe: each one
-- takes rows the other is not holding. Claiming flips the row to `sending`
-- before the provider call, so a crash leaves evidence rather than a silent
-- second send; rows stuck in `sending` are reclaimed after 15 minutes, and a
-- row that has failed five times is left alone for a human.
-- ---------------------------------------------------------------------------
create or replace function public.claim_notification_deliveries(
  p_limit integer default 25
)
returns setof public.notification_deliveries
language sql
volatile
security definer
set search_path = ''
as $$
  update public.notification_deliveries d
  set status = 'sending',
      attempts = d.attempts + 1,
      last_attempt_at = now()
  where d.id in (
    select c.id
    from public.notification_deliveries c
    where c.attempts < 5
      and (
        (c.status = 'queued' and c.scheduled_for <= now())
        or (c.status = 'sending'
            and c.last_attempt_at < now() - interval '15 minutes')
      )
    order by c.scheduled_for
    for update skip locked
    limit least(greatest(p_limit, 1), 100)
  )
  returning d.*;
$$;

revoke execute on function public.claim_notification_deliveries(integer)
  from public, anon, authenticated;
grant execute on function public.claim_notification_deliveries(integer) to service_role;
