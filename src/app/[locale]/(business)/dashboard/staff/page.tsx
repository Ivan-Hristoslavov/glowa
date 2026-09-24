import { Info, Pencil, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/admin/page-header";
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
import { cn } from "@/lib/utils";
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
    <div className="space-y-8">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          editable ? (
            <>
              {canAdminister(membership.role) ? (
                <InviteMemberDialog businessId={membership.businessId} />
              ) : null}
              <AddStaffButton businessId={membership.businessId} />
            </>
          ) : null
        }
      />

      {workspace.staff.length === 0 ? (
        <EmptyState icon={Sparkles} title={t("empty")} body={t("emptyBody")} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
              <li
                key={member.id}
                className="glowa-card hover:shadow-lift flex flex-col gap-4 rounded-2xl p-5 transition-shadow duration-300"
              >
                <div className="flex items-start gap-4">
                  <span className="rounded-2xl p-0.5" style={{ boxShadow: `0 0 0 2px ${member.color}` }}>
                    <Avatar className="size-16 rounded-[0.9rem]">
                      {member.avatar_url ? (
                        <AvatarImage src={member.avatar_url} alt="" className="object-cover" />
                      ) : null}
                      <AvatarFallback
                        className="font-heading rounded-[0.9rem] text-2xl"
                        style={{ backgroundColor: `${member.color}22`, color: member.color }}
                      >
                        {member.display_name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-heading truncate text-lg">{member.display_name}</p>
                    <p className="text-muted-foreground truncate text-sm">
                      {pickLocalized(member.title, activeLocale) || "—"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
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
                        <Button variant="ghost" size="icon" className="rounded-full" aria-label={t("save")}>
                          <Pencil className="size-4" />
                        </Button>
                      }
                    />
                  ) : null}
                </div>

                {/* The week at a glance: which days, and when. */}
                <div className="grid grid-cols-7 gap-1 border-t pt-4">
                  {[1, 2, 3, 4, 5, 6, 0].map((day) => {
                    const row = hours.find((entry) => entry.day_of_week === day);
                    return (
                      <div
                        key={day}
                        className={cn(
                          "flex flex-col items-center gap-0.5 rounded-lg px-0.5 py-1.5 text-center",
                          row ? "bg-muted/60" : "opacity-40",
                        )}
                        title={row ? `${row.starts_at.slice(0, 5)}–${row.ends_at.slice(0, 5)}` : undefined}
                      >
                        <span className="text-[0.65rem] font-medium uppercase">
                          {weekdays(String(day)).slice(0, 2)}
                        </span>
                        <span className="text-muted-foreground text-[0.6rem] leading-tight tabular-nums">
                          {row ? (
                            <>
                              {row.starts_at.slice(0, 5)}
                              <br />
                              {row.ends_at.slice(0, 5)}
                            </>
                          ) : (
                            "—"
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
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
