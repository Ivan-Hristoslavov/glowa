# Pricing

Chosen 2026-09-24 with the owner. Strategy: **low, flat price for volume** —
win salons on cost and on having no commission, not on margin per salon.

| Plan | Monthly | Yearly (per month) | Seats |
| --- | --- | --- | --- |
| Solo | €0, forever | €0 | 1 |
| Studio | €12 | €10 | up to 5 |
| Salon | €24 | €20 | unlimited |

Always: 0% commission (including clients who found the salon through GLOWA),
no GLOWA fee on deposits (Stripe's own fee only), no contract, CSV export.
Early access: nothing is billed until `EARLY_ACCESS_UNTIL` in `src/lib/pricing.ts`
(2027-02-28), and customers get 30 days' notice before billing starts.
Subscription billing is built (Stripe Checkout, the customer portal and a
webhook; PROJECT_CONTEXT §8n) and stays off until the Stripe keys are set. Solo
is free and never goes to checkout. Still to do before that date: plan limits
(seats per plan) and what happens when a subscription lapses.

## What the competition charged (checked 2026-09-24)

| Platform | Subscription | New-client commission | Source |
| --- | --- | --- | --- |
| Fresha | $19.95/mo (one person); $14.95/mo per team member | 20% of the first visit, min $6 | fresha.com/pricing |
| Booksy | £40/mo + £5 per extra staff | 30% of a Boost client's first visit, min £5 | booksy.com/biz/en-gb/pricing |
| Treatwell | ~€35/mo (NL) | 35% + VAT on new clients | treatwell.nl/en/partners/pricing, Treatwell partner care |
| Bookr (BG) | €29/mo solo; €19/mo per worker | — | bookr.credox.bg |
| Grafko (BG) | €50/mo (founder offer) | — | grafko.bg/for-vendors |

For comparison: a five-person salon on Fresha pays about $75 a month before any
commission; on GLOWA it pays €12.

## The savings calculator

`TYPICAL_PLATFORM` in `src/lib/pricing.ts` uses the lowest of these published
rates, converted to euros and rounded **in the competitor's favour** (€17 solo,
€12 per seat, 20% commission with a €5 minimum), and the page states those
assumptions under the result. Competitors are not named on the public page.
Re-check the figures before changing the copy; they move.
