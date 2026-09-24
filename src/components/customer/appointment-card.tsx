import { Clock, MapPin, RotateCcw } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AppointmentStatusBadge } from "@/components/customer/appointment-status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatPrice, formatTime } from "@/lib/format";
import { pickLocalized } from "@/lib/localized";
import type { AppointmentRow } from "@/lib/queries/appointments";

export async function AppointmentCard({
  appointment,
  locale,
  past = false,
}: {
  appointment: AppointmentRow;
  locale: Locale;
  /** A past visit offers "book again" with the same service preselected. */
  past?: boolean;
}) {
  const t = await getTranslations("bookings");

  const timezone = appointment.businesses?.timezone ?? "Europe/Sofia";
  const zoned = { timeZone: timezone, locale };
  const serviceName =
    pickLocalized(appointment.services?.name, locale) ||
    pickLocalized(appointment.service_name_snapshot, locale);

  return (
    <li className="glowa-card glowa-lift flex flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="bg-secondary text-secondary-foreground flex w-full shrink-0 flex-row items-center justify-between rounded-lg px-4 py-3 sm:w-24 sm:flex-col sm:justify-center sm:gap-0.5 sm:px-3">
        <span className="text-xs tracking-wide uppercase">
          {formatDate(appointment.starts_at, zoned)}
        </span>
        <span className="font-heading text-lg leading-none">
          {formatTime(appointment.starts_at, zoned)}
        </span>
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{serviceName}</p>
          <AppointmentStatusBadge status={appointment.status} />
        </div>

        <p className="text-muted-foreground text-sm">
          {appointment.businesses?.name}
          {appointment.staff_profiles?.display_name
            ? ` · ${t("with", { name: appointment.staff_profiles.display_name })}`
            : null}
        </p>

        <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden />
            {formatTime(appointment.starts_at, zoned)}–
            {formatTime(appointment.ends_at, zoned)}
          </span>
          {appointment.locations?.city ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden />
              {appointment.locations.city}
            </span>
          ) : null}
          <span>{formatPrice(appointment.price_cents, appointment.currency, locale)}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:flex-col sm:items-end">
        {appointment.staff_profiles ? (
          <Avatar className="size-9">
            {appointment.staff_profiles.avatar_url ? (
              <AvatarImage src={appointment.staff_profiles.avatar_url} alt="" />
            ) : null}
            <AvatarFallback className="text-xs">
              {appointment.staff_profiles.display_name.charAt(0)}
            </AvatarFallback>
          </Avatar>
        ) : null}
        <div className="flex gap-2 sm:flex-col sm:items-end">
          {past && appointment.businesses?.slug ? (
            // The most common next booking is the last one again.
            <Button asChild size="sm">
              <Link
                href={`/business/${appointment.businesses.slug}/book${
                  appointment.service_id ? `?service=${appointment.service_id}` : ""
                }`}
              >
                <RotateCcw className="size-3.5" aria-hidden />
                {t("bookAgain")}
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="outline" size="sm">
            <Link href={`/bookings/${appointment.id}`}>{t("details")}</Link>
          </Button>
        </div>
      </div>
    </li>
  );
}
