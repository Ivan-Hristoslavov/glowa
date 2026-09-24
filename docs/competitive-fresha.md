# Fresha: what people dislike, and what GLOWA does about it

Researched 2026-09-24 from salon-owner threads on Reddit (as collected by the
review sites below), Trustpilot, Capterra and Fresha's own brand guidelines.
Claims here are paraphrased from those sources; nothing in GLOWA's public copy
names Fresha.

## Design reference

- **Type.** Fresha pairs **Tartuffo** (emotive headlines) with **Roobert**
  (Displaay, 2018) for the interface, in Regular, SemiBold and Bold. Roobert
  ships Bulgarian localised forms, which is why Fresha's Bulgarian pages read
  native. It is a commercial face; GLOWA uses **Wix Madefor Display + Text**
  (OFL), chosen by rendering real Bulgarian screens in twelve Cyrillic families
  - the closest in feel, and it also switches to Bulgarian forms under
  `lang="bg"`.
- **Look.** Near-white canvas, soft colour washes, one centred promise, a
  single segmented search (what · where · when) with a black pill button,
  photo-first cards with a floating rating. GLOWA's landing now follows that
  grammar with its own coral and a lilac wash.

## What salon owners complain about

| Complaint | How often it comes up | GLOWA's answer |
| --- | --- | --- |
| **Fees changed under them.** Free core became per-team-member monthly fees (2025); "greedy", "deceptively expensive"; accept or lose calendar access | The dominant theme | A pricing decision, not code. Recommendation: publish prices, grandfather early salons in writing, never gate an existing calendar behind a new fee. |
| **~20% "new client" commission** on marketplace bookings, including clients who actually came from the salon's own Instagram or Google | Very common | GLOWA takes no commission (stated on the landing page as a promise). Attribution is explicit: QR/referral links say where a booking came from and credit only that salon (§8f). |
| **Can't take the client list with them**; the platform "retains control" of the data | Common | **Client export to CSV**, one click, managers and up (`/api/business/clients/export`, UTF-8 with BOM for Excel, formula-injection safe). |
| **Competitors one tap away** on the salon's own marketplace page | Common | A GLOWA salon page shows only that salon. No "similar salons nearby". |
| **Payouts held for weeks**, closed accounts never paid out, no phone support | Serious, UK-heavy | Deposits are direct charges on the salon's own Stripe account; GLOWA never holds funds (§8l). Support model is a business decision. |
| **Support behind a paywall**, email-only, slow | Common | Bulgarian-language support is promised on the landing page; needs an actual staffed channel before launch. |
| **Notes hard to reach**, "excessive clicking" in the calendar | Capterra | Calendar cards show a note icon; the details sheet shows client and internal notes inline. |
| **SMS reminder overage charges** | Capterra | Reminders go by email and web push today, at no per-message cost. SMS is not built. |
| **One-way calendar sync** | Capterra | Google two-way sync is designed (§8) but not built - a real gap. |
| **Glitches: shows "booked" when the salon is quiet** | Reddit | One availability source in Postgres (`get_available_slots`) with the exclusion constraint as the authority; tested. |
| **Listings created from scraped Google data** without the salon's consent | Reddit | GLOWA only lists businesses their owners created. |
| **Wrong localisation** (e.g. US holidays in the UK) | Reddit | Built for bg/en/ro with Bulgarian letterforms, EUR/RON, salon-timezone everywhere. |
| **Invalid cards accepted**, so no-show fees could never be charged | Reported | GLOWA takes the deposit *before* the booking is confirmed; there is nothing to chase later. |

## What they praise (keep it that way)

- "The interface is genuinely good", easy for clients to book.
- Deposits and no-show protection.
- Clients can cancel and reschedule themselves.
- Automated reminders reduce no-shows.

## Still to do from this list

1. Guest checkout (book with email/phone + one-time code, no account) - the
   biggest client-side friction every platform has.
2. Two-way Google Calendar sync.
3. SMS reminders, priced transparently if at all.
4. A written pricing and grandfathering policy on `/pricing`.
5. A staffed support channel behind the "Bulgarian support" promise.

## Sources

- [Fresha brand guidelines - typography](https://fresha.hypedev.23x.me/typography/)
- [Fonts In Use - Fresha](https://fontsinuse.com/uses/66929/fresha)
- [Sort The Clicks - Fresha reviews from Reddit](https://sorttheclicks.com/fresha-reviews-reddit/)
- [TimeTailor - Fresha Reddit & Trustpilot reviews](https://www.timetailor.com/timetailor-alternatives/fresha-reddit-reviews)
- [Capterra - Fresha reviews](https://www.capterra.com/p/142138/Shedul-com/reviews/)
- [Trustpilot - fresha.com](https://www.trustpilot.com/review/fresha.com)
- [Medium - The true cost of Fresha](https://medium.com/@asbaines/the-true-cost-of-fresha-276d6856bcc0)
