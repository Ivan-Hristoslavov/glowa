# glowa

A premium booking, CRM and growth platform for beauty professionals — built in
Bulgaria, designed for Europe. Bulgarian, English and Romanian from day one.

> **Working on this repo?** Read [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md)
> first. It holds the architecture, the data model, the design system and the
> current TODO list, and it is updated at the end of every work session.

## Requirements

- Node.js 22+
- A Supabase project
- Supabase CLI (optional locally; 2.81+ recommended)

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

The app runs at <http://localhost:3000> and redirects to `/bg`, `/en` or `/ro`
based on the `Accept-Language` header.

### Environment variables

| Name | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public | Publishable key; every request it makes is subject to RLS |
| `NEXT_PUBLIC_SITE_URL` | public | Absolute origin, used for auth redirects and OG metadata |
| `SUPABASE_SECRET_KEY` | **server only** | Service role. Bypasses RLS — server-side admin tasks only |
| `OPENAI_API_KEY` | **server only** | Visual asset generation and the AI assistant |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | **server only** | Google Calendar OAuth (Prompt 4) |

No secret value belongs in this repository, in generated documentation, or in
any `NEXT_PUBLIC_` variable.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check` | Lint + typecheck |
| `npm run db:types` | Regenerate `src/types/database.ts` from the live schema |

## Database

Migrations live in `supabase/migrations/` and are applied in filename order.
Every schema change is a migration committed to the repo — never a change made
by hand in the dashboard.

```bash
supabase link --project-ref <ref>
supabase db push          # apply migrations
psql "$DATABASE_URL" -f supabase/seed.sql   # optional demo content
```

`supabase/seed.sql` creates three invented demo salons. Every row is flagged
`is_demo = true` and every slug starts with `demo-`. Remove it all with:

```sql
delete from public.businesses where is_demo;
```

## What works today

- **Discovery** — full-text and trigram search over salons and their services,
  filtered by category and city.
- **Business profiles** — services, team, opening hours, policies, reviews and a
  clearly-labelled link out to the salon's own Google review page.
- **Booking** — location → service → specialist → date → time → confirm, with
  availability computed in Postgres from opening hours, staff hours, time off,
  buffers and the business's lead-time and advance-window policy.
- **Customer area** — bookings with cancel and reschedule, favourites, reviews,
  notification preferences, avatar upload, add-to-calendar.

## Security notes

- Row Level Security is enabled on every table. `anon` can read only the eight
  relations that back public discovery and execute exactly two read-only RPCs.
- Server code identifies the caller with `supabase.auth.getClaims()`, which
  verifies the JWT signature. `getSession()` must never gate access.
- Double-booking is prevented by a Postgres exclusion constraint, inside the
  inserting transaction — not by an application-level check.
- A customer cannot set a booking's price, duration, tenant or status: a BEFORE
  trigger derives them from the service.
- OAuth tokens live in the `private` schema, which no client role can reach.
