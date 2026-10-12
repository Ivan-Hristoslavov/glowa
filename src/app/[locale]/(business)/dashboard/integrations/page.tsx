import { Lock } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ApiKeysPanel } from "@/components/admin/integrations/api-keys-panel";
import { EmbedPanel } from "@/components/admin/integrations/embed-panel";
import { FeedsPanel } from "@/components/admin/integrations/feeds-panel";
import { WebhooksPanel } from "@/components/admin/integrations/webhooks-panel";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { publicEnv } from "@/lib/env";
import { canAdminister, getActiveMembership, requireSection } from "@/lib/queries/business";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav");
  return { title: t("integrations"), robots: { index: false, follow: false } };
}

export default async function IntegrationsPage({
  params,
}: PageProps<"/[locale]/dashboard/integrations">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireSection(locale, "integrations");

  const t = await getTranslations("admin.integrations");
  const staffText = await getTranslations("admin.staff");

  const membership = await getActiveMembership();
  if (!membership) return null;

  if (!canAdminister(membership.role)) {
    return <EmptyState icon={Lock} title={staffText("permissions")} body={staffText("permissionsBody")} />;
  }

  const supabase = await createClient();
  const businessId = membership.businessId;

  const [{ data: business }, keys, endpoints, deliveries, feeds, staff] = await Promise.all([
    supabase.from("businesses").select("timezone").eq("id", businessId).maybeSingle(),
    supabase
      .from("api_keys")
      .select("id, name, key_prefix, scopes, created_at, last_used_at, revoked_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("webhook_endpoints")
      .select("id, url, description, events, is_active, consecutive_failures, disabled_reason, last_success_at")
      .eq("business_id", businessId)
      .order("created_at"),
    supabase
      .from("webhook_deliveries")
      .select("id, endpoint_id, event, status, attempts, last_status_code, last_error, created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("calendar_feeds")
      .select("id, name, staff_profile_id, last_synced_at, last_error, last_event_count")
      .eq("business_id", businessId)
      .order("created_at"),
    supabase
      .from("staff_profiles")
      .select("id, display_name")
      .eq("business_id", businessId)
      .order("sort_order")
      .order("display_name"),
  ]);

  const timezone = business?.timezone ?? "Europe/Sofia";
  const staffRows = staff.data ?? [];
  const staffName = new Map(staffRows.map((s) => [s.id, s.display_name]));

  return (
    <div className="space-y-10">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <EmbedPanel siteUrl={publicEnv.NEXT_PUBLIC_SITE_URL} slug={membership.slug} locale={locale} />

      <ApiKeysPanel
        businessId={businessId}
        siteUrl={publicEnv.NEXT_PUBLIC_SITE_URL}
        timezone={timezone}
        locale={locale}
        keys={(keys.data ?? []).map((key) => ({
          id: key.id,
          name: key.name,
          keyPrefix: key.key_prefix,
          scopes: key.scopes,
          createdAt: key.created_at,
          lastUsedAt: key.last_used_at,
          revokedAt: key.revoked_at,
        }))}
      />

      <WebhooksPanel
        businessId={businessId}
        timezone={timezone}
        locale={locale}
        endpoints={(endpoints.data ?? []).map((endpoint) => ({
          id: endpoint.id,
          url: endpoint.url,
          description: endpoint.description,
          events: endpoint.events,
          isActive: endpoint.is_active,
          consecutiveFailures: endpoint.consecutive_failures,
          disabledReason: endpoint.disabled_reason,
          lastSuccessAt: endpoint.last_success_at,
        }))}
        deliveries={(deliveries.data ?? []).map((delivery) => ({
          id: delivery.id,
          endpointId: delivery.endpoint_id,
          event: delivery.event,
          status: delivery.status,
          attempts: delivery.attempts,
          lastStatusCode: delivery.last_status_code,
          lastError: delivery.last_error,
          createdAt: delivery.created_at,
        }))}
      />

      <FeedsPanel
        businessId={businessId}
        timezone={timezone}
        locale={locale}
        staff={staffRows.map((s) => ({ id: s.id, name: s.display_name }))}
        feeds={(feeds.data ?? []).map((feed) => ({
          id: feed.id,
          name: feed.name,
          staffName: staffName.get(feed.staff_profile_id) ?? "—",
          lastSyncedAt: feed.last_synced_at,
          lastError: feed.last_error,
          lastEventCount: feed.last_event_count,
        }))}
      />
    </div>
  );
}
