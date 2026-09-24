import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ClosuresManager } from "@/components/admin/closures-manager";
import type { Locale } from "@/i18n/routing";
import { canManage, getActiveMembership } from "@/lib/queries/business";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav");
  return { title: t("timeOff"), robots: { index: false, follow: false } };
}

export default async function TimeOffPage({ params }: PageProps<"/[locale]/dashboard/time-off">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("admin.timeOff");
  const membership = await getActiveMembership();
  if (!membership) return null;

  const supabase = await createClient();
  const [{ data: business }, { data: locations }, { data: closures }] = await Promise.all([
    supabase.from("businesses").select("timezone").eq("id", membership.businessId).maybeSingle(),
    supabase
      .from("locations")
      .select("id, name")
      .eq("business_id", membership.businessId)
      .eq("is_active", true)
      .order("is_primary", { ascending: false }),
    supabase
      .from("business_closures")
      .select("id, starts_at, ends_at, reason, location_id")
      .eq("business_id", membership.businessId)
      .gt("ends_at", new Date().toISOString())
      .order("starts_at")
      .limit(100),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl sm:text-3xl">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>

      <ClosuresManager
        businessId={membership.businessId}
        timezone={business?.timezone ?? "Europe/Sofia"}
        locale={locale as Locale}
        locations={locations ?? []}
        canEdit={canManage(membership.role)}
        closures={(closures ?? []).map((row) => ({
          id: row.id,
          startsAt: row.starts_at,
          endsAt: row.ends_at,
          reason: row.reason,
          locationId: row.location_id,
        }))}
      />
    </div>
  );
}
