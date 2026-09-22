import { Info, Pencil, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { InviteMemberDialog } from "@/components/admin/invite-member-dialog";
import {
  AddStaffButton,
  StaffEditor,
  type StaffDraft,
} from "@/components/admin/staff-editor";
import { EmptyState } from "@/components/common/empty-state";
import { Section } from "@/components/common/section";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { routing, type Locale } from "@/i18n/routing";
import { isLocalizedText, pickLocalized } from "@/lib/localized";
import {
  canAdminister,
  canManage,
  getActiveMembership,
  getBusinessWorkspace,
} from "@/lib/queries/business";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.staff");
  return { title: t("title"), robots: { index: false, follow: false } };
}

function toDraftText(value: unknown): Record<Locale, string> {
  const source = isLocalizedText(value) ? value : {};
  return Object.fromEntries(
    routing.locales.map((locale) => [locale, source[locale] ?? ""]),
  ) as Record<Locale, string>;
}

export default async function StaffPage({ params }: PageProps<"/[locale]/dashboard/staff">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("admin.staff");
  const weekdays = await getTranslations("weekdays");

  const membership = await getActiveMembership();
  if (!membership) return null;

  const workspace = await getBusinessWorkspace(membership.businessId);
  const activeLocale = locale as Locale;
  const editable = canManage(membership.role);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl sm:text-3xl">{t("title")}</h1>
        {editable ? (
          <div className="flex gap-2">
            {canAdminister(membership.role) ? (
              <InviteMemberDialog businessId={membership.businessId} />
            ) : null}
            <AddStaffButton businessId={membership.businessId} />
          </div>
        ) : null}
      </div>

      {workspace.staff.length === 0 ? (
        <EmptyState icon={Sparkles} title={t("empty")} body={t("emptyBody")} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {workspace.staff.map((member) => {
            const hours = (member.staff_working_hours ?? [])
              .slice()
              .sort((a, b) => a.day_of_week - b.day_of_week);

            const draft: StaffDraft = {
              id: member.id,
              displayName: member.display_name,
              title: toDraftText(member.title),
              bio: toDraftText(member.bio),
              color: member.color,
              isBookable: member.is_bookable,
              workingHours: hours.map((row) => ({
                dayOfWeek: row.day_of_week,
                startsAt: row.starts_at.slice(0, 5),
                endsAt: row.ends_at.slice(0, 5),
              })),
            };

            return (
              <li key={member.id} className="glowa-card space-y-3 p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="size-11">
                    {member.avatar_url ? <AvatarImage src={member.avatar_url} alt="" /> : null}
                    <AvatarFallback
                      style={{ backgroundColor: `${member.color}22`, color: member.color }}
                    >
                      {member.display_name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{member.display_name}</p>
                    <p className="text-muted-foreground truncate text-sm">
                      {pickLocalized(member.title, activeLocale) || "—"}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {member.business_members ? (
                        <Badge variant="outline" className="font-normal">
                          {t(`role.${member.business_members.role}`)}
                        </Badge>
                      ) : null}
                      {!member.is_bookable ? (
                        <Badge variant="secondary">{t("bookable")}</Badge>
                      ) : null}
                    </div>
                  </div>
                  {editable ? (
                    <StaffEditor
                      businessId={membership.businessId}
                      member={draft}
                      trigger={
                        <Button variant="ghost" size="icon" aria-label={t("save")}>
                          <Pencil className="size-4" />
                        </Button>
                      }
                    />
                  ) : null}
                </div>

                <dl className="text-muted-foreground space-y-0.5 text-xs">
                  {hours.length === 0 ? (
                    <p>—</p>
                  ) : (
                    hours.map((row) => (
                      <div key={row.id} className="flex justify-between gap-3">
                        <dt>{weekdays(String(row.day_of_week))}</dt>
                        <dd>
                          {row.starts_at.slice(0, 5)}–{row.ends_at.slice(0, 5)}
                        </dd>
                      </div>
                    ))
                  )}
                </dl>
              </li>
            );
          })}
        </ul>
      )}

      <Section title={t("permissions")}>
        <p className="text-muted-foreground flex items-start gap-2 text-sm">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("permissionsBody")}
        </p>
      </Section>
    </div>
  );
}
