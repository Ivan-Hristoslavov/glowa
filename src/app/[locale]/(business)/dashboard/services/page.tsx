import { Clock, Pencil, Scissors } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import {
  AddServiceButton,
  ServiceEditor,
  type ServiceDraft,
} from "@/components/admin/service-editor";
import { EmptyState } from "@/components/common/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { routing, type Locale } from "@/i18n/routing";
import { formatDuration, formatPrice } from "@/lib/format";
import { isLocalizedText, pickLocalized } from "@/lib/localized";
import { canManage, getActiveMembership, getBusinessWorkspace } from "@/lib/queries/business";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.services");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** Widen a stored {bg,en,ro} jsonb into the editor's fully-populated shape. */
function toDraftText(value: unknown): Record<Locale, string> {
  const source = isLocalizedText(value) ? value : {};
  return Object.fromEntries(
    routing.locales.map((locale) => [locale, source[locale] ?? ""]),
  ) as Record<Locale, string>;
}

export default async function ServicesPage({
  params,
}: PageProps<"/[locale]/dashboard/services">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("admin.services");
  const categories = await getTranslations("serviceCategories");

  const membership = await getActiveMembership();
  if (!membership) return null;

  const workspace = await getBusinessWorkspace(membership.businessId);
  const activeLocale = locale as Locale;
  const editable = canManage(membership.role);
  const staff = workspace.staff.map((member) => ({
    id: member.id,
    displayName: member.display_name,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl sm:text-3xl">{t("title")}</h1>
        {editable ? (
          <AddServiceButton businessId={membership.businessId} staff={staff} />
        ) : null}
      </div>

      {workspace.services.length === 0 ? (
        <EmptyState icon={Scissors} title={t("empty")} body={t("emptyBody")} />
      ) : (
        <ul className="glowa-card divide-border/70 divide-y">
          {workspace.services.map((service) => {
            const assigned = (service.service_staff ?? []).map((row) => row.staff_profile_id);
            const draft: ServiceDraft = {
              id: service.id,
              name: toDraftText(service.name),
              description: toDraftText(service.description),
              category: service.category,
              durationMinutes: service.duration_minutes,
              bufferBeforeMinutes: service.buffer_before_minutes,
              bufferAfterMinutes: service.buffer_after_minutes,
              priceCents: service.price_cents,
              requiresDeposit: service.requires_deposit,
              depositCents: service.deposit_cents,
              isActive: service.is_active,
              staffIds: assigned,
            };

            return (
              <li
                key={service.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{pickLocalized(service.name, activeLocale)}</p>
                    <Badge variant="outline" className="font-normal">
                      {categories(service.category)}
                    </Badge>
                    {!service.is_active ? (
                      <Badge variant="secondary">{t("inactive")}</Badge>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 text-sm">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3.5" aria-hidden />
                      {formatDuration(service.duration_minutes, activeLocale)}
                    </span>
                    <span>
                      {formatPrice(service.price_cents, service.currency, activeLocale)}
                    </span>
                    {assigned.length === 0 ? (
                      <span className="text-primary">{t("noStaffAssigned")}</span>
                    ) : (
                      <span>{assigned.length} ×</span>
                    )}
                  </p>
                </div>

                {editable ? (
                  <ServiceEditor
                    businessId={membership.businessId}
                    staff={staff}
                    service={draft}
                    trigger={
                      <Button variant="outline" size="sm">
                        <Pencil className="size-4" aria-hidden />
                        {t("edit")}
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
