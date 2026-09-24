import type { Locale } from "@/i18n/routing";

/**
 * GLOWA's own plans.
 *
 * The feature lists are real - every line maps to something that exists in the
 * product, and nothing here promises a capability that has not been built.
 *
 * Amounts were published on 2026-09-24 at the owner's request: three plans
 * for a small, a medium and a large business. Annual billing is ten months'
 * price for twelve. Nothing else in the product reads these numbers - billing
 * itself is not connected yet (see PROJECT_CONTEXT), and the dashboard says so
 * rather than implying anyone is being charged.
 *
 * To change a price: edit `monthly` / `annualMonthly` (minor units, e.g.
 * 2400 = 24.00). Setting every `monthly` back to null hides the figures and
 * the page falls back to "contact us".
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
    monthly: 900,
    annualMonthly: 750,
    currency: "EUR",
    seats: 1,
    featured: false,
    features: [
      "onlineBooking",
      "calendar",
      "clients",
      "reminders",
      "reviewRequests",
      "publicProfile",
    ],
  },
  {
    id: "studio",
    monthly: 2400,
    annualMonthly: 2000,
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
    monthly: 4800,
    annualMonthly: 4000,
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
