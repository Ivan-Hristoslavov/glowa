# Ready for testers: what was checked, what must be switched on

Checked 2026-10-05 against a local stack (Supabase in Docker, `next dev`,
Chromium at 1440×900 and 390×844) as a guest, a customer and a salon owner.

## What was exercised and passes

- **Every signed-in page** (16 owner pages, 5 customer pages) at desktop and phone
  size in bg, en and ro: HTTP 200, no console or page errors, no horizontal
  overflow. Landing, search, pricing, for-business and a service × town page too.
- **Sign-up inside the booking funnel** (name, email, password), then booking:
  the booking is saved, the confirmation email is queued and the worker sends it.
- **Forgot password**: request, branded Bulgarian email, link, new password,
  signed in. The link now works in a *different browser* from the one that asked
  (laptop asks, phone opens): the request uses the implicit flow, so the emailed
  `token_hash` is not tied to a code verifier cookie.
- **Team invitation**: the invitee now gets an email with a sign-up link; the
  owner is told whether it was sent; a second invite to the same address says so.
- **Client import** from a Windows-1251 CSV (see PROJECT_CONTEXT §8r).
- **Database**: `supabase test db` passes (booking invariants, deposits, rebook
  invitations, and the new auto-confirm and reminder tests).

## Fixed in this pass

| Found | Fix |
| --- | --- |
| Every online booking arrived **pending** and waited for the salon, while the site and the email said "confirmed" | Online bookings are confirmed on the spot; one that asks for a deposit stays pending until the deposit is paid, which now confirms it. Migration `20261005120000` |
| A booking made less than a day ahead got a "reminder" in the same minute as its confirmation | A reminder whose time has passed is not queued. Migration `20261005120100` |
| Auth emails (confirm, reset, invite) were Supabase's English defaults | Branded Bulgarian templates in `supabase/templates/`, wired in `config.toml` |
| A password-reset link only worked in the browser that asked | Implicit-flow client for the reset request |
| Inviting a stylist sent nothing; a failed invite showed the toast "Save" | Invitation email; real error messages |
| The AI assistant's empty state told a salon owner to "add OPENAI_API_KEY on the server" | Plain wording |
| The services page failed to render on the server ("Primitive.button failed to slot") | The edit trigger is built inside the client module |
| My translation helper turned a string key into a namespace and broke the invite label | Helper refuses to; label restored |

## Must be done before real people test (not code)

1. **Apply the two new migrations to the live database** (they are only applied
   locally): `20261005120000_auto_confirm_bookings.sql`,
   `20261005120100_reminder_not_in_the_past.sql`. Then `npm run db:types`.
2. **Supabase → Authentication**
   - URL configuration: site URL and `https://<domain>/**` redirect allow-list
     (otherwise email links point at localhost);
   - Emails: paste the five templates from `supabase/templates/` and their
     subjects (`config.toml` is local only);
   - decide whether "confirm email" is on. On: the funnel's sign-up says "check
     your email", and the time chosen is not restored after the click (known).
     Off is simpler for a first test;
   - turn on leaked-password protection (Auth → Sign In / Providers → Password
     security) and set the minimum password length to 8 (`config.toml` already
     says 8 locally);
   - **Sign in with Google / Apple** (buttons show up on their own once the
     provider is enabled; nothing to change in code):
     - Providers → add `https://<project-ref>.supabase.co/auth/v1/callback` as
       the redirect URI at the provider;
     - *Google*: Google Cloud Console → APIs & Services → Credentials → OAuth
       client (Web) → paste Client ID and Secret in Supabase → Google;
     - *Apple* (needs a paid Apple Developer account): create an App ID with
       "Sign in with Apple", a **Services ID** (this is the Client ID; set the
       domain and the Supabase callback above as return URL) and a **Sign in with
       Apple key**, then generate the client secret JWT from it. Apple secrets
       expire after at most 6 months - put a reminder in the calendar. Paste
       Services ID + secret in Supabase → Apple;
     - Apple may hand over a Private Relay address (`...@privaterelay.appleid.com`)
       and gives the name only on the first sign-in; reminder emails still reach
       the person only if the relay is allowed to send from Lavena's domain
       (Apple developer → Services → Configure email sources).
3. **Vercel environment**: `SUPABASE_SECRET_KEY`, `CRON_SECRET`, `RESEND_API_KEY`
   and `RESEND_FROM` (a sender on a domain you own - **without these no email is
   sent and bookings queue silently**), `NEXT_PUBLIC_SITE_URL`. For deposits and
   billing: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
   `STRIPE_BILLING_WEBHOOK_SECRET`. Optional: `OPENAI_API_KEY` (assistant,
   images), VAPID keys (push), and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` +
   `TURNSTILE_SECRET_KEY` (Cloudflare Turnstile, free: a captcha on sign-up,
   password reset and the support form; set both or neither).
3b. **Integrations** (`docs/integrations.md`): apply the two `20261008...`
   migrations to the live database. Nothing else to configure; the scheduled
   job that sends webhooks and refreshes calendar feeds is the existing
   `/api/cron/notifications` (same `CRON_SECRET`). Local only:
   `LAVENA_ALLOW_PRIVATE_FETCH=1` lets webhooks/feeds call localhost.
4. **Cron**: reminders need a per-minute schedule. Hobby only allows daily
   (`vercel.json` runs notifications at 07:00 UTC), so reminders and the "send
   now" second pass are late. Vercel Pro, or Supabase `pg_cron` + `pg_net`
   calling `/api/cron/notifications` and `/api/cron/payments` with the secret.
5. **Domain and name**: register `lavena.eu` (contacts already say
   `hello@lavena.eu`), set up the mailbox, check trademark.
6. **Legal entity** in `src/lib/legal/entity.ts`: company, EIK, VAT, address. The
   imprint prints "[предстои]" until then. Have a lawyer read `messages/legal/*`.
7. **Run a real test-mode deposit** end to end (Stripe test keys): book, pay,
   cancel in time, see the refund. It has been verified only against the
   database and signed test events.
8. Create the test salons through the real sign-up and onboarding, not the
   showcase seed (the seed is development-only).

## Known gaps a tester will notice

- Manual approval is no longer possible: every online booking is confirmed.
  A per-salon "I approve each booking" switch is the obvious follow-up.
- A salon closure does not notify customers with bookings inside it.
- Reminders go by email only; Viber/SMS has no provider.
- The funnel's inline sign-up, with confirmation emails on, loses the chosen time.
- Photographs and illustrations are the old art direction and the share card
  still shows the old logo (needs `OPENAI_API_KEY`).
- Charts' second colour and the calendar's staff colours were not re-validated
  after the move to lavender.
