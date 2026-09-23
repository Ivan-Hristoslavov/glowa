import { QrCode } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { GrowthLinkCard, type GrowthLinkView } from "@/components/admin/growth-link-card";
import { GrowthLinkCreator } from "@/components/admin/growth-link-creator";
import { EmptyState } from "@/components/common/empty-state";
import type { Locale } from "@/i18n/routing";
import { publicEnv } from "@/lib/env";
import { growthLinkUrl, renderQrSvg } from "@/lib/growth/qr";
import { pickLocalized } from "@/lib/localized";
import {
  canManage,
  getActiveMembership,
  getBusinessWorkspace,
  listBusinessClients,
  listGrowthLinks,
} from "@/lib/queries/business";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.growth");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function GrowthPage({
  params,
}: PageProps<"/[locale]/dashboard/growth">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("admin.growth");
  const membership = await getActiveMembership();
  if (!membership) return null;

  const activeLocale = locale as Locale;
  const [links, workspace, clients] = await Promise.all([
    listGrowthLinks(membership.businessId),
    getBusinessWorkspace(membership.businessId),
    listBusinessClients(membership.businessId),
  ]);

  const editable = canManage(membership.role);

  // The QR is encoded on the server: the encoder is a print concern, not
  // something every visitor to the dashboard should download.
  const views: GrowthLinkView[] = await Promise.all(
    links.map(async (link) => {
      const url = growthLinkUrl(
        publicEnv.NEXT_PUBLIC_SITE_URL,
        activeLocale,
        link.code,
      );
      return {
        id: link.id,
        code: link.code,
        kind: link.kind,
        label: link.label,
        target: link.target,
        isActive: link.is_active,
        visitCount: link.visit_count,
        bookingCount: link.booking_count,
        serviceName: link.services
          ? pickLocalized(link.services.name, activeLocale)
          : null,
        referrerName: link.business_clients?.full_name ?? null,
        url,
        qrSvg: await renderQrSvg(url),
      };
    }),
  );

  const services = (workspace?.services ?? []).map((service) => ({
    id: service.id,
    label: pickLocalized(service.name, activeLocale),
  }));

  const clientOptions = clients
    .filter((client) => client.full_name)
    .map((client) => ({ id: client.id, label: client.full_name as string }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl">{t("title")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
        </div>
        {editable ? (
          <GrowthLinkCreator
            businessId={membership.businessId}
            services={services}
            clients={clientOptions}
          />
        ) : null}
      </div>

      <p className="text-muted-foreground border-border/70 bg-secondary/40 rounded-xl border p-4 text-sm">
        {t("privacyNote")}
      </p>

      {views.length === 0 ? (
        <EmptyState
          icon={QrCode}
          title={t("empty.title")}
          body={t("empty.body")}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {views.map((link) => (
            <GrowthLinkCard
              key={link.id}
              businessId={membership.businessId}
              link={link}
              editable={editable}
            />
          ))}
        </div>
      )}
    </div>
  );
}
