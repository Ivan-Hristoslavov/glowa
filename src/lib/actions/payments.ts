"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { routing } from "@/i18n/routing";
import { requireMembership } from "@/lib/actions/guard";
import { createOnboardingLink, syncAccountStatus } from "@/lib/payments/connect";

const onboardingSchema = z.object({
  businessId: z.uuid(),
  locale: z.enum(routing.locales),
});

/**
 * Starts (or resumes) connecting the salon's Stripe account. Owners and
 * admins only: this decides where the salon's money goes.
 */
export async function startPaymentsOnboarding(
  input: z.input<typeof onboardingSchema>,
): Promise<{ ok: true; url: string } | { ok: false; code: string }> {
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };

  const guard = await requireMembership(parsed.data.businessId, "admin");
  if (!guard.ok) return guard;

  return createOnboardingLink(parsed.data.businessId, parsed.data.locale);
}

/** Re-reads the account from Stripe - after onboarding, or on demand. */
export async function refreshPaymentsAccount(input: {
  businessId: string;
}): Promise<{ ok: true } | { ok: false; code: string }> {
  const businessId = z.uuid().safeParse(input.businessId);
  if (!businessId.success) return { ok: false, code: "invalid" };

  const guard = await requireMembership(businessId.data, "admin");
  if (!guard.ok) return guard;

  // Read through RLS: an admin of this business can see its account row and
  // nobody else's, so the id cannot be swapped for another salon's.
  const { data: account } = await guard.supabase
    .from("business_payment_accounts")
    .select("account_id")
    .eq("business_id", businessId.data)
    .maybeSingle();
  if (!account) return { ok: false, code: "not_connected" };

  try {
    await syncAccountStatus(account.account_id);
  } catch (cause) {
    console.error("payments: account refresh failed", cause);
    return { ok: false, code: "provider_error" };
  }

  revalidatePath("/[locale]/dashboard/payments", "page");
  return { ok: true };
}
