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
| Prompt 3 | Business app: dashboard, calendar, staff, services, CRM, marketing | **Done** |
| Prompt 4 | Integrations, AI, growth layer | Not started |
| Prompt 5 | Production polish, QA, Vercel | Not started |

Verified at the end of Prompt 3: `npm run lint`, `npm run typecheck` and
`npm run build` pass (68 static entries, 28 routes). The business app was
exercised in the browser as a real owner: dashboard metrics, calendar with live
updates confirmed subscribed, a walk-in created from the front desk, a
deliberate double-book refused with the localized overlap message, the CRM
record appearing on its own, team and analytics rendering. Prompt 2's customer
flow was re-verified end to end earlier. The Supabase security advisor reports
no unintended findings — see §9.

Two schema bugs were found *by* that browser pass and fixed (§6, migrations
0013 and 0014): a walk-in entered by name alone failed a check constraint, and
the CRM trigger skipped it for the same reason.

---

## 2. Stack

- **Next.js 16.3.5** (App Router, Turbopack, `typedRoutes: true`)
- **React 19.2**, **TypeScript strict**
- **Tailwind CSS v4** (CSS-first config; no `tailwind.config.*`)
- **shadcn/ui** — `radix-nova` style, Radix primitives, Lucide icons
- **next-intl 4** for routing and messages
- **Supabase** — Postgres, Auth, RLS, Storage
- `next-themes`, `sonner`, `zod` v4, `date-fns` + `@date-fns/tz`
- `sharp` (dev only) for the brand-asset conversion script

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
      (customer)/           signed-in customer surface
        profile/            dashboard: counts, next appointment
        bookings/           list (+ loading.tsx) and [id]/ detail
        favorites/  reviews/  settings/  onboarding/
      (business)/           signed-in business surface
        layout.tsx          sidebar shell; redirects to /onboarding with no membership
        dashboard/          metrics + today's schedule
          calendar/  clients/[clientId]/  services/  staff/
          reviews/  payments/  marketing/  analytics/  assistant/  settings/
    api/appointments/[id]/ics/   .ics download (RLS-protected)
    auth/confirm/  auth/signout/
    not-found.tsx  globals.css
  components/
    admin/         nav, switcher, editors, metric card
      calendar/    board, appointment dialog, block-time dialog
      charts/      shell, bar, horizontal bar
    auth/ booking/ brand/ common/ customer/ discovery/ layout/ ui/
  i18n/            routing · request · navigation
  lib/
    actions/       booking · favorites · reviews · settings · business ·
                   catalog · crm · admin-appointments · marketing · assistant
                   ("use server" — every export is a callable endpoint)
      guard.ts     requireMembership + Postgres error mapping (server-only)
    ai/            assistant provider abstraction: types · openai · index
    calendar/      provider adapters: types · google · ics
    queries/       server-only reads: discovery · appointments · business
    supabase/      client · server · proxy · admin
    business-categories.ts   shared client+server constants
    booking-errors.ts        RPC hint -> message key
    timezone.ts    wall-clock <-> instant helpers for the admin calendar
    env.ts  format.ts  localized.ts  utils.ts
  types/database.ts
  proxy.ts
messages/          bg.json · en.json · ro.json (595 keys each, verified equal)
supabase/          migrations/ · seed.sql
```

Domain boundary rule: a surface owns its chrome; shared logic goes to `src/lib`
and shared visuals to `src/components`. Anything importing `server-only` must
never be reachable from a client component — that is why the category constants
live in `lib/business-categories.ts` rather than in `lib/queries/discovery.ts`.

Two rules worth stating because breaking them is silent:

- **Every export from a `"use server"` module is a public endpoint.** No helper
  exports, no placeholders — if it does not need to be callable from a browser,
  it does not belong in an actions file.
- **`lib/actions/guard.ts` is `server-only`, not `"use server"`.** It is imported
  *by* actions; it is not one.

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

- **Type**: **Onest** for UI and **Playfair Display** for headings, both loaded
  with `latin`, `latin-ext` and `cyrillic`. Chosen by rendering the real
  Bulgarian and Romanian strings in five candidate pairings rather than judging
  font names: Onest is drawn Cyrillic-first, so Bulgarian body copy reads warmer
  than Inter; Playfair's Cyrillic is properly drawn rather than a Latin face
  with Cyrillic bolted on, and its stroke contrast is the editorial register the
  brand asks for. Cormorant Garamond was rejected as too fragile for Cyrillic at
  display size. The display face stays opt-in through `.font-heading` — body
  copy is never set in it. Playfair is a didone, so headings take near-zero
  tracking (tight tracking clogs the hairlines) and gain weight at display
  sizes instead.
- **Radius** `0.875rem`; cards `rounded-xl`. **Shadows** `--shadow-card/-lift/-pop`.
- **Utilities** `glowa-card`, `glowa-focus`. Global `prefers-reduced-motion` guard.
- **Logo**: `GlowaMark` / `GlowaLogo`, stroke-based, `monochrome` variant.

**Imagery.** The visual set is generated and in place — see
[`docs/visual-assets.md`](./docs/visual-assets.md) for provenance, the shared
art direction and every prompt. In `public/brand/`: five heroes, six category
photographs, three demo-salon covers, a ten-piece feature illustration family,
five empty states with dark companions for four of them, and the social share
card — all produced with OpenAI image generation against one direction and
served as WebP. `src/lib/brand-assets.ts` is the only place their paths are
written down.

Empty states ship both themes and let CSS pick, the same way the hero does, so
the server and the client render identical markup and there is no theme flash.
`src/app/apple-icon.png` and the share card are built from the mark's own
geometry by `npm run assets:social`.

Deliberately **not** generated: the G mark, the feature icon family and the
favicon are hand-authored SVG. A raster icon at 20px is mush and cannot inherit
`currentColor`; the mark has to hold at 16px and in monochrome. Generated
imagery is supporting material — the booking and admin surfaces stay crisp and
typographic rather than becoming image collages.

The fallback rule lives in `fallbackBusinessImage()`: a business's own cover
wins, then generated art for its category, then the brand gradient — never a
photograph of the wrong trade.

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
| `…090000_business_workspace.sql` | onboarding RPC, CRM sync trigger, dashboard metrics, campaign audience, realtime |
| `…100000_walkin_identity.sql` | a walk-in appointment may be identified by name alone |
| `…100100_crm_walkin_sync.sql` | same for `business_clients`; CRM trigger accepts a name; backfill |
| `…200000_claim_invitations.sql` | `claim_pending_invitations()` links an invited membership to the account that signs in |
| `…210000_notification_outbox.sql` | `notification_deliveries`, opt-out lookup, appointment trigger, worker claim |
| `…220000_book_appointment_self_derive.sql` | `book_appointment` writes a complete row instead of relying on the guard trigger |

Four of these were written because something failed, not from a plan:

- `130200` — a CHECK-constraint function's EXECUTE is verified as the *writing*
  role (unlike a trigger function's, checked at `CREATE TRIGGER`), so every
  insert failed with *permission denied for function is_localized_text*.
- `140100` — Supabase's default privileges grant functions to `anon`
  explicitly, so revoking from `PUBLIC` alone left the write RPCs reachable
  while signed out.
- `100000` and `100100` — `appointments_identified_customer` and
  `business_clients_identified` both required a profile, an email or a phone.
  That is right for self-service booking and wrong at the front desk: a salon
  writing down "Иван, 14:00" has a name and nothing else. The insert failed a
  check constraint the UI could only report as a generic error, and the CRM
  trigger silently skipped the same rows. Both now accept a name, and the CRM
  matches on it as the weakest of four branches. Found by using the calendar,
  not by reading the schema.

- `220000` — `book_appointment` inserted a placeholder row (one minute long, no
  price, no identity) and let the customer guard trigger fill it in. The guard
  returns early for a business member, because a member using the admin
  calendar supplies those fields themselves. So an owner booking a treatment at
  their own salon kept the placeholders and failed
  `appointments_identified_customer` outright — and would have been priced at
  zero if it had not. The RPC now writes the whole row; the guard still
  overrides everything for a non-member, so the trust boundary is unchanged.
  Found by trying to book, not by reading the schema.

The `100100` backfill has to set `app.trusted_write`: a migration runs as the
owner, which the customer guard trigger treats as "not a member" and refuses.

`npm run db:types` writes to a temp file and moves it into place. The plain
redirect form truncated `src/types/database.ts` to zero bytes whenever the
command failed, which is exactly when you least want it emptied.

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

## 8a. Business app

The admin lives under `/dashboard` behind `(business)/layout.tsx`, which
requires an *active membership* — the proxy only requires a session. With no
membership it redirects to `/onboarding`.

**Which business.** `getActiveMembership()` lists the caller's real memberships
and picks the one named by the `glowa_business` cookie, falling back to the
first. The cookie only ever *selects from that list*, so a tampered value
resolves to nothing rather than to someone else's salon.

**Roles.** `owner` and `admin` administer; `manager` runs calendar, services and
clients; `staff` reads the team calendar. `requireMembership(businessId, level)`
in `lib/actions/guard.ts` gives each action a clear refusal code; RLS remains
the enforcement.

**Onboarding.** `public.create_business` is SECURITY INVOKER and does the whole
setup in one transaction: business (as a draft), primary location, a
Tuesday–Saturday default week, an owner membership (via the existing trigger)
and a bookable staff profile for the owner. `app.next_free_slug` is DEFINER
because draft slugs are not readable by the caller, so an invoker-side
uniqueness check would hand out a slug already taken. Publishing refuses a
business with no active service — a dead search result helps nobody.

**Calendar.** Day and week views, staff columns, a 15-minute grid, closed time
shaded so an empty column reads as *closed* rather than *free*. Drag-and-drop
moves an appointment (duration preserved); the exclusion constraint refuses an
overlap and it surfaces as a localized message rather than a stack trace.
Blocked time is `staff_time_off`. Everything renders in the **salon's**
timezone via `lib/timezone.ts`, whose `instantFromZoned` does a second offset
pass so the hour around a DST change lands correctly.

**Realtime.** `public.appointments` is in the `supabase_realtime` publication
with `replica identity full`. The board subscribes per business and calls
`router.refresh()`; RLS applies to the subscription, so a subscriber only
receives rows their policies already allow. The status dot turns green only on
`SUBSCRIBED`, so "live" is never claimed without evidence.

**CRM.** `business_clients` rows are derived from appointments by
`app.sync_business_client`, not typed twice. Only a transition *into*
`completed` moves visits and spend, so replaying an update never double-counts.
Matching is profile → email → phone → name, weakest last.

**Dashboard and analytics.** `public.get_business_dashboard` is SECURITY
INVOKER, so every underlying read stays behind RLS; the membership check only
turns "silently all zeros" into a clear error. Utilisation is booked minutes
over the staff working minutes in the range. Analytics aggregates a six-month
window in TypeScript — fine at salon volume, an RPC when a chain outgrows it.

**Charts.** Coral `#D96C61` (light) / `#DA6A62` (dark) with blue `#2A78D6` /
`#3987E5`. The pair was run through the dataviz validator against GLOWA's own
surfaces and passes the lightness band, chroma floor, CVD separation (worst
adjacent protan ΔE 19.3), normal-vision floor and 3:1 contrast in both modes.
**A green companion was tried first and failed**: coral and green sit on top of
each other for protanopes (ΔE 3.8). Dark is re-stepped, not flipped — the light
coral is above the dark lightness band. One y-scale, legend for two series,
direct labels, a hover tooltip, and a visually hidden table per chart.

**Payments, marketing and the assistant are honest about their state.** Payment
records and the schema exist with no provider behind them; campaigns save as
drafts and audiences can be previewed as a *count* (names stay on the server)
but nothing sends; the assistant renders a "not configured" panel unless
`OPENAI_API_KEY` is set. Each says so on screen rather than offering a control
that does nothing.

---

## 8c. Notifications

A message is a database row before it is a send. `notification_deliveries` is
the outbox, and `idempotency_key` is unique, so "enqueue twice" is one row.

**Enqueued by trigger, not by the action.** `appointments_notifications` fires
after insert or after a change to `status` / `starts_at`, so every path that
touches an appointment — customer web, admin calendar, walk-in, a future
import — produces the same messages without remembering to. It also means the
rows are written inside the booking transaction: a booking that commits always
has its confirmation queued, and one that rolls back never does.

| Event | When | Scheduled for |
| --- | --- | --- |
| `booking_confirmation` | insert, status pending or confirmed | now |
| `reminder` | insert, and again on reschedule | `starts_at` − the customer's lead (default 24 h) |
| `reschedule` | `starts_at` changed while active | now |
| `cancellation` | status → `cancelled` | now |
| `review_request` | status → `completed` | `completed_at` + 3 h |

A reminder whose time is no longer the appointment's is flipped to `skipped`
with `error = 'superseded'` in the same statement that queues its replacement.
Demo rows and `source = 'import'` are skipped entirely, as is any appointment
with no reachable contact.

**Opt-out** is `app.notifications_enabled`: absence of a row means yes, and a
business-specific `notification_preferences` row beats the account-wide one, so
muting one salon does not mute the rest.

**The worker.** `claim_notification_deliveries(limit)` is `service_role`-only
and claims with `for update skip locked`, so two instances never take the same
row. Claiming flips the row to `sending` *before* the provider call: a crash
leaves evidence instead of a silent second send. Rows stuck in `sending` are
reclaimed after 15 minutes and abandoned after five attempts.

**Campaigns use the same queue.** `marketing_messages` was designed in Prompt 1
as a second per-recipient outbox, before `notification_deliveries` existed.
Keeping both would have meant two queues, two status machines and two workers
for one job, so it was dropped (empty, never written to) and the outbox gained
`campaign_id` and `business_client_id`.

`queue_campaign` is SECURITY DEFINER - `authenticated` has no INSERT on the
outbox at all - and does the membership check itself. It refuses a campaign
that is not a draft, refuses one with no subject or body, and keys each row
`campaign:<campaign>:<client>`, so pressing send twice conflicts and does
nothing rather than mailing everyone again. A campaign is marked `sent` by
`finalize_campaign` only once nothing is left in flight; storing it at queue
time would be a claim we could not back up.

**Unsubscribe is not optional.** Every `business_clients` row carries an opaque
`unsubscribe_token` (not derived from the email, so it cannot be guessed or
edited into someone else's), every campaign email carries a visible link, and
`/[locale]/unsubscribe/[token]` works signed out, in one click, from a mail
client. It flips consent *and* marks that client's already-queued marketing
`skipped` - an unsubscribe that only takes effect next time is not an
unsubscribe. Appointment notifications are unaffected, and the page says so.

**Channels.** `lib/notifications/channels/` holds one adapter per transport
behind a `ChannelAdapter` interface. Email resolves to Resend when
`RESEND_API_KEY` and `RESEND_FROM` are set, otherwise to a console adapter that
refuses to configure itself in production — a deployment missing its key leaves
messages queued and visible rather than marking them sent. SMS, WhatsApp, Viber
and push are real enum values with no adapter; they resolve to `null` and the
row goes back in the queue instead of being faked.

`Idempotency-Key` goes to the provider too. Our unique key stops re-enqueueing;
the provider's stops a retry after an ambiguous failure, where the request
landed but the response never came back.

**Rendering happens at send time**, from the appointment, not from a snapshot
on the outbox row. A name corrected after booking reaches the customer
corrected, and no personal data is duplicated into the queue. Copy lives in
`messages/{bg,en,ro}.json` under `notifications`; the HTML is a single-column
inline-styled table with the light-mode brand colours written out literally,
because no mail client resolves CSS variables.

**Driving it.** `GET /api/cron/notifications` drains the queue, authorized by a
bearer `CRON_SECRET` compared in constant time; `POST` does the same and
schedules a second pass via `after()` so a fresh booking's confirmation does not
wait for the next tick. `vercel.json` schedules it every minute — note that
Vercel's Hobby plan only permits daily crons, so a Pro plan (or any external
scheduler holding the secret) is required for minute-level reminders.

---

## 8b. AI assistant

`lib/ai/` defines an `AssistantProvider` interface with one OpenAI
implementation. `getAssistantProvider()` returns `null` without a key, so "not
configured" is a first-class state the UI explains rather than a request that
fails at the end.

What the model receives is fixed by `AssistantContext`: business name, currency,
timezone, locale, the dashboard metrics for the current month, the active
service list, and a count of bookable staff. **No client names, emails, phone
numbers or notes** — the assistant answers operational questions and drafts
copy, and neither needs personal data. The system prompt forbids inventing
appointments, prices or availability, and states it cannot create, move or
cancel bookings. The key is read server-side only.

---

## 8d. Tests

`npm run check` is lint + typecheck + `vitest run`. Two layers, split by what
each can honestly assert.

**Unit (`src/**/*.test.ts`, vitest, node environment).** Pure modules only — no
React renderer, no database, no network. What is covered and why:

- `lib/timezone` — the DST arithmetic. Both EU transitions in 2026, in Sofia
  and Bucharest, asserting that a wall-clock slot still reads the same on the
  clock after the change. This is the bug that silently moves everyone's
  appointments by an hour twice a year.
- `lib/localized` — the jsonb fallback chain, including a whitespace-only
  translation counting as missing.
- `lib/notifications/channels/email-resend` — the idempotency header reaches
  the provider, which failures are retryable, and the address builder.
- `lib/notifications/channels` registry — and specifically that email resolves
  to **nothing** in production without a key, rather than to the console
  adapter. That is the whole point of the fallback design, so it is a test.

`server-only` has no runtime outside Next's bundler, so vitest aliases it to
`test/server-only-stub.ts` — the guard stays in the source instead of being
deleted to make tests run.

**Database (`supabase/tests/database/*.test.sql`, pgTAP, `npm run test:db`).**
17 assertions across the four invariants that are enforced in Postgres
*because* the application cannot be trusted to remember them: the exclusion
constraint (overlap rejected, back-to-back allowed, a cancellation releasing
the slot), the customer write guard being present and BEFORE, CRM sync
including the name-only walk-in, and the notification outbox (unique key,
confirmation queued, unreachable walk-in queued nothing, cancellation
superseding the reminder).

These need a local stack (`supabase start`), which needs Docker. Docker was not
running when they were written, so the pgTAP harness itself has not been
executed — every assertion in it was verified individually against the live
schema inside a transaction that was then rolled back. Run `npm run test:db`
once Docker is available to confirm the harness.

---

## 8e. Public surface and SEO

`src/app/sitemap.ts` and `src/app/robots.ts` sit at the app root, outside
`[locale]`, so they are served at `/sitemap.xml` and `/robots.txt`. The proxy
matcher already excludes anything with a file extension, so neither picks up a
locale prefix.

- Every sitemap URL carries the full `hreflang` alternate set. Without it a
  Bulgarian salon page and its Romanian translation compete as duplicates
  rather than reading as one page in three languages.
- Businesses come from a cookie-less anon client (`lib/supabase/public.ts`),
  because the request-scoped client would make the artefact vary by visitor.
  `anon` RLS already limits the rows; the query only adds `is_demo = false`.
  Revalidated hourly, and a failed query degrades to the static entries rather
  than 500ing the whole sitemap.
- `robots.ts` disallows everything when `VERCEL_ENV` is not `production`. A
  preview deployment that gets indexed outranks the real site for its own
  content. In production it allows crawling but excludes `/api`, `/auth` and
  every signed-in path, so `?next=` variants of the login screen never enter
  the index.

**`/pricing`** is built and linked from the header and the mobile nav. The
feature lists are real - every line maps to something that exists. The amounts
are deliberately `null` in `lib/pricing.ts`: publishing a price is a commercial
decision, and the brief's own rule is not to fabricate prices. While `monthly`
is null the page says so and asks for contact instead of showing a figure. To
publish, fill in `monthly` and `annualMonthly` per plan - nothing else changes.

---

## 8f. Growth links (QR and referrals)

One short code, one destination, one honest counter. `growth_links` carries
both kinds because the only real difference is who gets the credit: a `qr` link
belongs to the salon, a `referral` link to a named client.

- **The code is assigned by a trigger**, never by the caller, so nobody squats
  on a short or misleading one and the client never retries a collision. The
  alphabet omits `l`, `o`, `0` and `1`, because a code gets read aloud and
  typed off a card.
- **Counters are frozen** by `app.freeze_growth_link_counters`: a manager can
  rename a link or pause it, but cannot touch `code`, `business_id`,
  `visit_count` or `booking_count`. The two places that legitimately move a
  counter set `app.counter_write` for one statement — deliberately *not*
  `app.trusted_write`, which also disables the customer booking guard and would
  be far too much authority for an increment.
- **`/[locale]/go/[code]`** is a route handler, not a page: there is nothing to
  render and someone in front of a poster should see the salon. An unknown,
  disabled or suspended code redirects to search rather than 404ing, and says
  nothing about whether the code ever existed.
- **Attribution.** The route sets a 30-day `glowa_ref` cookie holding the code
  and nothing else. `bookAppointment` passes it to `book_appointment`, which
  resolves it *against the business being booked* — a code from another salon
  is ignored, not credited. The customer guard nulls `growth_link_id` on any
  insert where the link does not belong to that business, so a crafted REST
  call cannot inflate someone else's numbers either. Both paths verified.
- **What is not collected**: no IP address, no user agent, no visitor id,
  nothing that identifies who scanned. A visit is a number going up, and the
  dashboard says so rather than implying a precision the data lacks — two scans
  of the same poster are two visits.
- **QR rendering** is server-side (`lib/growth/qr.ts`, the `qrcode` package) and
  produces SVG: a poster, a card and a mirror sticker are different sizes and a
  PNG only looks right at one. Error correction is Q (25%) rather than the
  usual M, because a code in a salon collects steam and fingerprints.

---

## 9. Known advisor findings (reviewed, accepted)

- `private.calendar_credentials` has RLS on and no policy — intentional: deny-all
  plus no grants.
- `get_available_slots` is SECURITY DEFINER and callable by `anon` and
  `authenticated` — intentional, explained in §6.
- `reschedule_appointment` is SECURITY DEFINER and callable by `authenticated` —
  intentional, explained in §6. No longer callable by `anon`.
- `claim_pending_invitations` is SECURITY DEFINER and callable by
  `authenticated` — it has to read `auth.users` to match an invitation to an
  email, and the whole match is pinned to `(select auth.uid())` (§8c).
- `resolve_growth_link` is SECURITY DEFINER and callable by `anon` —
  deliberately: somebody scanning a poster is signed out. `anon` has no read on
  `growth_links` at all, so the only thing the function discloses is where one
  code points, which is the entire purpose of a printed code (§8f).
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

It was also made an **owner of `demo-hair-lab-sofia`** so the business app has
real appointments, staff and services to render. That membership is a fixture
too, not part of `seed.sql`:

```sql
delete from public.business_members
where profile_id = '22222222-2222-4222-8222-222222222201';
```

Remove the user itself:

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

1. **Prompt 4** — integrations, AI and growth: Google Calendar OAuth end to end,
   the notification channel abstraction and actual sending (email first),
   idempotency on send, review-request automation, referral and QR booking
   links, and the OpenAI-generated visual asset set.
2. **Prompt 5** — production polish, QA, tests, Vercel.
3. The marketing pages render dynamically because `SiteHeader` reads auth state.
   Split the auth-dependent part into a client island or a `<Suspense>`
   boundary so the landing page, search and `/pricing` can be static. The
   sitemap and robots are already static.
4. `get_available_slots` has no test of its own — the pgTAP suite covers the
   constraint and the triggers around it, but not slot generation against
   working hours, time off and existing bookings. That is the next one to
   write, and it is the biggest remaining gap (§8d).
5. Availability fetches a 21-day window in one call and analytics aggregates six
   months in TypeScript. Both are fine at salon volume and both become RPCs
   before a chain uses them.
6. Notification channels other than email have no provider and resolve to
   `null` (§8c). A queued SMS stays queued rather than being marked sent.
8. `payment_records` has no provider. Deposits are modelled but unused.
9. Staff invitations are claimed on sign-in and again in the business layout
   (`claim_pending_invitations`), but no invitation *email* is sent yet — the
   invitee has to be told out of band. Wiring it to the outbox is the next
   step; the outbox currently only carries appointment events.
10. Multi-location is modelled throughout but only lightly exercised: the
    calendar filters by location on the booking side, and the admin calendar
    shows all locations at once.
11. Supabase CLI installed locally is **v2.26.9**; `supabase db query` needs
    2.79+ and `supabase db advisors` needs 2.81.3+. Schema work goes through the
    Supabase MCP server instead. `brew upgrade supabase` when convenient.
12. **Leaked password protection is still disabled** in the Supabase dashboard
    (see §9). Worth enabling before real users.
13. The generated visual set and the AI assistant are both live (§4, §8b). The
    key lives only in `.env.local`; Vercel needs `OPENAI_API_KEY` set as a
    server-side env var at deploy time (Prompt 5).
14. `SUPABASE_SECRET_KEY` is not in `.env.local`, so the notification worker
    cannot run locally — it is the only thing between the queue and a real
    send. Copy it from the Supabase dashboard (Settings → API → secret key).
15. Campaign sending has no scheduling UI: `scheduled_at` is honoured by the
    queue (a row with a future `scheduled_for` simply waits) but the editor
    only offers send-now. Campaign audience selection also has no upper bound
    on recipients, which is fine at salon volume and wants a cap before it
    is not.
17. Bulgaria is on the euro, so BGN is gone from the defaults and every
    existing amount was redenominated at the official fixed rate
    (1 EUR = 1.95583 BGN, rounded to the cent) in migration 0019. The seeded
    demo salons were then re-rounded to whole euros, because 30.68 is what
    arithmetic produces and not what a price list looks like. Romanian
    businesses keep RON.
16. `/pricing` shows "soon" instead of amounts until `lib/pricing.ts` gets real
    numbers, and the contact CTA points at `hello@glowa.bg`, which has to
    actually exist before launch.
