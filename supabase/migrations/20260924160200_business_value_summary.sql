-- ---------------------------------------------------------------------------
-- GLOWA · "what GLOWA brought you"
--
-- A salon paying a subscription while other platforms cost nothing deserves
-- to see what it got for the money, counted from its own diary and nothing
-- else. Every figure here is a count of real rows:
--
--   online      bookings the clients made themselves on the web
--   invited     bookings by a client within 30 days of a rebook invitation
--               that was actually sent to them
--   refilled    bookings by a customer within 2 days of a waitlist offer
--               that was actually sent to them
--   kept        deposits the salon kept on a no-show or a late cancellation
--
-- Cancelled and no-show bookings do not count as value; demo rows never do.
-- The windows are an attribution rule, not a claim that the message was the
-- only reason, and the dashboard says so.
--
-- SECURITY INVOKER: it reads through the caller's RLS, so a non-member gets
-- zeros rather than somebody else's numbers.
-- ---------------------------------------------------------------------------

create or replace function public.business_value_summary(
  p_business_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  currency text,
  online_bookings integer,
  online_value_cents bigint,
  invitations_sent integer,
  invited_bookings integer,
  invited_value_cents bigint,
  refilled_bookings integer,
  refilled_value_cents bigint,
  deposits_kept_cents bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with booked as (
    select
      a.id,
      a.customer_profile_id,
      lower(a.customer_email) as email,
      a.price_cents,
      a.created_at,
      a.source
    from public.appointments a
    where a.business_id = p_business_id
      and a.created_at >= p_from
      and a.created_at < p_to
      and a.status in ('pending', 'confirmed', 'completed')
      and not a.is_demo
  ),
  invitations as (
    select d.sent_at, src.customer_profile_id, lower(src.customer_email) as email
    from public.notification_deliveries d
    join public.appointments src on src.id = d.appointment_id
    where d.business_id = p_business_id
      and d.event_type = 'rebook_nudge'
      and d.status = 'sent'
      and d.sent_at >= p_from - interval '30 days'
      and d.sent_at < p_to
  ),
  offers as (
    select d.sent_at, d.profile_id
    from public.notification_deliveries d
    where d.business_id = p_business_id
      and d.event_type = 'waitlist_offer'
      and d.status = 'sent'
      and d.profile_id is not null
      and d.sent_at >= p_from - interval '2 days'
      and d.sent_at < p_to
  ),
  invited as (
    select b.price_cents
    from booked b
    where exists (
      select 1
      from invitations i
      where i.sent_at <= b.created_at
        and i.sent_at > b.created_at - interval '30 days'
        and (
          (b.customer_profile_id is not null and i.customer_profile_id = b.customer_profile_id)
          or (b.email is not null and i.email = b.email)
        )
    )
  ),
  refilled as (
    select b.price_cents
    from booked b
    where b.customer_profile_id is not null
      and exists (
        select 1
        from offers o
        where o.profile_id = b.customer_profile_id
          and o.sent_at <= b.created_at
          and o.sent_at > b.created_at - interval '2 days'
      )
  )
  select
    (select bz.currency from public.businesses bz where bz.id = p_business_id),
    (select count(*)::integer from booked where source = 'customer_web'),
    (select coalesce(sum(price_cents), 0)::bigint from booked where source = 'customer_web'),
    (
      select count(*)::integer
      from public.notification_deliveries d
      where d.business_id = p_business_id
        and d.event_type = 'rebook_nudge'
        and d.status = 'sent'
        and d.sent_at >= p_from
        and d.sent_at < p_to
    ),
    (select count(*)::integer from invited),
    (select coalesce(sum(price_cents), 0)::bigint from invited),
    (select count(*)::integer from refilled),
    (select coalesce(sum(price_cents), 0)::bigint from refilled),
    (
      select coalesce(sum(a.deposit_cents), 0)::bigint
      from public.appointments a
      where a.business_id = p_business_id
        and a.deposit_status = 'retained'
        and a.starts_at >= p_from
        and a.starts_at < p_to
        and not a.is_demo
    );
$$;

revoke execute on function public.business_value_summary(uuid, timestamptz, timestamptz)
  from public, anon;
grant execute on function public.business_value_summary(uuid, timestamptz, timestamptz)
  to authenticated;
