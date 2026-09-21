-- ---------------------------------------------------------------------------
-- GLOWA · 0001 · extensions, enums, private schema and shared helpers
-- ---------------------------------------------------------------------------

create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;

-- `app` holds SECURITY DEFINER helpers used by RLS policies. It is NOT exposed
-- through the Data API, so these functions are not a public endpoint.
create schema if not exists app;
-- `private` holds rows that must never be reachable from a client, whatever
-- the RLS policy says (OAuth tokens and similar).
create schema if not exists private;

revoke all on schema app from public;
revoke all on schema private from public, anon, authenticated;
grant usage on schema app to authenticated, anon;

-- --- enums -----------------------------------------------------------------

create type public.business_category as enum (
  'hair_salon', 'barbershop', 'nail_studio', 'lash_brow', 'skincare',
  'makeup', 'massage', 'spa', 'tattoo', 'other'
);

create type public.business_status as enum ('draft', 'active', 'suspended');

create type public.business_role as enum ('owner', 'admin', 'manager', 'staff');

create type public.member_status as enum ('invited', 'active', 'disabled');

create type public.service_category as enum (
  'hair', 'barber', 'nails', 'lashes_brows', 'skincare', 'makeup',
  'massage', 'spa', 'tattoo', 'other'
);

create type public.appointment_status as enum (
  'pending', 'confirmed', 'completed', 'cancelled', 'no_show'
);

create type public.appointment_source as enum (
  'customer_web', 'business_admin', 'walk_in', 'import'
);

create type public.payment_kind as enum ('deposit', 'full', 'refund');

create type public.payment_status as enum (
  'pending', 'succeeded', 'failed', 'refunded', 'cancelled'
);

create type public.review_status as enum ('published', 'pending', 'hidden');

create type public.notification_channel as enum (
  'email', 'sms', 'whatsapp', 'viber', 'push'
);

create type public.notification_event as enum (
  'booking_confirmation', 'reminder', 'cancellation', 'reschedule',
  'review_request', 'marketing'
);

create type public.campaign_type as enum (
  'win_back', 'reminder', 'birthday', 'anniversary', 'custom'
);

create type public.campaign_status as enum (
  'draft', 'scheduled', 'sending', 'sent', 'cancelled'
);

create type public.calendar_provider as enum ('google', 'apple', 'ics');

create type public.connection_status as enum ('active', 'revoked', 'error');

-- --- shared helpers --------------------------------------------------------

-- Localized text is stored as {"bg": "...", "en": "...", "ro": "..."} so that
-- business-authored content follows the same i18n contract as the UI.
create or replace function app.is_localized_text(value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select value is null
      or (jsonb_typeof(value) = 'object'
          and not exists (
            select 1
            from jsonb_each(value) as entry(key, val)
            where entry.key not in ('bg', 'en', 'ro')
               or jsonb_typeof(entry.val) <> 'string'
          ));
$$;

create or replace function app.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
