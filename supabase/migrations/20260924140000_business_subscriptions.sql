-- ---------------------------------------------------------------------------
-- GLOWA · business subscriptions (Stripe)
--
-- One row per business: the plan it pays for, as Stripe last reported it.
-- Stripe is the source of truth; this is its mirror, written only by the
-- webhook through `apply_stripe_subscription`, never by a signed-in user.
-- Members of the business can read it, so the dashboard can show the plan.
--
-- Webhooks arrive out of order and more than once. Every write carries the
-- Stripe event's creation time, and an older event never overwrites a newer
-- one, so a late "created" cannot resurrect a cancelled subscription.
-- ---------------------------------------------------------------------------

create table public.business_subscriptions (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  plan text not null check (plan in ('solo', 'studio', 'salon')),
  billing_interval text not null check (billing_interval in ('month', 'year')),
  status text not null check (
    status in (
      'trialing', 'active', 'past_due', 'canceled', 'unpaid',
      'incomplete', 'incomplete_expired', 'paused'
    )
  ),
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  last_event_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index business_subscriptions_customer_idx
  on public.business_subscriptions (stripe_customer_id);

alter table public.business_subscriptions enable row level security;

create policy "business_subscriptions_member_read" on public.business_subscriptions
  for select to authenticated
  using (app.is_business_member(business_id));

-- No write policies: nobody signed in writes billing state.
grant select on public.business_subscriptions to authenticated;
revoke all on public.business_subscriptions from anon;

create or replace function public.apply_stripe_subscription(
  p_business_id uuid,
  p_plan text,
  p_interval text,
  p_status text,
  p_customer_id text,
  p_subscription_id text,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_event_at timestamptz
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.business_subscriptions as s (
    business_id, plan, billing_interval, status, stripe_customer_id,
    stripe_subscription_id, current_period_end, cancel_at_period_end,
    last_event_at, updated_at
  )
  values (
    p_business_id, p_plan, p_interval, p_status, p_customer_id,
    p_subscription_id, p_current_period_end, p_cancel_at_period_end,
    p_event_at, now()
  )
  on conflict (business_id) do update set
    plan = excluded.plan,
    billing_interval = excluded.billing_interval,
    status = excluded.status,
    stripe_customer_id = excluded.stripe_customer_id,
    stripe_subscription_id = excluded.stripe_subscription_id,
    current_period_end = excluded.current_period_end,
    cancel_at_period_end = excluded.cancel_at_period_end,
    last_event_at = excluded.last_event_at,
    updated_at = now()
  where s.last_event_at <= excluded.last_event_at;
$$;

revoke execute on function public.apply_stripe_subscription(
  uuid, text, text, text, text, text, timestamptz, boolean, timestamptz
) from public, anon, authenticated;
grant execute on function public.apply_stripe_subscription(
  uuid, text, text, text, text, text, timestamptz, boolean, timestamptz
) to service_role;
