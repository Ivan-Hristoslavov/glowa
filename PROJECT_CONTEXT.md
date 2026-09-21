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
| Prompt 2 | Customer experience: discovery, booking, profile, calendar | Not started |
| Prompt 3 | Business app: dashboard, calendar, staff, services, CRM, marketing | Not started |
| Prompt 4 | Integrations, AI, growth layer | Not started |
| Prompt 5 | Production polish, QA, Vercel | Not started |

Verified at the end of Prompt 1: `npm run lint`, `npm run typecheck` and
`npm run build` all pass; the app renders in bg/en/ro, light and dark; the
Supabase security advisor reports no warnings.

---

## 2. Stack

- **Next.js 16.3.5** (App Router, Turbopack, `typedRoutes: true`)
- **React 19.2**, **TypeScript strict**
- **Tailwind CSS v4** (CSS-first config; no `tailwind.config.*`)
- **shadcn/ui** — `radix-nova` style, Radix primitives, Lucide icons
- **next-intl 4** for routing and messages
- **Supabase** — Postgres, Auth, RLS, Storage (Storage unused so far)
- `next-themes`, `zod` v4, `date-fns` + `@date-fns/tz`

### Next.js 16 specifics that differ from older training data

- `middleware.ts` is **renamed to `proxy.ts`** and exports `proxy`. Ours lives at
  `src/proxy.ts` and composes next-intl routing with Supabase session refresh.
- Route props come from generated globals: `PageProps<"/[locale]/login">`,
  `LayoutProps<"/[locale]">`. Regenerate with `npx next typegen` after adding routes.
- `params` and `searchParams` are promises.
- There is no `src/app/layout.tsx`: `src/app/[locale]/layout.tsx` is the root
  layout (it renders `<html>`/`<body>`), which is the documented next-intl setup.
  `src/app/not-found.tsx` therefore renders its own document.

---

## 3. Folder structure

```
src/
  app/
    [locale]/
      layout.tsx            root layout: fonts, theme, NextIntlClientProvider
      not-found.tsx
      (marketing)/          public surface — header + footer chrome
        layout.tsx
        page.tsx            landing page
      (auth)/               signed-out surface — centred card chrome
        layout.tsx
        actions.ts          signIn / signUp / signOut server actions
        login/page.tsx
        signup/page.tsx
      (customer)/           signed-in customer surface
        layout.tsx
        profile/page.tsx
    auth/
      confirm/route.ts      email OTP landing (locale-independent)
      signout/route.ts
    not-found.tsx           document-level fallback outside any locale
    globals.css             GLOWA design tokens
  components/
    auth/                   auth form (client)
    brand/                  GlowaMark, GlowaLogo
    layout/                 site header/footer, locale switcher, theme toggle
    ui/                     shadcn primitives (generated — edit deliberately)
    theme-provider.tsx
  i18n/
    routing.ts              locales, default, prefix strategy, currency map
    request.ts              per-request messages + timezone
    navigation.ts           locale-aware Link / router / redirect
  lib/
    env.ts                  zod-validated public env; lazy server secrets
    supabase/
      client.ts             browser client (publishable key, RLS applies)
      server.ts             request-scoped server client + getVerifiedClaims
      proxy.ts              session refresh for src/proxy.ts
      admin.ts              service-role client, `server-only`
    utils.ts                cn()
  types/database.ts         generated from the live schema
  proxy.ts                  i18n + session refresh + route protection
messages/                   bg.json · en.json · ro.json
supabase/
  migrations/               the schema, in order
  seed.sql                  demo content (all rows flagged is_demo)
```

Domain boundary rule: a surface owns its chrome and its server actions; shared
logic goes to `src/lib`, shared visuals to `src/components`. The marketing,
customer and business surfaces share one component language but keep their own
information hierarchy.

---

## 4. Design system

Tokens live in `src/app/globals.css`. Brand values are `--glowa-*`; every
semantic token (`--primary`, `--card`, …) is derived from them, so re-palletting
touches one block. Dark mode is a designed theme, not an inversion.

| Role | Light | Dark |
| --- | --- | --- |
| canvas | `#F8F3EE` | `#0B0E0E` |
| surface | `#FFFFFF` | `#121616` |
| ink / text | `#0F1212` | `#F7F2ED` |
| accent (CTA) | `#D96C61` | `#EF8E83` |
| soft / chips | `#EAC2BB` | `#4A3330` |
| sage | `#A9B6A6` | `#344238` |
| line | `#DDD5CE` | `#26302F` |

- **Type**: Inter for all UI (`--font-sans`), loaded with `latin`, `latin-ext`,
  `cyrillic` and `cyrillic-ext`. Noto Serif Display is the editorial display
  face, opt-in through `.font-heading` only — body copy stays in the sans so
  Bulgarian and Romanian remain highly legible.
- **Radius**: `--radius: 0.875rem` (14px controls); cards use `rounded-xl` (~20px).
- **Shadows**: `--shadow-card / -lift / -pop`, soft and layered.
- **Utilities**: `glowa-card`, `glowa-focus`.
- **Motion**: `--ease-glowa` spring-ish easing; a global `prefers-reduced-motion`
  guard disables animation.
- **Logo**: `GlowaMark` / `GlowaLogo` in `src/components/brand/`. Geometric G,
  stroke-based so it holds at 16px, with the lower-left sweep in coral.
  `monochrome` prop for favicon, print and on-image use. Wordmark is always
  lowercase `glowa`; tagline `BEAUTY MOVES PEOPLE`.

**Not yet done (Prompt 2+):** generated hero photography, category imagery, the
custom illustration family, empty-state art, favicon/app icon export. No
generated assets exist yet, so `public/` still holds the create-next-app SVGs;
they are unused by any page and get deleted when the real asset set lands.

---

## 5. Internationalisation

- Locales `bg` (default), `en`, `ro`; `localePrefix: "always"`, so every URL is
  `/{locale}/…` and hreflang/canonical stay unambiguous.
- Messages in `messages/{locale}.json`. No hard-coded UI strings.
- `Link`, `useRouter`, `redirect` come from `@/i18n/navigation`, never from
  `next/link` or `next/navigation`, inside localized routes.
- Business-authored content (service names, descriptions, staff titles) is
  stored as `jsonb` shaped `{"bg": …, "en": …, "ro": …}` and validated by
  `app.is_localized_text`. `services.name` must contain at least `bg`.
- Default timezone `Europe/Sofia`, per-business and per-profile overridable.
- Currency per locale is mapped in `i18n/routing.ts`; the business's own
  currency always wins for prices.

---

## 6. Data model

Fifteen public tables plus one private one. Money is integer minor units.
Times are `timestamptz`.

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

- **`business_clients` is separate from `profiles`.** A salon's CRM record —
  notes, tags, spend, consent — belongs to the salon. It never grants access to
  the person's global GLOWA profile, and it works for walk-ins with no account.
- **Double-booking is prevented by the database**, not by application code:
  `appointments_no_staff_overlap` is a GiST exclusion constraint over
  `(staff_profile_id, tstzrange(starts_at, ends_at))` for pending and confirmed
  rows. Two concurrent bookings cannot both win.
- **Customers cannot dictate booking facts.** `app.enforce_customer_booking_fields`
  runs BEFORE INSERT/UPDATE: for a non-member it derives `business_id`,
  `price_cents`, `currency` and `ends_at` from the service, forces
  `status = 'pending'`, and on update allows nothing but cancelling their own
  pending/confirmed appointment.
- **Reviews are GLOWA's own.** External provider reviews are never copied in;
  `businesses.google_review_url` is a link-out, and `review_invitations` records
  who was asked without claiming to know Google's state.
- **OAuth tokens live in `private.calendar_credentials`**, a schema with no
  grants to `anon`/`authenticated` at all. `external_calendar_connections` holds
  only the non-secret connection metadata.
- **`is_demo`** on businesses, appointments, clients, reviews, payments and
  campaigns. Demo rows are filterable and deletable in one statement.
- **Status history and audit logs are append-only** for clients: written by
  SECURITY DEFINER triggers, and `INSERT/UPDATE/DELETE` is revoked from
  `authenticated`.

### Authorization

`app` (a non-exposed schema) holds the SECURITY DEFINER helpers that policies
call: `is_business_member`, `has_business_role`, `is_business_manager`,
`is_business_admin`, `is_business_public`, `business_of_{location,staff,service,
appointment}`, `owns_appointment`, `owns_calendar_connection`. They are SECURITY
DEFINER so a policy on `business_members` can ask "is this user a member?"
without recursing; each checks `auth.uid()` itself, `EXECUTE` is revoked from
`PUBLIC` and granted explicitly.

Policy shape throughout: `TO authenticated` **plus** an ownership or membership
predicate, `(select auth.uid())` for the initplan, and both `USING` and
`WITH CHECK` on updates. Write policies are split per action so they do not add
a second permissive SELECT policy.

`anon` has `SELECT` on exactly eight relations — `businesses`, `locations`,
`business_hours`, `staff_profiles`, `staff_working_hours`, `services`,
`service_staff`, `reviews` — and nothing else; default privileges for `anon` on
new tables are revoked, so a new table starts closed.

### Migrations

| File | Contents |
| --- | --- |
| `20260921120000_extensions_enums_helpers.sql` | pgcrypto, btree_gist, `app`/`private` schemas, 16 enums, shared helpers |
| `20260921120100_core_schema.sql` | profiles, businesses, members, locations, hours, staff, services |
| `20260921120200_bookings_and_engagement.sql` | appointments, CRM, preferences, reviews, payments, calendars, marketing, audit |
| `20260921120300_rls_and_grants.sql` | RLS helpers, integrity triggers, all policies, Data API grants |
| `20260921120400_policy_and_index_tuning.sql` | split write policies, review edit guard, FK covering indexes |
| `20260921120500_anon_grant_lockdown.sql` | reduce `anon` to the public discovery tables |

Every schema change is a migration committed here. Regenerate types afterwards
with `npm run db:types`.

---

## 7. Auth

- Email + password today. The `on_auth_user_created` trigger creates the
  matching `profiles` row (including for future OAuth sign-ups).
- **Server code identifies the caller with `supabase.auth.getClaims()`**, never
  `getSession()`: `getClaims` verifies the JWT signature. `getVerifiedClaims()`
  and `getCurrentUserId()` in `lib/supabase/server.ts` wrap it.
- `src/proxy.ts` refreshes the session on every matched request, then gates
  `/dashboard`, `/profile`, `/bookings`, `/favorites`, `/settings` and bounces
  signed-in users away from `/login` and `/signup`. Pages re-check server-side;
  the proxy is a convenience, not the security boundary.
- Sign-up confirmation links land on `/auth/confirm`, outside the locale
  segment. Both redirect targets reject anything that is not a same-origin
  relative path.

---

## 8. Environment variables

Public (safe in the browser):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`NEXT_PUBLIC_SITE_URL`.

Server-only (never `NEXT_PUBLIC_`, never committed):
`SUPABASE_SECRET_KEY`, `OPENAI_API_KEY`, `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`.

`.env.example` documents all of them by name. `.env.local` is gitignored. The
separate Supabase database password mentioned in the brief is deliberately not
stored anywhere in this repository.

---

## 9. Demo data

`supabase/seed.sql` creates three invented salons (`demo-hair-lab-sofia`,
`demo-black-scissors`, `demo-bloom-nails`) with locations, opening hours, staff
and services. Every row carries `is_demo = true` and every slug starts with
`demo-`. It has been applied to the development project. It is re-runnable
(fixed UUIDs + `on conflict do nothing`) and removable with
`delete from public.businesses where is_demo;`.

No number shown anywhere in the product may be derived from demo data, and no
traction claim ("1,000 businesses", "50,000 bookings", "4.9/5") may appear
unless it is real.

---

## 10. Known TODOs for the next prompts

1. **Prompt 2** — search/discovery, business profile pages, the booking flow,
   customer profile area, Google Calendar "add to calendar", review submission.
   Add a server-side availability calculation and a booking RPC that layers
   policy checks (lead time, advance window, opening hours, time off) on top of
   the exclusion constraint.
2. The marketing pages currently render dynamically because `SiteHeader` reads
   auth state. Split the auth-dependent part into a client island (or a
   `<Suspense>` boundary) so the landing page can be static.
3. Password reset is not implemented; the "forgot password" link is a
   placeholder pointing at `/login`.
4. `pricing`, `business/[slug]`, `bookings`, `favorites`, `settings` and the
   whole `(business)/dashboard` tree from the brief's route map do not exist yet.
5. No tests yet. Prompt 5 asks for tests on critical booking logic; the
   exclusion constraint and the booking triggers are the first things to cover.
6. Supabase CLI installed locally is **v2.26.9**, older than `supabase db query`
   (needs 2.79+) and `supabase db advisors` (needs 2.81.3+). Schema work in this
   session went through the Supabase MCP server instead. `brew upgrade supabase`
   when convenient.
7. No Storage buckets yet — needed for business media and generated assets.
8. `public/*.svg` are leftover create-next-app assets; delete them with the
   first real asset drop.
