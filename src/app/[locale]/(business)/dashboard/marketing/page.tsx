import { Info, Megaphone } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { CampaignEditor, type CampaignDraft } from "@/components/admin/campaign-editor";
import { EmptyState } from "@/components/common/empty-state";
import { emptyStateArt } from "@/lib/brand-assets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { routing, type Locale } from "@/i18n/routing";
import { isLocalizedText } from "@/lib/localized";
import { canManage, getActiveMembership, listCampaigns } from "@/lib/queries/business";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.marketing");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function MarketingPage({
  params,
}: PageProps<"/[locale]/dashboard/marketing">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("admin.marketing");
  const membership = await getActiveMembership();
  if (!membership) return null;

  const campaigns = await listCampaigns(membership.businessId);
  const editable = canManage(membership.role);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl sm:text-3xl">{t("title")}</h1>
        {editable ? <CampaignEditor businessId={membership.businessId} /> : null}
      </div>

      <div className="border-border/70 bg-secondary/40 rounded-xl border p-4">
        <p className="flex items-start gap-2 text-sm font-medium">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("sendingDisabled")}
        </p>
        <p className="text-muted-foreground mt-2 text-sm">{t("sendingDisabledBody")}</p>
      </div>

      {campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          image={emptyStateArt.campaigns}
          title={t("empty")}
          body={t("emptyBody")}
        />
      ) : (
        <ul className="glowa-card divide-border/70 divide-y">
          {campaigns.map((campaign) => {
            const audience =
              typeof campaign.audience === "object" &&
              campaign.audience !== null &&
              !Array.isArray(campaign.audience)
                ? (campaign.audience as Record<string, unknown>)
                : {};
            const template =
              typeof campaign.template === "object" &&
              campaign.template !== null &&
              !Array.isArray(campaign.template)
                ? (campaign.template as Record<string, unknown>)
                : {};
            const subject = isLocalizedText(template.subject) ? template.subject : {};

            const draft: CampaignDraft = {
              id: campaign.id,
              name: campaign.name,
              type: campaign.type,
              lastVisitBeforeDays: String(audience.last_visit_before_days ?? ""),
              minVisits: String(audience.min_visits ?? ""),
              subject: Object.fromEntries(
                routing.locales.map((value) => [value, subject[value] ?? ""]),
              ) as Record<Locale, string>,
              body: typeof template.body === "string" ? template.body : "",
            };

            return (
              <li
                key={campaign.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{campaign.name}</p>
                  <p className="text-muted-foreground text-sm">
                    {t(`type.${campaign.type}`)}
                    {audience.last_visit_before_days
                      ? ` · ${t("lastVisitBefore")}: ${audience.last_visit_before_days}`
                      : null}
                  </p>
                </div>
                <Badge variant="outline" className="font-normal">
                  {t(`status.${campaign.status}`)}
                </Badge>
                {editable ? (
                  <CampaignEditor
                    businessId={membership.businessId}
                    campaign={draft}
                    trigger={
                      <Button variant="outline" size="sm">
                        {t("save")}
                      </Button>
                    }
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
