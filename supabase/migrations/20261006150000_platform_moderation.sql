-- ---------------------------------------------------------------------------
-- Platform console, second step: moderation, problems, and a record of what
-- the platform admin did.
--
-- Every function here is SECURITY DEFINER and starts by refusing anyone who is
-- not in public.platform_admins, so none of it widens a table policy and a
-- salon member can never reach another salon's rows this way. Every change is
-- written to platform_audit_log in the same transaction.
-- ---------------------------------------------------------------------------

create table public.platform_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index platform_audit_log_created_idx on public.platform_audit_log (created_at desc);

alter table public.platform_audit_log enable row level security;

create policy "platform_audit_log_read" on public.platform_audit_log
  for select to authenticated
  using (app.is_platform_admin());

revoke all on public.platform_audit_log from anon, authenticated;
grant select on public.platform_audit_log to authenticated;

create or replace function app.require_platform_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.is_platform_admin() then
    raise exception 'Not a platform admin' using errcode = '42501';
  end if;
end;
$$;

revoke all on function app.require_platform_admin() from public, anon;
grant execute on function app.require_platform_admin() to authenticated;

create or replace function public.platform_log(
  p_action text, p_target_type text, p_target_id text, p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.require_platform_admin();
  insert into public.platform_audit_log (admin_id, action, target_type, target_id, details)
  values ((select auth.uid()), p_action, p_target_type, p_target_id, coalesce(p_details, '{}'::jsonb));
end;
$$;

revoke all on function public.platform_log(text, text, text, jsonb) from public, anon;
grant execute on function public.platform_log(text, text, text, jsonb) to authenticated;

-- Suspend a salon (it disappears from search and its page, bookings stop) or
-- bring it back.
create or replace function public.platform_set_business_status(
  p_business_id uuid, p_status public.business_status, p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.business_status;
begin
  perform app.require_platform_admin();
  select status into v_old from public.businesses where id = p_business_id for update;
  if not found then
    raise exception 'Unknown business' using errcode = 'P0002';
  end if;
  update public.businesses set status = p_status where id = p_business_id;
  insert into public.platform_audit_log (admin_id, action, target_type, target_id, details)
  values ((select auth.uid()), 'business_status', 'business', p_business_id::text,
    jsonb_build_object('from', v_old, 'to', p_status, 'reason', p_reason));
end;
$$;

revoke all on function public.platform_set_business_status(uuid, public.business_status, text) from public, anon;
grant execute on function public.platform_set_business_status(uuid, public.business_status, text) to authenticated;

-- Take one picture off a salon's page: its logo, its cover, or one gallery
-- photo. The file stays in storage (the owner can be shown what was removed);
-- it just is not referenced any more.
create or replace function public.platform_remove_business_media(
  p_business_id uuid, p_kind text, p_url text default null, p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.require_platform_admin();
  if p_kind not in ('logo', 'cover', 'gallery') then
    raise exception 'Unknown media kind' using errcode = '22023';
  end if;

  if p_kind = 'logo' then
    update public.businesses set logo_url = null where id = p_business_id;
  elsif p_kind = 'cover' then
    update public.businesses set cover_image_url = null where id = p_business_id;
  else
    update public.businesses
    set gallery = coalesce((
      select jsonb_agg(item) from jsonb_array_elements(coalesce(gallery, '[]'::jsonb)) item
      where item #>> '{}' is distinct from p_url
    ), '[]'::jsonb)
    where id = p_business_id;
  end if;

  insert into public.platform_audit_log (admin_id, action, target_type, target_id, details)
  values ((select auth.uid()), 'remove_media', 'business', p_business_id::text,
    jsonb_build_object('kind', p_kind, 'url', p_url, 'reason', p_reason));
end;
$$;

revoke all on function public.platform_remove_business_media(uuid, text, text, text) from public, anon;
grant execute on function public.platform_remove_business_media(uuid, text, text, text) to authenticated;

create or replace function public.platform_set_review_status(
  p_review_id uuid, p_status public.review_status, p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.review_status;
  v_business uuid;
begin
  perform app.require_platform_admin();
  select status, business_id into v_old, v_business from public.reviews where id = p_review_id for update;
  if not found then
    raise exception 'Unknown review' using errcode = 'P0002';
  end if;
  update public.reviews set status = p_status where id = p_review_id;
  insert into public.platform_audit_log (admin_id, action, target_type, target_id, details)
  values ((select auth.uid()), 'review_status', 'review', p_review_id::text,
    jsonb_build_object('from', v_old, 'to', p_status, 'business_id', v_business, 'reason', p_reason));
end;
$$;

revoke all on function public.platform_set_review_status(uuid, public.review_status, text) from public, anon;
grant execute on function public.platform_set_review_status(uuid, public.review_status, text) to authenticated;

-- What there is to look at: the newest salons with their pictures and the
-- newest reviews with their text.
create or replace function public.platform_content(p_limit integer default 40)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 40), 100));
begin
  perform app.require_platform_admin();
  return jsonb_build_object(
    'salons', (
      select coalesce(jsonb_agg(row order by created_at desc), '[]'::jsonb) from (
        select b.created_at, jsonb_build_object(
          'id', b.id, 'name', b.name, 'slug', b.slug, 'status', b.status,
          'logo_url', b.logo_url, 'cover_url', b.cover_image_url,
          'gallery', coalesce(b.gallery, '[]'::jsonb),
          'description', b.description, 'created_at', b.created_at
        ) as row
        from public.businesses b
        where not b.is_demo
        order by b.created_at desc
        limit v_limit
      ) s
    ),
    'reviews', (
      select coalesce(jsonb_agg(row order by created_at desc), '[]'::jsonb) from (
        select r.created_at, jsonb_build_object(
          'id', r.id, 'business_id', r.business_id, 'business_name', b.name,
          'rating', r.rating, 'comment', r.comment, 'response', r.business_response,
          'status', r.status, 'created_at', r.created_at
        ) as row
        from public.reviews r
        join public.businesses b on b.id = r.business_id
        where not r.is_demo
        order by r.created_at desc
        limit v_limit
      ) x
    )
  );
end;
$$;

revoke all on function public.platform_content(integer) from public, anon;
grant execute on function public.platform_content(integer) to authenticated;

-- People: find an account by e-mail or name, and see what it belongs to.
create or replace function public.platform_users(p_query text default null, p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 200));
  v_like text := '%' || replace(replace(coalesce(trim(p_query), ''), '%', ''), '_', '') || '%';
begin
  perform app.require_platform_admin();
  return coalesce((
    select jsonb_agg(row order by created_at desc) from (
      select u.created_at, jsonb_build_object(
        'id', u.id,
        'email', u.email,
        'full_name', p.full_name,
        'created_at', u.created_at,
        'last_sign_in_at', u.last_sign_in_at,
        'banned_until', u.banned_until,
        'bookings', (select count(*) from public.appointments a where a.customer_profile_id = u.id),
        'salons', coalesce((
          select jsonb_agg(jsonb_build_object('name', b.name, 'role', m.role))
          from public.business_members m join public.businesses b on b.id = m.business_id
          where m.profile_id = u.id and m.status = 'active'
        ), '[]'::jsonb),
        'is_platform_admin', exists (select 1 from public.platform_admins a where a.profile_id = u.id)
      ) as row
      from auth.users u
      left join public.profiles p on p.id = u.id
      where coalesce(p.is_demo, false) = false
        and (coalesce(trim(p_query), '') = '' or u.email ilike v_like or p.full_name ilike v_like)
      order by u.created_at desc
      limit v_limit
    ) t
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.platform_users(text, integer) from public, anon;
grant execute on function public.platform_users(text, integer) to authenticated;

-- What is not working for people right now.
create or replace function public.platform_problems()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app.require_platform_admin();
  return jsonb_build_object(
    'failed_messages', (
      select coalesce(jsonb_agg(row order by at desc), '[]'::jsonb) from (
        select d.updated_at as at, jsonb_build_object(
          'id', d.id, 'event', d.event_type, 'channel', d.channel, 'status', d.status,
          'attempts', d.attempts, 'error', d.error, 'business_id', d.business_id,
          'business_name', b.name, 'scheduled_for', d.scheduled_for, 'updated_at', d.updated_at
        ) as row
        from public.notification_deliveries d
        left join public.businesses b on b.id = d.business_id
        where d.status = 'failed'
          and d.updated_at >= now() - interval '30 days'
        order by d.updated_at desc
        limit 100
      ) f
    ),
    'stuck_messages', (
      select count(*) from public.notification_deliveries
      where status = 'queued' and scheduled_for < now() - interval '1 hour'
    ),
    'payments', (
      select coalesce(jsonb_agg(row order by at desc), '[]'::jsonb) from (
        select pr.updated_at as at, jsonb_build_object(
          'id', pr.id, 'kind', pr.kind, 'status', pr.status, 'amount_cents', pr.amount_cents,
          'currency', pr.currency, 'reason', pr.failure_reason, 'business_id', pr.business_id,
          'business_name', b.name, 'created_at', pr.created_at
        ) as row
        from public.payment_records pr
        left join public.businesses b on b.id = pr.business_id
        where not pr.is_demo
          and (pr.status = 'failed'
               or (pr.kind = 'refund' and pr.status = 'pending' and pr.created_at < now() - interval '1 day'))
        order by pr.updated_at desc
        limit 100
      ) p
    ),
    'summary', jsonb_build_object(
      'failed_messages_7d', (select count(*) from public.notification_deliveries
         where status = 'failed' and updated_at >= now() - interval '7 days'),
      'sent_messages_7d', (select count(*) from public.notification_deliveries
         where status = 'sent' and sent_at >= now() - interval '7 days')
    )
  );
end;
$$;

revoke all on function public.platform_problems() from public, anon;
grant execute on function public.platform_problems() to authenticated;

-- Put a failed message back in the queue; the worker picks it up on its next run.
create or replace function public.platform_retry_notification(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.require_platform_admin();
  update public.notification_deliveries
  set status = 'queued', error = null, scheduled_for = now(), attempts = 0
  where id = p_id and status = 'failed';
  if not found then
    raise exception 'Message is not failed' using errcode = 'P0002';
  end if;
  insert into public.platform_audit_log (admin_id, action, target_type, target_id, details)
  values ((select auth.uid()), 'retry_notification', 'notification', p_id::text, '{}'::jsonb);
end;
$$;

revoke all on function public.platform_retry_notification(uuid) from public, anon;
grant execute on function public.platform_retry_notification(uuid) to authenticated;

create or replace function public.platform_audit(p_limit integer default 100)
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
      select l.created_at, jsonb_build_object(
        'id', l.id, 'action', l.action, 'target_type', l.target_type, 'target_id', l.target_id,
        'details', l.details, 'created_at', l.created_at, 'admin_email', u.email
      ) as row
      from public.platform_audit_log l
      left join auth.users u on u.id = l.admin_id
      order by l.created_at desc
      limit greatest(1, least(coalesce(p_limit, 100), 500))
    ) t
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.platform_audit(integer) from public, anon;
grant execute on function public.platform_audit(integer) to authenticated;
