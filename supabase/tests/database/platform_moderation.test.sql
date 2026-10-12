-- Moderation tools: only platform admins can use them, they do what they say,
-- and each change leaves a line in the audit log.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

select set_config('app.trusted_write', 'on', true);
insert into auth.users (id, email, aud, role, instance_id) values
  ('00000000-0000-4000-8000-0000000000b1', 'root@example.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-4000-8000-0000000000b2', 'salon@example.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
insert into public.businesses (id, slug, name, status, timezone, default_locale, logo_url, cover_image_url, gallery)
values ('00000000-0000-4000-8000-0000000000b3', 'moderation-salon', 'Moderation Salon', 'active', 'Europe/Sofia', 'bg',
  'https://x.test/logo.png', 'https://x.test/cover.png', '["https://x.test/a.png","https://x.test/b.png"]'::jsonb);
insert into public.staff_profiles (id, business_id, display_name, is_bookable)
values ('00000000-0000-4000-8000-0000000000b5', '00000000-0000-4000-8000-0000000000b3', 'Stylist', true);
insert into public.services (id, business_id, name, duration_minutes, price_cents, currency, is_active)
values ('00000000-0000-4000-8000-0000000000b6', '00000000-0000-4000-8000-0000000000b3', '{"bg": "Тест"}'::jsonb, 60, 4000, 'EUR', true);
insert into public.appointments (id, business_id, service_id, staff_profile_id, starts_at, ends_at, status, price_cents, source, customer_name)
values ('00000000-0000-4000-8000-0000000000b7', '00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-0000000000b6',
  '00000000-0000-4000-8000-0000000000b5', now() + interval '2 days', now() + interval '2 days 1 hour', 'confirmed', 4000, 'walk_in', 'Walk-in');
insert into public.notification_deliveries (id, business_id, appointment_id, profile_id, channel, event_type, locale, idempotency_key, status, error)
values ('00000000-0000-4000-8000-0000000000b4', '00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-0000000000b7', '00000000-0000-4000-8000-0000000000b2', 'email', 'booking_confirmation', 'bg', 'mod-test-1', 'failed', 'provider_down');
insert into public.platform_admins (profile_id) values ('00000000-0000-4000-8000-0000000000b1');
select set_config('app.trusted_write', 'off', true);

set local role authenticated;

-- a salon owner
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated"}', true);
select throws_ok($$ select public.platform_set_business_status('00000000-0000-4000-8000-0000000000b3', 'suspended') $$,
  '42501', 'Not a platform admin', 'a non-admin cannot suspend a salon');
select throws_ok($$ select public.platform_users() $$, '42501', 'Not a platform admin', 'a non-admin cannot list accounts');
select throws_ok($$ select public.platform_problems() $$, '42501', 'Not a platform admin', 'a non-admin cannot read the problem list');
select is((select count(*)::int from public.platform_audit_log), 0, 'a non-admin cannot read the audit log');

-- the platform admin
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
select lives_ok($$ select public.platform_set_business_status('00000000-0000-4000-8000-0000000000b3', 'suspended', 'spam') $$,
  'an admin can suspend a salon');
reset role;
select is((select status::text from public.businesses where id = '00000000-0000-4000-8000-0000000000b3'), 'suspended', 'the salon is suspended');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);

select lives_ok($$ select public.platform_remove_business_media('00000000-0000-4000-8000-0000000000b3', 'gallery', 'https://x.test/a.png', 'inappropriate') $$,
  'an admin can remove one gallery photo');
reset role;
select is((select gallery from public.businesses where id = '00000000-0000-4000-8000-0000000000b3'),
  '["https://x.test/b.png"]'::jsonb, 'only that photo is gone');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
select lives_ok($$ select public.platform_remove_business_media('00000000-0000-4000-8000-0000000000b3', 'cover') $$, 'an admin can remove the cover');
reset role;
select is((select cover_image_url from public.businesses where id = '00000000-0000-4000-8000-0000000000b3'), null, 'the cover is cleared');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);

select is(jsonb_array_length(public.platform_problems() -> 'failed_messages'), 1, 'the failed message shows up as a problem');
select lives_ok($$ select public.platform_retry_notification('00000000-0000-4000-8000-0000000000b4') $$, 'a failed message can be retried');
reset role;
select is((select status from public.notification_deliveries where id = '00000000-0000-4000-8000-0000000000b4'), 'queued', 'and it is queued again');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
select ok(jsonb_array_length(public.platform_audit(10)) >= 4, 'every change is in the audit log');

select * from finish();
rollback;
