import type { Locale } from "@/i18n/routing";

/**
 * GLOWA's own plans.
 *
 * The feature lists are real - every line maps to something that exists in the
 * product, and nothing here promises a capability that has not been built.
 *
 * Pricing (chosen 2026-09-24 with the owner): win on volume, not margin. Solo is
 * free for good, a team costs less a month than one stylist costs on the big
 * platforms, and there is no commission anywhere - not on new clients, not on
 * deposits. See `docs/pricing.md` for the competitor figures behind this.
 *
 * Subscriptions are not billed yet: until `EARLY_ACCESS_UNTIL` everything is
 * free and the page says so. Amounts are minor units (1200 = 12.00).
 */
export type PlanId = "solo" | "studio" | "salon";

export type Plan = {
  id: PlanId;
  /** Minor units per month, or null while pricing is unpublished. */
  monthly: number | null;
  /** Effective monthly amount when billed yearly. */
  annualMonthly: number | null;
  currency: string;
  /** Seats included; null means unlimited. */
  seats: number | null;
  featured: boolean;
  /** Message keys under `pricing.features`, in display order. */
  features: string[];
};

export const PLANS: Plan[] = [
  {
    id: "solo",
    monthly: 0,
    annualMonthly: 0,
    currency: "EUR",
    seats: 1,
    featured: false,
    features: [
      "onlineBooking",
      "calendar",
      "clients",
      "deposits",
      "reminders",
      "reviewRequests",
      "publicProfile",
    ],
  },
  {
    id: "studio",
    monthly: 1200,
    annualMonthly: 1000,
    currency: "EUR",
    seats: 5,
    featured: true,
    features: [
      "everythingSolo",
      "teamCalendar",
      "staffHours",
      "campaigns",
      "analytics",
      "growthLinks",
      "multiLocation",
    ],
  },
  {
    id: "salon",
    monthly: 2400,
    annualMonthly: 2000,
    currency: "EUR",
    seats: null,
    featured: false,
    features: [
      "everythingStudio",
      "unlimitedStaff",
      "assistant",
      "roles",
      "auditLog",
      "priority",
    ],
  },
];

export const PRICING_IS_PUBLISHED = PLANS.some((plan) => plan.monthly !== null);

/** Until this date (inclusive) no plan is charged; the page says so. */
export const EARLY_ACCESS_UNTIL = "2027-02-28";

/**
 * The comparison the savings calculator draws. These are the *lowest* published
 * rates of a large marketplace platform on 2026-09-24 (per-seat subscription and
 * new-client commission; sources in `docs/pricing.md`), converted and rounded
 * down in their favour - so the saving shown is never overstated.
 */
export const TYPICAL_PLATFORM = {
  soloMonthlyCents: 1700,
  perSeatMonthlyCents: 1200,
  newClientCommission: 0.2,
  minCommissionCents: 500,
} as const;

/** GLOWA's monthly price for a team of this size. */
export function glowaMonthlyCents(seats: number, annual = false) {
  const plan =
    PLANS.find((item) => item.seats === null || seats <= item.seats) ?? PLANS[PLANS.length - 1];
  return (annual ? plan.annualMonthly : plan.monthly) ?? 0;
}

/** What the typical platform would charge a month, by the same inputs. */
export function typicalMonthlyCents(seats: number, newClients: number, averageCents: number) {
  const subscription =
    seats <= 1 ? TYPICAL_PLATFORM.soloMonthlyCents : seats * TYPICAL_PLATFORM.perSeatMonthlyCents;
  const perClient = Math.max(
    Math.round(averageCents * TYPICAL_PLATFORM.newClientCommission),
    TYPICAL_PLATFORM.minCommissionCents,
  );
  return subscription + newClients * perClient;
}

export function formatPlanPrice(
  amountMinor: number | null,
  currency: string,
  locale: Locale,
) {
  if (amountMinor === null) return null;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
  }).format(amountMinor / 100);
}
