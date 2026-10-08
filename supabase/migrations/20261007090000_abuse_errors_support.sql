-- ---------------------------------------------------------------------------
-- Three things a public product needs before strangers use it:
--   1. a rate limit on the forms anyone can submit (sign-up, sign-in, password
--      reset, support), so one script cannot fill the base or mail-bomb an
--      address from ours;
--   2. a record of server errors, so a broken page is found by us and not
--      reported by a salon;
--   3. a support inbox, so a salon with a problem has somewhere to write.
-- Counters and the error log are written only by the server (service role).
-- The platform admin reads them through SECURITY DEFINER functions that refuse
-- anyone else, like the rest of the console.
-- ---------------------------------------------------------------------------

create table public.rate_limit_hits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 1,
  primary key (key, window_start)
);

alter table public.rate_limit_hits enable row level security;
revoke all on public.rate_limit_hits from anon, authenticated;

-- True when the call is allowed, false when `p_key` has used up its allowance
-- in the current window. Fixed windows: simple, cheap, good enough to stop a
-- script. Only the service role can call it - a key is just a string, and if a
-- visitor could pass any key they could use up someone else's allowance.
create or replace function public.rate_limit_check(
  p_key text, p_limit integer, p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz :=
    to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into public.rate_limit_hits as r (key, window_start, hits)
  values (left(p_key, 200), v_window, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning hits into v_hits;

  -- Housekeeping, now and then: counters older than a day are of no use.
  if random() < 0.01 then
    delete from public.rate_limit_hits where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_limit;
end;
$$;

revoke all on function public.rate_limit_check(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_check(text, integer, integer) to service_role;

create table public.error_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source text not null check (source in ('server', 'client')),
  fingerprint text not null,
  message text not null,
  path text,
  method text,
  digest text,
  user_id uuid references public.profiles (id) on delete set null,
  details jsonb not null default '{}'::jsonb
);

create index error_events_created_idx on public.error_events (created_at desc);
create index error_events_fingerprint_idx on public.error_events (fingerprint, created_at desc);

alter table public.error_events enable row level security;
revoke all on public.error_events from anon, authenticated;

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  profile_id uuid references public.profiles (id) on delete set null,
  business_id uuid references public.businesses (id) on delete set null,
  name text,
  email text not null,
  subject text not null check (char_length(subject) between 2 and 160),
  message text not null check (char_length(message) between 5 and 4000),
  page text,
  locale text,
  status text not null default 'open' check (status in ('open', 'done'))
);

create index support_tickets_status_idx on public.support_tickets (status, created_at desc);

alter table public.support_tickets enable row level security;

-- A signed-in person can see their own requests; everything else is the
-- platform admin's, through the functions below.
create policy "support_tickets_read_own" on public.support_tickets
  for select to authenticated
  using (profile_id = (select auth.uid()));

revoke all on public.support_tickets from anon, authenticated;
grant select on public.support_tickets to authenticated;

create or replace function public.platform_errors(p_limit integer default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app.require_platform_admin();
  return coalesce((
    select jsonb_agg(row order by last_seen desc) from (
      select max(e.created_at) as last_seen, jsonb_build_object(
        'fingerprint', e.fingerprint,
        'message', (array_agg(e.message order by e.created_at desc))[1],
        'path', (array_agg(e.path order by e.created_at desc))[1],
        'source', (array_agg(e.source order by e.created_at desc))[1],
        'count', count(*),
        'count_24h', count(*) filter (where e.created_at >= now() - interval '24 hours'),
        'first_seen', min(e.created_at),
        'last_seen', max(e.created_at)
      ) as row
      from public.error_events e
      where e.created_at >= now() - interval '30 days'
      group by e.fingerprint
      order by max(e.created_at) desc
      limit greatest(1, least(coalesce(p_limit, 100), 300))
    ) g
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.platform_errors(integer) from public, anon;
grant execute on function public.platform_errors(integer) to authenticated;

create or replace function public.platform_clear_errors(p_fingerprint text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.require_platform_admin();
  delete from public.error_events where fingerprint = p_fingerprint;
  insert into public.platform_audit_log (admin_id, action, target_type, target_id, details)
  values ((select auth.uid()), 'clear_errors', 'error', p_fingerprint, '{}'::jsonb);
end;
$$;

revoke all on function public.platform_clear_errors(text) from public, anon;
grant execute on function public.platform_clear_errors(text) to authenticated;

create or replace function public.platform_support(p_limit integer default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app.require_platform_admin();
  return coalesce((
    select jsonb_agg(row order by created_at desc) from (
      select t.created_at, jsonb_build_object(
        'id', t.id, 'created_at', t.created_at, 'name', t.name, 'email', t.email,
        'subject', t.subject, 'message', t.message, 'page', t.page, 'status', t.status,
        'business_name', b.name
      ) as row
      from public.support_tickets t
      left join public.businesses b on b.id = t.business_id
      order by (t.status = 'open') desc, t.created_at desc
      limit greatest(1, least(coalesce(p_limit, 100), 300))
    ) s
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.platform_support(integer) from public, anon;
grant execute on function public.platform_support(integer) to authenticated;

create or replace function public.platform_set_ticket_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.require_platform_admin();
  if p_status not in ('open', 'done') then
    raise exception 'Unknown status' using errcode = '22023';
  end if;
  update public.support_tickets set status = p_status where id = p_id;
  if not found then
    raise exception 'Unknown ticket' using errcode = 'P0002';
  end if;
  insert into public.platform_audit_log (admin_id, action, target_type, target_id, details)
  values ((select auth.uid()), 'support_status', 'ticket', p_id::text, jsonb_build_object('to', p_status));
end;
$$;

revoke all on function public.platform_set_ticket_status(uuid, text) from public, anon;
grant execute on function public.platform_set_ticket_status(uuid, text) to authenticated;
