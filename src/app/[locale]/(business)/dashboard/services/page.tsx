import { Clock, Pencil, Repeat, Scissors, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import {
  AddServiceButton,
  ServiceEditor,
  type ServiceDraft,
} from "@/components/admin/service-editor";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { routing, type Locale } from "@/i18n/routing";
import { formatDuration, formatPrice } from "@/lib/format";
import { isLocalizedText, pickLocalized } from "@/lib/localized";
import { canManage, getActiveMembership, getBusinessWorkspace } from "@/lib/queries/business";
import { cn } from "@/lib/utils";

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

  const staffById = new Map(workspace.staff.map((member) => [member.id, member]));

  // Grouped by category, in the salon's own order; switched-off services sit
  // in their own group at the end instead of leading the menu.
  const groups = new Map<string, typeof workspace.services>();
  for (const service of workspace.services.filter((item) => item.is_active)) {
    const list = groups.get(service.category) ?? [];
    list.push(service);
    groups.set(service.category, list);
  }
  const inactive = workspace.services.filter((item) => !item.is_active);
  const sections = [
    ...[...groups.entries()].map(([category, services]) => ({
      key: category,
      title: categories(category),
      services,
    })),
    ...(inactive.length > 0
      ? [{ key: "__inactive", title: t("inactiveSection"), services: inactive }]
      : []),
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          editable ? <AddServiceButton businessId={membership.businessId} staff={staff} /> : null
        }
      />

      {workspace.services.length === 0 ? (
        <EmptyState
          icon={Scissors}
          title={t("empty")}
          body={t("emptyBody")}
          action={
            // The one thing to do on an empty page belongs in the middle of
            // it, not only in the corner.
            editable ? (
              <AddServiceButton businessId={membership.businessId} staff={staff} />
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-10">
          {sections.map(({ key, title, services }) => (
            <section key={key} className="space-y-4">
              <h2 className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-[0.14em] uppercase">
                {title}
                <span className="bg-muted text-foreground rounded-full px-2 py-0.5 text-[0.7rem] tracking-normal tabular-nums">
                  {services.length}
                </span>
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {services.map((service) => {
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
                    rebookAfterDays: service.rebook_after_days,
                  };
                  const description = pickLocalized(service.description, activeLocale);

                  return (
                    <li
                      key={service.id}
                      className={cn(
                        "glowa-card hover:shadow-lift group flex flex-col gap-4 rounded-2xl p-5 transition-shadow duration-300",
                        !service.is_active && "opacity-60",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <p className="font-heading text-lg leading-snug">
                            {pickLocalized(service.name, activeLocale)}
                          </p>
                          {description ? (
                            <p className="text-muted-foreground line-clamp-2 text-sm">{description}</p>
                          ) : null}
                        </div>
                        {editable ? (
                          <ServiceEditor
                            businessId={membership.businessId}
                            staff={staff}
                            service={draft}
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="shrink-0 rounded-full"
                                aria-label={t("edit")}
                              >
                                <Pencil className="size-4" aria-hidden />
                              </Button>
                            }
                          />
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-heading text-2xl leading-none tabular-nums">
                          {formatPrice(service.price_cents, service.currency, activeLocale)}
                        </span>
                        <span className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs">
                          <Clock className="size-3.5" aria-hidden />
                          {formatDuration(service.duration_minutes, activeLocale)}
                        </span>
                        {service.requires_deposit && service.deposit_cents > 0 ? (
                          <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs">
                            <ShieldCheck className="size-3.5" aria-hidden />
                            {formatPrice(service.deposit_cents, service.currency, activeLocale)}
                          </span>
                        ) : null}
                        {service.rebook_after_days ? (
                          <span className="bg-accent text-accent-foreground inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs">
                            <Repeat className="size-3.5" aria-hidden />
                            {t("rebookChip", { count: Math.round(service.rebook_after_days / 7) })}
                          </span>
                        ) : null}
                        {!service.is_active ? (
                          <Badge variant="secondary">{t("inactive")}</Badge>
                        ) : null}
                      </div>

                      <div className="mt-auto flex items-center justify-between gap-3 border-t pt-4">
                        {assigned.length === 0 ? (
                          <span className="text-primary text-xs">{t("noStaffAssigned")}</span>
                        ) : (
                          <span className="flex -space-x-2">
                            {assigned.slice(0, 5).map((id) => {
                              const member = staffById.get(id);
                              if (!member) return null;
                              return (
                                <Avatar key={id} className="border-card size-7 border-2" title={member.display_name}>
                                  {member.avatar_url ? (
                                    <AvatarImage src={member.avatar_url} alt={member.display_name} />
                                  ) : null}
                                  <AvatarFallback
                                    className="text-[0.65rem] font-semibold"
                                    style={{ backgroundColor: `${member.color}33`, color: member.color }}
                                  >
                                    {member.display_name.charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                              );
                            })}
                          </span>
                        )}
                        <span className="text-muted-foreground text-xs">
                          {t("staffCount", { count: assigned.length })}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
