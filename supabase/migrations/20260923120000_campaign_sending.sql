-- ---------------------------------------------------------------------------
-- GLOWA · 0021 · campaigns actually send
--
-- `marketing_messages` was designed in Prompt 1 as a per-recipient outbox with
-- its own `idempotency_key`, before `notification_deliveries` existed. Keeping
-- both would mean two queues, two status machines and two workers for the same
-- job: put a message in front of a person and record what happened.
--
-- It is empty and has never been written to, so it is dropped rather than left
-- as a second way to do the same thing. The outbox gains the two columns a
-- campaign send needs, and everything else - the unique key, the claim, the
-- retry policy, the provider idempotency header - is already there.
--
-- Marketing is different from a booking confirmation in exactly one way that
-- matters legally: it needs a way out. Every client gets an unsubscribe token
-- and every campaign message carries the link.
-- ---------------------------------------------------------------------------

drop table if exists public.marketing_messages;

alter table public.notification_deliveries
  add column campaign_id uuid references public.marketing_campaigns (id) on delete cascade,
  add column business_client_id uuid references public.business_clients (id) on delete set null;

create index notification_deliveries_campaign_idx
  on public.notification_deliveries (campaign_id) where campaign_id is not null;

-- A delivery is about an appointment or about a campaign, never both and never
-- neither: without one of them the worker has nothing to render.
alter table public.notification_deliveries
  add constraint notification_deliveries_subject
  check (
    (appointment_id is not null and campaign_id is null)
    or (campaign_id is not null and appointment_id is null)
  );

-- --- unsubscribe -----------------------------------------------------------

-- Opaque and per-client, so the link in an email cannot be edited into
-- somebody else's unsubscribe. Not derived from the email address, which would
-- make it guessable.
alter table public.business_clients
  add column unsubscribe_token uuid not null default gen_random_uuid();

create unique index business_clients_unsubscribe_token_idx
  on public.business_clients (unsubscribe_token);

-- Signed out by definition: the whole point is that it works from an email
-- client, with one click, without an account.
create or replace function public.unsubscribe_marketing(p_token uuid)
returns table (business_name text, already_unsubscribed boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row record;
begin
  select bc.id, bc.consent_marketing, b.name
  into v_row
  from public.business_clients bc
  join public.businesses b on b.id = bc.business_id
  where bc.unsubscribe_token = p_token;

  if not found then
    return;
  end if;

  already_unsubscribed := not v_row.consent_marketing;

  if v_row.consent_marketing then
    perform set_config('app.trusted_write', 'on', true);
    update public.business_clients
    set consent_marketing = false, consent_updated_at = now()
    where id = v_row.id;
    perform set_config('app.trusted_write', 'off', true);

    -- Anything already queued for this person stops here. An unsubscribe that
    -- only takes effect next time is not an unsubscribe.
    update public.notification_deliveries
    set status = 'skipped', error = 'unsubscribed'
    where business_client_id = v_row.id
      and event_type = 'marketing'
      and status = 'queued';
  end if;

  business_name := v_row.name;
  return next;
end;
$$;

revoke execute on function public.unsubscribe_marketing(uuid) from public;
grant execute on function public.unsubscribe_marketing(uuid) to anon, authenticated;

-- --- queueing a campaign ---------------------------------------------------

-- SECURITY DEFINER because `authenticated` has no INSERT on the outbox at all
-- - rows there are produced by triggers and by this function, never by a
-- browser. The membership check is therefore this function's own job.
create or replace function public.queue_campaign(p_campaign_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_campaign public.marketing_campaigns%rowtype;
  v_default_locale text;
  v_queued integer := 0;
begin
  select * into v_campaign
  from public.marketing_campaigns
  where id = p_campaign_id;

  if not found then
    raise exception 'Campaign not found' using errcode = 'check_violation';
  end if;

  if not app.is_business_manager(v_campaign.business_id) then
    raise exception 'Manager rights are required'
      using errcode = 'insufficient_privilege';
  end if;

  if v_campaign.status not in ('draft', 'scheduled') then
    raise exception 'This campaign has already been sent'
      using errcode = 'check_violation', hint = 'already_sent';
  end if;

  -- A campaign with nothing to say must not go out. The subject is localized;
  -- at least one language has to be filled in, and so does the body.
  if coalesce(jsonb_typeof(v_campaign.template -> 'subject'), 'null') <> 'object'
    or v_campaign.template -> 'subject' = '{}'::jsonb
    or coalesce(jsonb_typeof(v_campaign.template -> 'body'), 'null') <> 'object'
    or v_campaign.template -> 'body' = '{}'::jsonb
  then
    raise exception 'The campaign has no subject or body'
      using errcode = 'check_violation', hint = 'empty_template';
  end if;

  select b.default_locale into v_default_locale
  from public.businesses b where b.id = v_campaign.business_id;

  -- One row per consenting, reachable client. The unique key is what makes
  -- pressing send twice harmless: the second attempt conflicts and does
  -- nothing rather than mailing everyone again.
  insert into public.notification_deliveries (
    business_id, campaign_id, business_client_id, profile_id,
    channel, event_type, locale, idempotency_key, scheduled_for
  )
  select
    v_campaign.business_id,
    v_campaign.id,
    bc.id,
    bc.profile_id,
    'email',
    'marketing',
    coalesce(
      (select cp.preferred_locale from public.customer_preferences cp
        where cp.profile_id = bc.profile_id),
      (select p.locale from public.profiles p where p.id = bc.profile_id),
      v_default_locale,
      'bg'
    ),
    'campaign:' || v_campaign.id::text || ':' || bc.id::text,
    coalesce(v_campaign.scheduled_at, now())
  from public.business_clients bc
  where bc.business_id = v_campaign.business_id
    and bc.consent_marketing
    and bc.email is not null
    and not bc.is_demo
    and (
      (v_campaign.audience ->> 'last_visit_before_days') is null
      or bc.last_visit_at is null
      or bc.last_visit_at < now()
        - make_interval(days => (v_campaign.audience ->> 'last_visit_before_days')::integer)
    )
    and (
      (v_campaign.audience ->> 'min_visits') is null
      or bc.total_visits >= (v_campaign.audience ->> 'min_visits')::integer
    )
    and (
      (v_campaign.audience -> 'tags') is null
      or jsonb_array_length(v_campaign.audience -> 'tags') = 0
      or bc.tags && (
        select array_agg(value::text)
        from jsonb_array_elements_text(v_campaign.audience -> 'tags')
      )
    )
    -- Marketing respects a per-business opt-out too, not only the consent flag.
    and app.notifications_enabled(bc.profile_id, v_campaign.business_id, 'email', 'marketing')
  on conflict (idempotency_key) do nothing;

  get diagnostics v_queued = row_count;

  update public.marketing_campaigns
  set status = 'sending', sent_at = coalesce(sent_at, now())
  where id = v_campaign.id;

  return v_queued;
end;
$$;

revoke execute on function public.queue_campaign(uuid) from public, anon;
grant execute on function public.queue_campaign(uuid) to authenticated;

-- --- completion ------------------------------------------------------------

-- Called by the worker once a campaign's deliveries stop moving. Storing
-- 'sent' the moment the rows are queued would be a lie; this flips it when it
-- is actually true.
create or replace function public.finalize_campaign(p_campaign_id uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.marketing_campaigns c
  set status = 'sent'
  where c.id = p_campaign_id
    and c.status = 'sending'
    and not exists (
      select 1 from public.notification_deliveries d
      where d.campaign_id = c.id and d.status in ('queued', 'sending')
    );
$$;

revoke execute on function public.finalize_campaign(uuid) from public, anon, authenticated;
grant execute on function public.finalize_campaign(uuid) to service_role;

-- --- localized bodies ------------------------------------------------------

-- The subject was already stored per language while the body was one string,
-- which would mail a Bulgarian paragraph to a Romanian client under a Romanian
-- subject line. The body is now localized the same way.
alter table public.marketing_campaigns
  add constraint marketing_campaigns_body_localized
  check (app.is_localized_text(template -> 'body'));
