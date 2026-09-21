# GLOWA · project context

> Read this file at the start of every prompt and update it at the end.
> It is the source of truth for architecture, decisions and open work.

**Product**: a premium booking, CRM and growth platform for beauty professionals.
Three surfaces — customer app, business app, personal profile. Built in Bulgaria,
designed for Europe: Bulgarian, English and Romanian from day one.

**Repository**: <https://github.com/Ivan-Hristoslavov/glowa>
**Supabase project**: `reaobqtmwmesmpgdkzwi` (eu-west-1, Postgres 17)
**Deployment target**: Vercel (not yet configured — Prompt 5)

---

## 1. Build status

| Step | Scope | State |
| --- | --- | --- |
| Prompt 1 | Foundation, design system, Supabase, auth, i18n | **Done** |
| Prompt 2 | Customer experience: discovery, booking, profile, calendar | **Done** |
| Prompt 3 | Business app: dashboard, calendar, staff, services, CRM, marketing | Not started |
| Prompt 4 | Integrations, AI, growth layer | Not started |
| Prompt 5 | Production polish, QA, Vercel | Not started |

Verified at the end of Prompt 2: `npm run lint`, `npm run typecheck` and
`npm run build` pass. Booking was exercised end to end in the browser (search →
business → service → specialist → slot → confirm → detail → reschedule) and
over the REST API (double-book rejected, tampered insert normalised, cancel and
status history correct). The Supabase security advisor reports no unintended
findings — see §9.

---

## 2. Stack

- **Next.js 16.3.5** (App Router, Turbopack, `typedRoutes: true`)
- **React 19.2**, **TypeScript strict**
- **Tailwind CSS v4** (CSS-first config; no `tailwind.config.*`)
- **shadcn/ui** — `radix-nova` style, Radix primitives, Lucide icons
- **next-intl 4** for routing and messages
- **Supabase** — Postgres, Auth, RLS, Storage
- `next-themes`, `sonner`, `zod` v4, `date-fns` + `@date-fns/tz`

### Next.js 16 specifics that differ from older training data

- `middleware.ts` is **renamed to `proxy.ts`** and exports `proxy`. Ours lives at
  `src/proxy.ts` and composes next-intl routing with Supabase session refresh.
- Route props come from generated globals: `PageProps<"/[locale]/login">`,
  `LayoutProps<"/[locale]">`. Regenerate with `npx next typegen` after adding routes.
- `params` and `searchParams` are promises.
- There is no `src/app/layout.tsx`: `src/app/[locale]/layout.tsx` is the root
  layout, which is the documented next-intl setup. `src/app/not-found.tsx`
  therefore renders its own document.
- The React Compiler lint rules are on. Two consequences we hit: `Date.now()` may
  not be called during render (time-dependent logic lives in
  `describeAppointmentWindow`), and `setState` may not be called synchronously in
  an effect body (`SlotPicker` is remounted via `key` instead of self-clearing).

### next-intl navigation

`defineRouting` has no `pathnames` map, so `Link`/`router` take plain strings and
add the locale prefix themselves: `` href={`/business/${slug}`} ``. The
`{ pathname, params }` object form is **not** available — it only exists when
localized pathnames are configured.

---

## 3. Folder structure

```
src/
  app/
    [locale]/
      layout.tsx            root layout: fonts, theme, NextIntlClientProvider
      error.tsx  not-found.tsx
      (marketing)/          public surface — header + footer chrome
        page.tsx            landing: hero search + featured salons
        search/             discovery with filters (+ loading.tsx)
        business/[slug]/    profile page
        business/[slug]/book/  booking funnel (noindex)
      (auth)/               signed-out surface
        actions.ts          signIn / signUp / signOut
        login/  signup/
      (customer)/           signed-in surface
        profile/            dashboard: counts, next appointment
        bookings/           list (+ loading.tsx) and [id]/ detail
        favorites/  reviews/  settings/
    api/appointments/[id]/ics/   .ics download (RLS-protected)
    auth/confirm/  auth/signout/
    not-found.tsx  globals.css
  components/
    auth/ booking/ brand/ common/ customer/ discovery/ layout/ ui/
  i18n/            routing · request · navigation
  lib/
    actions/       booking · favorites · reviews · settings  ("use server")
    calendar/      provider adapters: types · google · ics
    queries/       server-only reads: discovery · appointments
    supabase/      client · server · proxy · admin
    business-categories.ts   shared client+server constants
    booking-errors.ts        RPC hint -> message key
    env.ts  format.ts  localized.ts  utils.ts
  types/database.ts
  proxy.ts
messages/          bg.json · en.json · ro.json (316 keys each, verified equal)
supabase/          migrations/ · seed.sql
```

Domain boundary rule: a surface owns its chrome; shared logic goes to `src/lib`
and shared visuals to `src/components`. Anything importing `server-only` must
never be reachable from a client component — that is why the category constants
live in `lib/business-categories.ts` rather than in `lib/queries/discovery.ts`.

---

## 4. Design system

Tokens live in `src/app/globals.css`. Brand values are `--glowa-*`; every
semantic token is derived from them. Dark mode is a designed theme, not an
inversion.

| Role | Light | Dark |
| --- | --- | --- |
| canvas | `#F8F3EE` | `#0B0E0E` |
| surface | `#FFFFFF` | `#121616` |
| ink / text | `#0F1212` | `#F7F2ED` |
| accent (CTA) | `#D96C61` | `#EF8E83` |
| soft / chips | `#EAC2BB` | `#4A3330` |
| sage | `#A9B6A6` | `#344238` |
| line | `#DDD5CE` | `#26302F` |

- **Type**: Inter for UI (`latin`, `latin-ext`, `cyrillic`, `cyrillic-ext`);
  Noto Serif Display is opt-in through `.font-heading` only.
- **Radius** `0.875rem`; cards `rounded-xl`. **Shadows** `--shadow-card/-lift/-pop`.
- **Utilities** `glowa-card`, `glowa-focus`. Global `prefers-reduced-motion` guard.
- **Logo**: `GlowaMark` / `GlowaLogo`, stroke-based, `monochrome` variant.

**Still to do (visual):** generated hero photography, category imagery, the
custom illustration family, empty-state artwork, favicon/app icon. Cards and
hero areas currently fall back to a brand gradient plus a mark, which is
deliberate — a placeholder that belongs to the brand rather than stock imagery.
`public/*.svg` are leftover create-next-app files and are unused.

---

## 5. Internationalisation

- `bg` (default), `en`, `ro`; `localePrefix: "always"`.
- `messages/{locale}.json`, key sets verified identical across the three.
- `Link` / `useRouter` / `redirect` come from `@/i18n/navigation`.
- Business content is `jsonb` shaped `{"bg","en","ro"}`, validated by
  `app.is_localized_text`; read through `pickLocalized`, which falls back to the
  default locale and then to any populated translation.
- All money and date formatting goes through `src/lib/format.ts`, which is
  timezone-explicit: every schedule surface states the salon's zone and warns
  when the viewer's zone differs.

---

## 6. Data model

Fifteen public tables plus one private one, one view, five RPCs. Money is
integer minor units; times are `timestamptz`.

```
profiles ─┬─ businesses ─┬─ business_members ── staff_profiles ─┬─ staff_working_hours
          │              │                                      └─ staff_time_off
          │              ├─ locations ── business_hours
          │              ├─ services ── service_staff
          │              ├─ business_clients
          │              ├─ marketing_campaigns ── marketing_messages
          │              └─ audit_logs
          ├─ customer_preferences
          ├─ saved_businesses
          ├─ notification_preferences
          └─ external_calendar_connections ─┬─ calendar_event_links
                                            └─ private.calendar_credentials
appointments ─┬─ appointment_status_history
              ├─ payment_records
              ├─ reviews ── review_invitations
              └─ calendar_event_links
```

Notable decisions:

- **`business_clients` is separate from `profiles`.** A salon's CRM record
  belongs to the salon and never grants access to the person's GLOWA profile.
- **Double-booking is prevented by the database**: `appointments_no_staff_overlap`
  is a GiST exclusion constraint over `(staff_profile_id, tstzrange(starts_at,
  ends_at))` for pending and confirmed rows.
- **Customers cannot dictate booking facts.** `app.enforce_customer_booking_fields`
  runs BEFORE INSERT/UPDATE: for a non-member it derives `business_id`,
  `price_cents`, `currency`, `ends_at` and the service/customer snapshot, forces
  `status = 'pending'`, strips `internal_notes`, and on update allows nothing but
  cancelling their own appointment inside the business's cancellation window.
  Verified: a crafted REST insert with `price_cents: 1`, `status: "confirmed"`,
  a five-minute duration and `internal_notes` came back at the real price,
  pending, 75 minutes, notes stripped.
- **Reviews are GLOWA's own.** External reviews are never copied in;
  `businesses.google_review_url` is a link-out and `review_invitations` records
  who was asked without claiming to know Google's state.
- **OAuth tokens live in `private.calendar_credentials`**, with no grants to any
  client role. `external_calendar_connections` holds only metadata.
- **`is_demo`** on businesses, appointments, clients, reviews, payments, campaigns.
- **Status history and audit logs are append-only** for clients.

### Availability and booking

`public.get_available_slots(service, from, to, staff?, location?)` is the single
source of availability. It intersects business hours with staff working hours per
day in the business's timezone, walks a 15-minute grid, requires room for
duration + both buffers, and subtracts existing pending/confirmed appointments
and staff time off. It also applies `booking_policy.min_lead_minutes` and
`max_advance_days`, and refuses ranges over 62 days.

It is **SECURITY DEFINER on purpose**: public availability must account for staff
time off, which customers deliberately cannot read. Only slot boundaries leave
the function, and only for an active service at an active business.

`public.book_appointment` is SECURITY INVOKER — the insert passes through RLS and
the guard trigger exactly as a direct insert would; what the RPC adds is the
check against real availability. The exclusion constraint remains the authority
on races: two callers can pass the availability check in the same instant and
Postgres rejects the loser, which surfaces as `hint = 'slot_taken'`.

`public.cancel_appointment` is INVOKER (the trigger enforces the window).
`public.reschedule_appointment` is DEFINER, because moving an appointment in time
is precisely what the customer guard forbids; it re-does every check itself
(ownership, status, policy, window, availability) and then sets a
transaction-local `app.trusted_write` flag that the trigger honours. PostgREST
gives clients no way to set that flag, and no other function sets it.

**Error contract:** the RPCs signal specific failures through the Postgres `hint`
field (`slot_unavailable`, `slot_taken`, `window_closed`, `reschedule_disabled`,
`not_cancellable`, `not_reschedulable`). `lib/booking-errors.ts` narrows that to
a union so an unexpected code degrades to a friendly sentence instead of leaking
SQL.

**Scaling note:** `SlotPicker` fetches a 21-day window in one call and groups it
client-side, which makes day switching instant and lets the day strip grey out
full days. For a salon with many bookable staff this response grows quickly; a
dedicated "days with availability" summary RPC is the fix before real volume.

### Search

`businesses.search_vector` is a generated `tsvector` over the name and the three
translations of the description and pitch, configured `simple` because one column
has to serve Bulgarian, English and Romanian and Postgres ships no Bulgarian
stemmer. GIN on the vector, trigram GIN on `businesses.name` and `locations.city`.
`public.search_businesses` returns the card payload in one query: match, filter by
category and city, join the rating summary and the minimum active price.
`public.business_rating_summary` is a `security_invoker` view, so a hidden review
never reaches an average.

### Authorization

`app` (a non-exposed schema) holds the SECURITY DEFINER helpers policies call, so
a policy on `business_members` can ask "is this user a member?" without recursing.
Policy shape throughout: `TO authenticated` plus an ownership or membership
predicate, `(select auth.uid())` for the initplan, both `USING` and `WITH CHECK`
on updates, and write policies split per action.

**Role grants:**
- `anon` — `SELECT` on eight discovery relations plus the rating view;
  `EXECUTE` on `search_businesses` and `get_available_slots`. Nothing else.
  Default privileges for `anon` on new tables, sequences **and functions** are
  revoked, so a new object starts closed.
- `authenticated` — table DML subject to RLS, plus the three booking RPCs.
- `private` schema — no grants at all.

### Storage

`avatars` (public read, 2 MB) and `business-media` (public read, 10 MB). Write
policies key on the first path segment: the caller's user id for avatars, a
business id the caller manages for business media, resolved through
`app.try_uuid` so a non-uuid folder fails closed instead of erroring.

### Migrations

| File | Contents |
| --- | --- |
| `…120000_extensions_enums_helpers.sql` | pgcrypto, btree_gist, `app`/`private`, 16 enums, shared helpers |
| `…120100_core_schema.sql` | profiles, businesses, members, locations, hours, staff, services |
| `…120200_bookings_and_engagement.sql` | appointments, CRM, preferences, reviews, payments, calendars, marketing, audit |
| `…120300_rls_and_grants.sql` | RLS helpers, integrity triggers, all policies, Data API grants |
| `…120400_policy_and_index_tuning.sql` | split write policies, review edit guard, FK covering indexes |
| `…120500_anon_grant_lockdown.sql` | reduce `anon` to the public discovery tables |
| `…130000_discovery_and_booking.sql` | pg_trgm, search vector, rating view, `search_businesses`, `get_available_slots` |
| `…130100_booking_rpcs_and_storage.sql` | guard trigger v2, book/cancel/reschedule RPCs, storage buckets and policies |
| `…130200_helper_execute_grants.sql` | EXECUTE on the helpers that CHECK constraints call |
| `…140000_rpc_execute_lockdown.sql` | revoke RPC EXECUTE from PUBLIC |
| `…140100_rpc_anon_revoke.sql` | revoke write RPCs from `anon` by name; close default privileges on functions |

Two of these were written because a check failed, not from a plan:
`130200` because a CHECK-constraint function's EXECUTE is verified as the writing
role (unlike a trigger function's, which is checked at `CREATE TRIGGER`), so
every insert failed with *permission denied for function is_localized_text*; and
`140100` because Supabase's default privileges grant functions to `anon`
explicitly, so revoking from `PUBLIC` alone left the write RPCs reachable.

Regenerate types after any change: `npm run db:types`.

---

## 7. Auth

- Email + password. `on_auth_user_created` creates the `profiles` row.
- Server code identifies the caller with `supabase.auth.getClaims()`, never
  `getSession()`.
- `src/proxy.ts` refreshes the session and gates `/dashboard`, `/profile`,
  `/bookings`, `/favorites`, `/settings`. Pages re-check server-side.
- `/auth/confirm` handles email OTP; both redirect targets reject anything that
  is not a same-origin relative path.

---

## 8. Calendar

`lib/calendar/` defines a `CalendarProvider` interface with two halves:

- **Stateless (works today):** `buildAddUrl` returns a Google Calendar template
  link, and `/api/appointments/[id]/ics` serves an RFC 5545 file that Apple
  Calendar and Outlook accept. The route reads through the normal
  request-scoped client, so RLS decides ownership — another user's id returns
  404, verified.
- **Connected (Prompt 4):** `getAuthorizationUrl` builds the Google OAuth URL
  with least-privilege scopes (`calendar.events.owned`, `calendar.freebusy`) and
  returns `null` unless `GOOGLE_CLIENT_ID` is set, so the settings page hides the
  affordance instead of offering a dead end. Tokens will go to
  `private.calendar_credentials`; appointments map to provider event ids through
  `calendar_event_links`, never a Google column on `appointments`.

---

## 9. Known advisor findings (reviewed, accepted)

- `private.calendar_credentials` has RLS on and no policy — intentional: deny-all
  plus no grants.
- `get_available_slots` is SECURITY DEFINER and callable by `anon` and
  `authenticated` — intentional, explained in §6.
- `reschedule_appointment` is SECURITY DEFINER and callable by `authenticated` —
  intentional, explained in §6. No longer callable by `anon`.
- **Leaked password protection is disabled.** This is a dashboard setting nobody
  has flipped: Authentication → Policies → enable HaveIBeenPwned checks. Worth
  doing before real users.

---

## 10. Demo and test data

`supabase/seed.sql` creates three invented salons (`demo-hair-lab-sofia`,
`demo-black-scissors`, `demo-bloom-nails`) with locations, hours, staff and
services. Every row carries `is_demo = true` and every slug starts with `demo-`.
Re-runnable; remove with `delete from public.businesses where is_demo;`.

A **QA fixture user** exists in the development project for browser testing:
`qa.customer@glowa.test`, id `22222222-2222-4222-8222-222222222201`. It was
inserted directly into `auth.users` (Supabase rejects undeliverable domains at
sign-up) and owns a couple of test appointments. It is **not** part of
`seed.sql`, its password is deliberately not recorded here, and it must never
exist in production.

Set a password for it (dev project only):

```sql
update auth.users
set encrypted_password = extensions.crypt('<choose-one>', extensions.gen_salt('bf'))
where email = 'qa.customer@glowa.test';
```

Remove it:

```sql
delete from auth.users where email = 'qa.customer@glowa.test';
```

Note for anyone doing the same: GoTrue scans several `auth.users` varchar columns
into non-nullable Go strings, so a hand-inserted user needs `''` rather than
`NULL` in `confirmation_token`, `recovery_token`, `email_change*`, `phone_change*`
and `reauthentication_token`, or login fails with "Database error querying schema".

No number shown anywhere in the product may be derived from demo data, and no
traction claim may appear unless it is real.

---

## 11. Known TODOs for the next prompts

1. **Prompt 3** — the business app: dashboard, calendar with drag/drop, staff,
   services, client CRM, reviews moderation, payments, marketing, analytics.
2. The marketing pages render dynamically because `SiteHeader` reads auth state.
   Split the auth-dependent part into a client island or a `<Suspense>` boundary
   so the landing page and search can be static.
3. Password reset is not implemented; the "forgot password" link is a placeholder.
4. `pricing` from the brief's route map does not exist yet.
5. No tests. Prompt 5 asks for tests on critical booking logic; the exclusion
   constraint, the guard trigger and `get_available_slots` are the first targets.
6. Availability day-summary RPC (see the scaling note in §6).
7. Notification channels other than email are shown as "soon" — there is no
   provider behind them yet. Sending itself is Prompt 4.
8. `payment_records` has no provider behind it; the booking flow never asks for
   payment. Deposits are modelled but unused.
9. Supabase CLI installed locally is **v2.26.9**; `supabase db query` needs 2.79+
   and `supabase db advisors` needs 2.81.3+. Schema work goes through the
   Supabase MCP server instead. `brew upgrade supabase` when convenient.
10. OpenAI-generated visual assets (§4) — no OpenAI connection is configured in
    the build environment yet, so nothing has been generated.
