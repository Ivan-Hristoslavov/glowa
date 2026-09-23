-- ---------------------------------------------------------------------------
-- GLOWA · 0025 · web push subscriptions
--
-- `push` has been a value of `notification_channel` since the first migration
-- with nothing behind it. This is what puts something behind it.
--
-- Web Push is what closes most of the gap to a native app: a salon owner gets
-- the buzz on their phone when a booking lands, without an app store. It is
-- also the one push mechanism that needs no third-party account - VAPID keys
-- are self-issued, so nothing here depends on a vendor.
--
-- A subscription is a capability: whoever holds the endpoint can send to that
-- device. So the rows are readable only by their owner, and the endpoint is
-- never exposed to another business or another customer.
-- ---------------------------------------------------------------------------

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  -- The push service URL. Unique because re-subscribing the same browser must
  -- update the row rather than accumulate duplicates that all fire at once.
  endpoint text not null unique check (endpoint ~ '^https://'),
  p256dh text not null,
  auth text not null,
  -- Whatever the browser reported, for the "your devices" list. Not an
  -- identifier and not used for anything but showing the person which is which.
  user_agent text,
  last_used_at timestamptz,
  failure_count smallint not null default 0 check (failure_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_subscriptions_profile_idx
  on public.push_subscriptions (profile_id);

create trigger push_subscriptions_updated_at
  before update on public.push_subscriptions
  for each row execute function app.set_updated_at();

alter table public.push_subscriptions enable row level security;

-- Strictly own-row. A business has no business reading the endpoint that can
-- push to a customer's phone.
create policy "push_subscriptions_own" on public.push_subscriptions
  for all to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);

grant select, insert, update, delete on public.push_subscriptions to authenticated;
revoke all on public.push_subscriptions from anon;

-- The failure counter is the worker's bookkeeping, not the browser's.
create or replace function app.guard_push_subscription()
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
    new.failure_count := 0;
    new.last_used_at := null;
    return new;
  end if;

  new.profile_id := old.profile_id;
  new.failure_count := old.failure_count;
  new.last_used_at := old.last_used_at;
  return new;
end;
$$;

create trigger push_subscriptions_guard
  before insert or update on public.push_subscriptions
  for each row execute function app.guard_push_subscription();
