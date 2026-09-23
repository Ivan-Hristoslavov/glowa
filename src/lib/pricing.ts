import type { Locale } from "@/i18n/routing";

/**
 * GLOWA's own plans.
 *
 * The feature lists are real - every line maps to something that exists in the
 * product, and nothing here promises a capability that has not been built.
 *
 * The amounts are deliberately `null`. Publishing a price is a commercial
 * decision, not an implementation detail, and inventing one would put a number
 * in front of customers that nobody chose. Until `monthly` is filled in the
 * page says so plainly and asks for contact instead of showing a figure.
 *
 * To publish: set `monthly` (minor units, e.g. 4900 = 49.00) and `annualMonthly`
 * for each plan. Nothing else needs to change.
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
    monthly: null,
    annualMonthly: null,
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
    monthly: null,
    annualMonthly: null,
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
    monthly: null,
    annualMonthly: null,
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
