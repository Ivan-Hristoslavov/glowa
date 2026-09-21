import { CalendarDays, Heart, Settings, Star } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

import { AppointmentCard } from "@/components/customer/appointment-card";
import { EmptyState } from "@/components/common/empty-state";
import { Section } from "@/components/common/section";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { listMyAppointments } from "@/lib/queries/appointments";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("profile"), robots: { index: false, follow: false } };
}

export default async function ProfilePage({ params }: PageProps<"/[locale]/profile">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("profile");
  const nav = await getTranslations("nav");
  const bookings = await getTranslations("bookings");

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  // The proxy already gates this route; this is the second line of defence.
  if (typeof userId !== "string") redirect(`/${locale}/login`);

  const [{ data: profile }, { upcoming }, { count: savedCount }, { count: reviewCount }] =
    await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
      listMyAppointments(),
      supabase
        .from("saved_businesses")
        .select("business_id", { count: "exact", head: true }),
      supabase.from("reviews").select("id", { count: "exact", head: true }),
    ]);

  const activeLocale = locale as Locale;
  const next = upcoming[0] ?? null;

  const stats = [
    { key: "upcoming", value: upcoming.length, href: "/bookings", icon: CalendarDays },
    { key: "saved", value: savedCount ?? 0, href: "/favorites", icon: Heart },
    { key: "reviews", value: reviewCount ?? 0, href: "/reviews", icon: Star },
  ] as const;

  return (
    <div className="space-y-10">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl sm:text-3xl">
          {profile?.full_name
            ? t("greeting", { name: profile.full_name.split(" ")[0] })
            : t("greetingFallback")}
        </h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-3">
        {stats.map(({ key, value, href, icon: Icon }) => (
          <li key={key}>
            <Link
              href={href}
              className="glowa-card glowa-focus hover:shadow-lift flex items-center gap-4 p-5 transition-shadow"
            >
              <span className="bg-secondary text-primary flex size-11 items-center justify-center rounded-full">
                <Icon className="size-5" aria-hidden />
              </span>
              <span>
                <span className="font-heading block text-2xl leading-none">{value}</span>
                <span className="text-muted-foreground block text-sm">{t(key)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <Section
        title={t("nextAppointment")}
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href="/bookings">{bookings("title")}</Link>
          </Button>
        }
      >
        {next ? (
          <ul>
            <AppointmentCard appointment={next} locale={activeLocale} />
          </ul>
        ) : (
          <EmptyState
            icon={CalendarDays}
            title={t("noNextAppointment")}
            body={bookings("emptyBody")}
            action={
              <Button asChild>
                <Link href="/search">{t("bookSomething")}</Link>
              </Button>
            }
          />
        )}
      </Section>

      <Section title={t("quickLinks")}>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/settings">
              <Settings className="size-4" aria-hidden />
              {nav("settings")}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/favorites">
              <Heart className="size-4" aria-hidden />
              {nav("favorites")}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/reviews">
              <Star className="size-4" aria-hidden />
              {nav("reviews")}
            </Link>
          </Button>
        </div>
      </Section>
    </div>
  );
}
