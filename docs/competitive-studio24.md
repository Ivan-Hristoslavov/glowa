# Studio24: the local incumbent, and how GLOWA beats it

First researched 2026-09-24, extended 2026-10-05 from studio24.bg (home page,
"for salons" and "salon software" pages, the booking terms in force since
14 March 2025), the App Store and Google Play listings of both its apps, and
public posts by salons and customers. Figures are Studio24's own claims or
third-party claims, marked as such; none is verified. Nothing in GLOWA's public
copy names Studio24.

## What they are

- On the market since 2019. They claim 3,400+ Bulgarian salons, 8 million+
  bookings and 200,000+ visitors a month. The customer app shows 4.9 from
  7,700 ratings on the App Store (4.9 from about 4,700 on Google Play); the
  salon app "Studio24 Pro" shows 4.5 from 80 ratings. Bulgarian, English and
  Russian; Bulgaria only. Operator: Beauty Partners OOD, Sofia.
- **The salon software is free.** Calendar, online booking, CRM (with import and
  export), stock, payroll, cash desk, reports, loyalty, vouchers, packages,
  last-minute promotions, waitlist, iframe, Google Reservations, email
  reminders - all at no charge. They charge for two things: **new clients they
  bring** (once, after the first visit) and **SMS / Viber** messages.
- The new-client fee is not published. Salons talk of "50% commission" (a
  Facebook group) and of paying €1,200 in commission in 30 days and then
  dropping to 272nd place when their paid promotion stopped (an Instagram
  reel). Unverified, but it says the ranking can be bought.
- Human onboarding: they build the salon's page, add the services, train the
  team and move data from other systems. Phone, chat and email support.
- A service × city landing page for hundreds of combinations - their main
  search traffic.
- Customers pay **at the salon only**; there is no online payment or deposit.

## What people dislike (the things to be better at)

**Customers** - their own terms of booking are the source:

| Rule (booking terms, 14.03.2025) | What it does to a customer |
| --- | --- |
| Cancel online only **more than 24 h** before; under 24 h the app refuses and the customer must phone the salon, with one change allowed and then nothing | A fixed rule for every salon, however small the booking, however early the notice |
| The account is **blocked** for cancelling outside the window, for two cancellations in a row *even in time*, for a no-show a salon reports, or for being unreachable | Cancelling at all is risky. A review (App Store, 2024, abridged): "They blocked my account for cancelling too many times … I contacted via email to request a cancellation … I received no answer … after a month or so, Studio 24 called me to ask why I didn't make it to that appointment." Their reply: accounts that "abuse specialists' time are blocked" |
| At most **3 active bookings** across salons; the same or a similar service in several salons less than **5 days** apart is refused | Protects their commission, not the customer. Nobody can compare two salons by trying both |
| The customer must answer questions from Studio24 within **3 working days** - did you go, what did you pay, how did you hear of the salon - or the account can be closed | They are measuring what to bill the salon. A 2023 news item (rns.bg): a customer who missed a massage got two emails threatening a block, then a phone call asking why |
| Compensation for a bad visit is a **discount for a salon you have not visited** | It is not a refund, and it steers people to new salons (new-client fees) |
| An account is mandatory; no deposit, so the customer is never asked for money - and the salon carries the no-show | |
| Page ships with pinch-zoom disabled (`user-scalable=no`) | Fails WCAG 1.4.4 for people who need to enlarge text |

**Salons**

- The software is free but the clients are not: every new client costs a
  share, and rank can be bought, so the biggest spenders sit on top.
- No protection against no-shows beyond blocking the customer afterwards.
- The Pro app (Material Design web view) is called "extremely unintuitive" in
  its own App Store reviews (translated from Bulgarian): "you can't tell a button
  from text, the menu is in a strange place, the text fields are scandalous, it
  looks like a web app not adapted to mobile - I'd recommend a rewrite and a
  redesign". The vendor's answer was that it follows Material Design.
- A salon's clients live in their system. Import and export exist; the lock-in
  is the traffic they bring, not the data.

## What that means for GLOWA

GLOWA cannot be "cheaper" - it charges €6-24 a month against €0. It cannot
match seven years of catalogue, traffic and back-office features either. So
the subscription has to buy something "free" does not, and the customer side
has to be visibly kinder than the incumbent's, because customers are what
the incumbent's marketplace is made of.

| Studio24 | GLOWA (shipped) |
| --- | --- |
| Earns when a *new* client arrives; ranking can be paid for | Earns only the flat fee, so the product is built around *returning* clients: rebook invitations with real free times (§8q), waitlist offers (§8j). No paid ranking, no other salons on a salon's page, 0% commission |
| 24 h rule for everybody, account blocked for cancelling | The salon sets its own window; **no blocking logic exists**; the rules are stated at the top of the booking page, before the first choice (10-05) |
| 3 active bookings, 5-day rule | No limit on active bookings |
| Calls and emails customers to audit visits | GLOWA does not phone customers. The booking page says so |
| No-shows handled by blocking and phoning | Deposits by card at booking, refunded automatically on time, paid into the salon's own Stripe account (§8l) |
| Compensation = a discount at a new salon | Nothing to compensate through us: a deposit is returned on timely cancellation |
| The value of the paid part is hard to see | The dashboard's "what GLOWA brought you" counts online bookings, returns after an invitation, waitlist refills and retained deposits from the salon's own diary (§8q) |
| Pinch-zoom disabled, list-heavy pages | Zoom works; photo-first salon pages; "free today and tomorrow" on the landing page |
| Clients are the platform's leverage | Clients are exportable at any time, and **now importable** from a CSV (10-05), so switching in is as easy as switching out |
| Bulgaria only | Bulgarian, English and Romanian, RON, Stripe for BG and RO |

## Shipped in the 10-05 pass

Found by using the live site at desktop, laptop (1366×768) and phone sizes as a
guest, a customer and a salon owner:

1. **Cookie notice** was a 250 px card that covered the hero search's submit
   button on a laptop and a third of the first screen on a phone. It is now a
   single slim strip with shorter copy; accept and decline keep equal weight.
2. **Focused chrome for tasks.** The booking funnel and salon onboarding sat
   under the full footer, including "Have a salon? Register it" - shown to a
   customer one tap from confirming and to a salon owner who was registering.
   New `(focus)` route group: same header, slim footer (legal links and the
   cookie choice only).
3. **Booking funnel:** the rules (cancellation window, "no blocking, no calls")
   at the top; a running summary beside the primary button (what you picked,
   where the thumb already is); services grouped under category headings;
   four time chips per row on a phone instead of three.
4. **Landing page:** a "booking that doesn't add to your worries" section for
   customers (the page spoke almost only to salons below the hero); the four
   featured salons now fill a four-column row instead of leaving one alone.
5. **Client import from CSV** (Clients → "Import from file"): reads UTF-8 and
   the Windows-1251 that Excel on a Bulgarian PC writes, detects `,` `;` and
   tab, recognises bg/en/ro headers, lets the owner fix the column mapping,
   previews before anything is saved, skips anyone already in the CRM (by
   email, by phone in any spelling, by bare name), records **no marketing
   consent**. Two answers added to the salon pitch's FAQ: bringing clients in
   and taking them out.

## Still missing against them (in priority order)

Customer side - these decide whether a first visit becomes a booking:

1. **Booking without a password.** An account (name, email, password) is
   required at the last step; Studio24 also requires one, so this is where to
   be better rather than equal. Options: an emailed one-time code (needs the
   Supabase OTP email template and Resend live, §11 item 26), or phone-number
   guest booking with a verified SMS/Viber code (needs the provider below).
   A guest insert is a new trust boundary - design RLS and rate limits first.
2. **Several services in one visit** (manicure + pedicure, cut + colour). The
   funnel books one service. Studio24 sells "smart multi-service booking" to
   large salons. Needs `book_appointment` to take a list and the slot search to
   chain durations.
3. **Service variants** (short / medium / long hair, each with its price and
   time). The most requested thing in a Bulgarian hair salon's price list.
4. **Viber / SMS reminders.** One provider contract, one `ChannelAdapter`
   (§8c). Studio24 charges for these; GLOWA can include them in the plan.
5. **A map in search**, and the salon's services shown on its result card.

Salon side - these decide whether a salon moves:

6. **A "we move you" onboarding** (a service, not code): build the salon's page
   and load its services, as Studio24 does by phone. The import (shipped)
   removes the data half.
7. **Service × city landing pages** (`/frizyor-sofia`) - their main source of
   traffic. Ours stop at `/search?place=`.
8. **Embeddable booking widget** for the salon's own site and Google
   Reservations. Stripe Checkout cannot be framed, so the widget has to hand
   the deposit step to the top window.
9. Vouchers, packages, loyalty, last-minute promotions. Stock, payroll and the
   cash desk (in Bulgaria the last one means a fiscal device) are not worth
   chasing yet.

Not code, but it is the whole game: **supply and proof.** They list 3,364
salons with reviews; GLOWA lists a handful of demo salons and, rightly, no
invented reviews. The first 50 real salons - brought by the import and a
personal onboarding - matter more than any feature above.

## Decision for the owner

The display font (Wix Madefor, chosen 09-24 to read like Fresha's Roobert)
applies **Bulgarian localised letterforms** under `lang="bg"`. In a UI at 13-15
px they make "вт" read as "Bm", "Екип" as "Ekun", "Отзиви" as "Om3uBu". That is
correct Bulgarian typography and the owner accepted it, but it is the first
thing a non-designer, and any customer over fifty, will notice. If it costs
bookings, `font-feature-settings: "locl" 0` on body text (keeping the local
forms in headings) is a one-line change.

## Sources

- https://studio24.bg/ru/usloviya-bronirovaniya (booking terms, in force 14.03.2025)
- https://studio24.bg/softuer-za-salon-za-krasota-pr157 (salon software and pricing)
- https://studio24.bg/dobavi
- https://apps.apple.com/bg/app/studio24-bg/id1548694962 (customer app: 4.9, 7.7k ratings)
- https://apps.apple.com/bg/app/studio24-pro/id1557213455 (salon app: 4.5, 80 ratings)
- https://play.google.com/store/apps/details?id=bg.studio24.studio24_pro
- https://rns.bg/studio24/ (2023: a customer's complaint about emails and calls)
- https://www.instagram.com/reel/DbOfDO0uDBR/
- https://www.facebook.com/groups/945063158991420/posts/3312654502232262/
