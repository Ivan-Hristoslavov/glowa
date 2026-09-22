import { CalendarDays, History } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { EmptyState } from "@/components/common/empty-state";
import { emptyStateArt } from "@/lib/brand-assets";
import { AppointmentCard } from "@/components/customer/appointment-card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { listMyAppointments } from "@/lib/queries/appointments";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("bookings");
  return { title: t("title") };
}

export default async function BookingsPage({ params }: PageProps<"/[locale]/bookings">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("bookings");
  const { upcoming, past } = await listMyAppointments();
  const activeLocale = locale as Locale;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl sm:text-3xl">{t("title")}</h1>

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">
            {t("upcoming")}
            {upcoming.length > 0 ? (
              <span className="text-muted-foreground ml-1.5 text-xs">
                {upcoming.length}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="past">{t("past")}</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-5">
          {upcoming.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              image={emptyStateArt.bookings}
              title={t("empty")}
              body={t("emptyBody")}
              action={
                <Button asChild>
                  <Link href="/search">{t("findBusiness")}</Link>
                </Button>
              }
            />
          ) : (
            <ul className="space-y-3">
              {upcoming.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  locale={activeLocale}
                />
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="past" className="mt-5">
          {past.length === 0 ? (
            <EmptyState
              icon={History}
              title={t("emptyPast")}
              body={t("emptyPastBody")}
            />
          ) : (
            <ul className="space-y-3">
              {past.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  locale={activeLocale}
                />
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
