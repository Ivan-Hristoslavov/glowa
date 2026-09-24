import {
  CalendarX2,
  CheckCircle2,
  Clock,
  Hourglass,
  MapPin,
  ShieldCheck,
  User2,
} from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { EmptyState } from "@/components/common/empty-state";
import { Rating } from "@/components/common/rating";
import { AddToCalendar } from "@/components/customer/add-to-calendar";
import { AppointmentStatusBadge } from "@/components/customer/appointment-status-badge";
import { CancelAppointmentDialog } from "@/components/customer/cancel-appointment-dialog";
import { PayDepositButton } from "@/components/customer/pay-deposit-button";
import { RescheduleDialog } from "@/components/customer/reschedule-dialog";
import { ReviewForm } from "@/components/customer/review-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { calendarProviders } from "@/lib/calendar";
import { formatDate, formatPrice, formatTime, formatZoneLabel } from "@/lib/format";
import { pickLocalized } from "@/lib/localized";
import { reconcileReturnedSession } from "@/lib/payments/deposits";
import {
  describeAppointmentWindow,
  getMyAppointment,
} from "@/lib/queries/appointments";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("bookings");
  return { title: t("details"), robots: { index: false, follow: false } };
}

export default async function BookingDetailPage({
  params,
  searchParams,
}: PageProps<"/[locale]/bookings/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("bookings");
  const booking = await getTranslations("booking");
  const review = await getTranslations("review");
  const business = await getTranslations("business");

  const sp = await searchParams;

  // Back from Stripe with a paid session: settle it before reading the
  // booking, so this page shows "paid" even if the webhook is still on its
  // way. Idempotent, and it verifies the session against the booking itself.
  const sessionId = typeof sp.session_id === "string" ? sp.session_id : null;
  if (sp.deposit === "paid" && sessionId) {
    const mine = await getMyAppointment(id);
    if (mine) await reconcileReturnedSession(mine.id, sessionId);
  }

  const appointment = await getMyAppointment(id);
  if (!appointment) {
    return (
      <EmptyState
        icon={CalendarX2}
        title={t("notFound")}
        body={t("notFoundBody")}
        action={
          <Button asChild>
            <Link href="/bookings">{t("title")}</Link>
          </Button>
        }
      />
    );
  }

  const justBooked = sp.booked === "1";

  const activeLocale = locale as Locale;
  const timezone = appointment.businesses?.timezone ?? "Europe/Sofia";
  const zoned = { timeZone: timezone, locale: activeLocale };

  const serviceName =
    pickLocalized(appointment.services?.name, activeLocale) ||
    pickLocalized(appointment.service_name_snapshot, activeLocale);

  const { isUpcoming, isOpen, canCancel, canReschedule, hasHappened } =
    describeAppointmentWindow(appointment);

  // `reviews.appointment_id` is unique, so PostgREST embeds it one-to-one.
  const existingReview = appointment.reviews ?? null;

  const locationLine = appointment.locations
    ? [
        appointment.locations.name,
        appointment.locations.address_line1,
        appointment.locations.city,
      ]
        .filter(Boolean)
        .join(", ")
    : null;

  const googleUrl = calendarProviders.google.buildAddUrl({
    uid: appointment.id,
    title: serviceName
      ? `${serviceName} · ${appointment.businesses?.name ?? "glowa"}`
      : (appointment.businesses?.name ?? "glowa"),
    description: appointment.staff_profiles?.display_name ?? null,
    location: locationLine,
    startsAt: appointment.starts_at,
    endsAt: appointment.ends_at,
  });

  const depositAmount =
    appointment.deposit_cents > 0
      ? formatPrice(appointment.deposit_cents, appointment.currency, activeLocale)
      : null;
  const holdUntil = appointment.payment_due_at
    ? formatTime(appointment.payment_due_at, zoned)
    : null;

  return (
    <div className="space-y-6">
      {appointment.deposit_status === "paid" && sp.deposit === "paid" ? (
        <Alert>
          <ShieldCheck className="size-4" aria-hidden />
          <AlertTitle>{t("depositPaidTitle")}</AlertTitle>
          <AlertDescription>{t("depositPaidBody", { amount: depositAmount ?? "" })}</AlertDescription>
        </Alert>
      ) : null}

      {appointment.deposit_status === "awaiting" ? (
        <Alert>
          <Hourglass className="size-4" aria-hidden />
          <AlertTitle>{t("depositAwaitingTitle")}</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{t("depositAwaitingBody", { time: holdUntil ?? "" })}</p>
            <PayDepositButton
              appointmentId={appointment.id}
              label={t("payDeposit", { amount: depositAmount ?? "" })}
            />
          </AlertDescription>
        </Alert>
      ) : null}

      {appointment.deposit_status === "void" ? (
        <Alert>
          <CalendarX2 className="size-4" aria-hidden />
          <AlertTitle>{t("depositVoidTitle")}</AlertTitle>
          <AlertDescription>{t("depositVoidBody")}</AlertDescription>
        </Alert>
      ) : null}

      {justBooked && appointment.deposit_status !== "awaiting" ? (
        <Alert>
          <CheckCircle2 className="size-4" aria-hidden />
          <AlertTitle>{booking("successTitle")}</AlertTitle>
          <AlertDescription>{booking("successBody")}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl">{serviceName}</h1>
            <AppointmentStatusBadge status={appointment.status} />
          </div>
          {appointment.businesses ? (
            <Link
              href={`/business/${appointment.businesses.slug}`}
              className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
            >
              {appointment.businesses.name}
            </Link>
          ) : null}
        </div>

        {isOpen && isUpcoming && googleUrl ? (
          <AddToCalendar
            googleUrl={googleUrl}
            icsUrl={`/api/appointments/${appointment.id}/ics?locale=${locale}`}
          />
        ) : null}
      </div>

      <div className="glowa-card space-y-4 p-5">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground text-xs">{booking("stepTime")}</dt>
            <dd className="mt-0.5 flex items-center gap-2">
              <Clock className="text-muted-foreground size-4" aria-hidden />
              {formatDate(appointment.starts_at, zoned)},{" "}
              {formatTime(appointment.starts_at, zoned)}–
              {formatTime(appointment.ends_at, zoned)}
            </dd>
            <dd className="text-muted-foreground mt-1 text-xs">
              {formatZoneLabel(appointment.starts_at, zoned)} · {timezone}
            </dd>
          </div>

          {appointment.staff_profiles ? (
            <div>
              <dt className="text-muted-foreground text-xs">{booking("stepStaff")}</dt>
              <dd className="mt-0.5 flex items-center gap-2">
                <User2 className="text-muted-foreground size-4" aria-hidden />
                {appointment.staff_profiles.display_name}
              </dd>
            </div>
          ) : null}

          {locationLine ? (
            <div>
              <dt className="text-muted-foreground text-xs">{booking("stepLocation")}</dt>
              <dd className="mt-0.5 flex items-start gap-2">
                <MapPin className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{locationLine}</span>
              </dd>
            </div>
          ) : null}

          <div>
            <dt className="text-muted-foreground text-xs">{booking("price")}</dt>
            <dd className="mt-0.5">
              {formatPrice(appointment.price_cents, appointment.currency, activeLocale)}
            </dd>
          </div>

          {depositAmount && appointment.deposit_status !== "none" ? (
            <div>
              <dt className="text-muted-foreground text-xs">{booking("depositLabel")}</dt>
              <dd className="mt-0.5 flex items-center gap-2">
                <ShieldCheck className="text-muted-foreground size-4" aria-hidden />
                {depositAmount} · {t(`depositStatus.${appointment.deposit_status}`)}
              </dd>
            </div>
          ) : null}
        </dl>

        {appointment.customer_notes ? (
          <>
            <Separator />
            <div>
              <p className="text-muted-foreground text-xs">{booking("notes")}</p>
              <p className="mt-1 text-sm">{appointment.customer_notes}</p>
            </div>
          </>
        ) : null}

        {appointment.cancellation_reason ? (
          <>
            <Separator />
            <div>
              <p className="text-muted-foreground text-xs">{t("cancelReason")}</p>
              <p className="mt-1 text-sm">{appointment.cancellation_reason}</p>
            </div>
          </>
        ) : null}
      </div>

      {isOpen && isUpcoming ? (
        <div className="flex flex-wrap items-center gap-3">
          {canReschedule && appointment.service_id ? (
            <RescheduleDialog
              appointmentId={appointment.id}
              serviceId={appointment.service_id}
              staffProfileId={appointment.staff_profile_id}
              locationId={appointment.location_id}
              timezone={timezone}
              locale={activeLocale}
            />
          ) : null}
          {canCancel ? (
            <CancelAppointmentDialog appointmentId={appointment.id} />
          ) : (
            <p className="text-muted-foreground text-sm">
              {t("cancelWindowClosed")}
              {appointment.businesses?.phone ? (
                <>
                  {" "}
                  <a
                    href={`tel:${appointment.businesses.phone}`}
                    className="text-primary underline underline-offset-4"
                  >
                    {business("callBusiness")}
                  </a>
                </>
              ) : null}
            </p>
          )}
        </div>
      ) : null}

      {hasHappened ? (
        <div className="glowa-card p-5">
          {existingReview ? (
            <div className="space-y-2">
              <h2 className="font-heading text-lg">{t("yourReview")}</h2>
              <Rating
                value={existingReview.rating}
                size="md"
                label={String(existingReview.rating)}
              />
              {existingReview.comment ? (
                <p className="text-sm leading-relaxed">{existingReview.comment}</p>
              ) : null}
              <p className="text-muted-foreground text-xs">{review("alreadyReviewed")}</p>
            </div>
          ) : (
            <ReviewForm
              appointmentId={appointment.id}
              googleReviewUrl={appointment.businesses?.google_review_url ?? null}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
