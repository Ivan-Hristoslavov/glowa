import { Lock } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { BusinessMediaForm } from "@/components/admin/business-media-form";
import { BusinessSettingsForm } from "@/components/admin/business-settings-form";
import { SubscriptionCard } from "@/components/admin/subscription-card";
import { EmptyState } from "@/components/common/empty-state";
import { Section } from "@/components/common/section";
import { routing, type Locale } from "@/i18n/routing";
import { isLocalizedText } from "@/lib/localized";
import { canAdminister, getActiveMembership } from "@/lib/queries/business";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav");
  return { title: t("settings"), robots: { index: false, follow: false } };
}

export default async function BusinessSettingsPage({
  params,
}: PageProps<"/[locale]/dashboard/settings">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("admin.nav");
  const staff = await getTranslations("admin.staff");
  const media = await getTranslations("admin.media");

  const membership = await getActiveMembership();
  if (!membership) return null;

  if (!canAdminister(membership.role)) {
    return (
      <EmptyState
        icon={Lock}
        title={staff("permissions")}
        body={staff("permissionsBody")}
      />
    );
  }

  const supabase = await createClient();
  const { count: staffCount } = await supabase
    .from("staff_profiles")
    .select("id", { count: "exact", head: true })
    .eq("business_id", membership.businessId)
    .eq("is_bookable", true);
  const { data: business } = await supabase
    .from("businesses")
    .select(
      "name, phone, email, website, google_review_url, description, booking_policy, logo_url, cover_image_url, gallery",
    )
    .eq("id", membership.businessId)
    .maybeSingle();

  if (!business) return null;

  const policy =
    typeof business.booking_policy === "object" &&
    business.booking_policy !== null &&
    !Array.isArray(business.booking_policy)
      ? (business.booking_policy as Record<string, unknown>)
      : {};
  const description = isLocalizedText(business.description) ? business.description : {};

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl sm:text-3xl">{t("settings")}</h1>

      <Section title={media("title")} description={media("subtitle")}>
        <div className="glowa-card rounded-3xl p-4 sm:p-6">
          <BusinessMediaForm
            businessId={membership.businessId}
            businessName={business.name}
            initial={{
              logoUrl: business.logo_url,
              coverUrl: business.cover_image_url,
              gallery: Array.isArray(business.gallery)
                ? business.gallery.filter((entry): entry is string => typeof entry === "string")
                : [],
            }}
          />
        </div>
      </Section>

      <Section title={membership.name}>
        <BusinessSettingsForm
          businessId={membership.businessId}
          initial={{
            name: business.name,
            phone: business.phone ?? "",
            email: business.email ?? "",
            website: business.website ?? "",
            googleReviewUrl: business.google_review_url ?? "",
            description: Object.fromEntries(
              routing.locales.map((value) => [value, description[value] ?? ""]),
            ) as Record<Locale, string>,
            cancellationWindowHours: Number(policy.cancellation_window_hours ?? 24),
            minLeadMinutes: Number(policy.min_lead_minutes ?? 60),
            maxAdvanceDays: Number(policy.max_advance_days ?? 90),
            allowCustomerReschedule: policy.allow_customer_reschedule !== false,
          }}
        />
      </Section>

      <SubscriptionCard staffCount={staffCount ?? 1} />
    </div>
  );
}
