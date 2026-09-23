import { CalendarSync, Info } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

import { PushToggle } from "@/components/common/push-toggle";
import { NotificationSettings } from "@/components/customer/settings-notifications";
import { PreferencesForm } from "@/components/customer/settings-preferences-form";
import { ProfileSettingsForm } from "@/components/customer/settings-profile-form";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/common/section";
import { Separator } from "@/components/ui/separator";
import { routing, type Locale } from "@/i18n/routing";
import Image from "next/image";

import { featureArt } from "@/lib/brand-assets";
import { isGoogleCalendarConnectable } from "@/lib/calendar";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function SettingsPage({ params }: PageProps<"/[locale]/settings">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("settings");

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (typeof userId !== "string") redirect(`/${locale}/login`);

  const [{ data: profile }, { data: preferences }, { data: notifications }, { data: connections }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, phone, locale, timezone, avatar_url")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("customer_preferences")
        .select("preferred_channel, reminder_lead_minutes, notes, accessibility_notes")
        .eq("profile_id", userId)
        .maybeSingle(),
      supabase
        .from("notification_preferences")
        .select("event_type, enabled")
        .eq("profile_id", userId)
        .is("business_id", null)
        .eq("channel", "email"),
      supabase
        .from("external_calendar_connections")
        .select("id, provider, account_email, status")
        .eq("profile_id", userId),
    ]);

  const notificationState = Object.fromEntries(
    (notifications ?? []).map((row) => [row.event_type, row.enabled]),
  );

  const googleConnection = (connections ?? []).find(
    (row) => row.provider === "google" && row.status === "active",
  );
  const googleAvailable = isGoogleCalendarConnectable();

  const profileLocale = routing.locales.includes(profile?.locale as Locale)
    ? (profile?.locale as Locale)
    : (locale as Locale);

  return (
    <div className="space-y-10">
      <h1 className="font-heading text-2xl sm:text-3xl">{t("title")}</h1>

      <Section title={t("profile")} description={t("profileBody")}>
        <ProfileSettingsForm
          userId={userId}
          email={
            typeof claimsData?.claims?.email === "string" ? claimsData.claims.email : null
          }
          initial={{
            fullName: profile?.full_name ?? "",
            phone: profile?.phone ?? "",
            locale: profileLocale,
            timezone: profile?.timezone ?? "Europe/Sofia",
            avatarUrl: profile?.avatar_url ?? null,
          }}
        />
      </Section>

      <Separator />

      <Section title={t("preferences")} description={t("preferencesBody")}>
        <PreferencesForm
          initial={{
            preferredChannel: preferences?.preferred_channel ?? "email",
            reminderLeadMinutes: preferences?.reminder_lead_minutes ?? 1440,
            notes: preferences?.notes ?? "",
            accessibilityNotes: preferences?.accessibility_notes ?? "",
          }}
        />
      </Section>

      <Separator />

      <Section title={t("notifications")} description={t("notificationsBody")}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Image
            src={featureArt.reminders}
            alt=""
            width={96}
            height={96}
            className="hidden size-24 shrink-0 rounded-xl object-cover sm:block"
          />
          <div className="min-w-0 flex-1 space-y-6">
            <NotificationSettings initial={notificationState} />

            <div className="border-border/70 space-y-2 border-t pt-5">
              <h3 className="text-sm font-medium">{t("push.title")}</h3>
              <PushToggle
                vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null}
              />
            </div>
          </div>
        </div>
      </Section>

      <Separator />

      <Section title={t("calendar")} description={t("calendarBody")}>
        {googleConnection ? (
          <div className="glowa-card flex items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-3">
              <CalendarSync className="text-primary size-5" aria-hidden />
              <div>
                <p className="font-medium">Google Calendar</p>
                <p className="text-muted-foreground text-sm">
                  {googleConnection.account_email ?? t("connected")}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" disabled>
              {t("disconnect")}
            </Button>
          </div>
        ) : (
          <div className="border-border/70 space-y-3 rounded-xl border border-dashed p-5">
            <Button disabled={!googleAvailable}>
              <CalendarSync className="size-4" aria-hidden />
              {t("connectGoogle")}
            </Button>
            {!googleAvailable ? (
              <p className="text-muted-foreground flex items-start gap-2 text-xs">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {t("googleUnavailable")}
              </p>
            ) : null}
          </div>
        )}
      </Section>
    </div>
  );
}
