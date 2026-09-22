"use server";

import { getTranslations } from "next-intl/server";

import { getAssistantProvider } from "@/lib/ai";
import type { AssistantMessage } from "@/lib/ai";
import { requireMembership } from "@/lib/actions/guard";
import { pickLocalized } from "@/lib/localized";
import type { Locale } from "@/i18n/routing";

export type AssistantResult =
  | { ok: true; text: string }
  | { ok: false; code: "unavailable" | "generic" | "not_a_member" | "unauthenticated" };

/**
 * Builds the aggregate context and calls the provider. Everything here runs on
 * the server: the key never leaves it, and the payload is metrics plus the
 * public service list — no client rows are read at all.
 */
export async function askAssistant(input: {
  businessId: string;
  locale: Locale;
  messages: AssistantMessage[];
}): Promise<AssistantResult> {
  const provider = getAssistantProvider();
  if (!provider) return { ok: false, code: "unavailable" };

  const guard = await requireMembership(input.businessId, "member");
  if (!guard.ok) {
    return {
      ok: false,
      code: guard.code === "unauthenticated" ? "unauthenticated" : "not_a_member",
    };
  }

  const history = input.messages.slice(-8);
  if (history.length === 0) return { ok: false, code: "generic" };

  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [{ data: business }, { data: metrics }, { data: services }, { count: staffCount }] =
    await Promise.all([
      guard.supabase
        .from("businesses")
        .select("name, currency, timezone, default_locale")
        .eq("id", input.businessId)
        .maybeSingle(),
      guard.supabase
        .rpc("get_business_dashboard", {
          p_business_id: input.businessId,
          p_from: from.toISOString(),
          p_to: to.toISOString(),
        })
        .maybeSingle(),
      guard.supabase
        .from("services")
        .select("name, duration_minutes, price_cents")
        .eq("business_id", input.businessId)
        .eq("is_active", true)
        .limit(50),
      guard.supabase
        .from("staff_profiles")
        .select("id", { count: "exact", head: true })
        .eq("business_id", input.businessId)
        .eq("is_bookable", true),
    ]);

  if (!business) return { ok: false, code: "generic" };

  const t = await getTranslations({ locale: input.locale, namespace: "admin.dashboard" });

  const reply = await provider.complete({
    context: {
      businessName: business.name,
      currency: business.currency,
      timezone: business.timezone,
      locale: input.locale,
      rangeLabel: t("range.month"),
      metrics: (metrics ?? {}) as Record<string, number | null>,
      services: (services ?? []).map((service) => ({
        name: pickLocalized(service.name, input.locale),
        durationMinutes: service.duration_minutes,
        priceCents: service.price_cents,
      })),
      staffCount: staffCount ?? 0,
    },
    messages: history,
  });

  return reply.ok ? { ok: true, text: reply.text } : { ok: false, code: reply.code };
}
