import { Info, Megaphone, Pencil } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import Image from "next/image";

import { PageHeader } from "@/components/admin/page-header";
import { CampaignEditor, type CampaignDraft } from "@/components/admin/campaign-editor";
import { CampaignSendButton } from "@/components/admin/campaign-send-button";
import { EmptyState } from "@/components/common/empty-state";
import { emptyStateArt, featureArt } from "@/lib/brand-assets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { routing, type Locale } from "@/i18n/routing";
import { isLocalizedText } from "@/lib/localized";
import { availableChannels } from "@/lib/notifications/channels";
import {
  canManage,
  getActiveMembership,
  listCampaigns,
  listCampaignStats,
} from "@/lib/queries/business";

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
  const common = await getTranslations("common");
  const membership = await getActiveMembership();
  if (!membership) return null;

  const [campaigns, stats] = await Promise.all([
    listCampaigns(membership.businessId),
    listCampaignStats(membership.businessId),
  ]);
  const editable = canManage(membership.role);
  // Whether this deployment can actually send, rather than a hard-coded claim.
  const canSend = availableChannels().includes("email");

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={editable ? <CampaignEditor businessId={membership.businessId} /> : null}
      />

      <div className="border-border/70 bg-secondary/40 flex items-start gap-4 rounded-2xl border p-4">
        <Image
          src={featureArt.growth}
          alt=""
          width={72}
          height={72}
          className="hidden size-16 shrink-0 rounded-lg object-cover sm:block"
        />
        <div>
          <p className="flex items-start gap-2 text-sm font-medium">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            {canSend ? t("sendingReady") : t("sendingDisabled")}
          </p>
          <p className="text-muted-foreground mt-2 text-sm">
            {canSend ? t("sendingReadyBody") : t("sendingDisabledBody")}
          </p>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          art={emptyStateArt.campaigns}
          title={t("empty")}
          body={t("emptyBody")}
        />
      ) : (
        <ul className="glowa-card divide-border/70 divide-y rounded-2xl">
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
            // Campaigns written before the body was localized stored it as a
            // plain string. Carry it into the default locale rather than
            // dropping the copy someone wrote.
            const body = isLocalizedText(template.body)
              ? template.body
              : typeof template.body === "string"
                ? { [routing.defaultLocale]: template.body }
                : {};

            const draft: CampaignDraft = {
              id: campaign.id,
              name: campaign.name,
              type: campaign.type,
              lastVisitBeforeDays: String(audience.last_visit_before_days ?? ""),
              minVisits: String(audience.min_visits ?? ""),
              subject: Object.fromEntries(
                routing.locales.map((value) => [value, subject[value] ?? ""]),
              ) as Record<Locale, string>,
              body: Object.fromEntries(
                routing.locales.map((value) => [value, body[value] ?? ""]),
              ) as Record<Locale, string>,
            };

            const campaignStats = stats.get(campaign.id) ?? null;

            return (
              <li
                key={campaign.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4"
              >
                <span className="bg-primary/12 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
                  <Megaphone className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{campaign.name}</p>
                  <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="bg-muted rounded-full px-2 py-0.5">
                      {t(`type.${campaign.type}`)}
                    </span>
                    {audience.last_visit_before_days ? (
                      <span className="bg-muted rounded-full px-2 py-0.5">
                        {t("audienceLapsed", { days: Number(audience.last_visit_before_days) })}
                      </span>
                    ) : null}
                    {audience.min_visits ? (
                      <span className="bg-muted rounded-full px-2 py-0.5">
                        {t("audienceMinVisits", { count: Number(audience.min_visits) })}
                      </span>
                    ) : null}
                  </div>
                </div>
                {campaignStats ? (
                  <p className="text-muted-foreground text-sm tabular-nums">
                    {t("delivered", {
                      sent: campaignStats.sent,
                      total:
                        campaignStats.sent +
                        campaignStats.queued +
                        campaignStats.failed,
                    })}
                  </p>
                ) : null}
                <Badge variant="outline" className="font-normal">
                  {t(`status.${campaign.status}`)}
                </Badge>
                {editable ? (
                  <>
                    <CampaignEditor
                      businessId={membership.businessId}
                      campaign={draft}
                      trigger={
                        <Button variant="outline" size="sm">
                          <Pencil className="size-3.5" aria-hidden />
                          {common("edit")}
                        </Button>
                      }
                    />
                    {campaign.status === "draft" ||
                    campaign.status === "scheduled" ? (
                      <CampaignSendButton
                        businessId={membership.businessId}
                        campaignId={campaign.id}
                        recipients={null}
                        disabled={!canSend}
                      />
                    ) : null}
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
