"use client";

import {
  CalendarCheck,
  ArrowLeft,
  Check,
  Clock,
  CreditCard,
  Loader2,
  ShieldCheck,
  Sparkles,
  Tag,
} from "lucide-react";
import { m } from "motion/react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { SlotPicker } from "@/components/booking/slot-picker";
import { WaitlistDialog } from "@/components/booking/waitlist-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { bookAppointment, type Slot } from "@/lib/actions/booking";
import { formatDate, formatDuration, formatPrice, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export type BookingLocation = { id: string; name: string; city: string | null };

export type BookingService = {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  priceCents: number;
  /** Taken online at booking; 0 when the service needs none. */
  depositCents: number;
  currency: string;
  staffIds: string[];
};

export type BookingStaff = {
  id: string;
  displayName: string;
  title: string;
  avatarUrl: string | null;
  color: string;
};

type BookingFlowProps = {
  businessId: string;
  slug: string;
  businessName: string;
  timezone: string;
  locale: Locale;
  isSignedIn: boolean;
  cancellationWindowHours: number;
  locations: BookingLocation[];
  services: BookingService[];
  staff: BookingStaff[];
  initialServiceId?: string;
  /** Arrived from "book with Maria" on the salon page. */
  initialStaffId?: string;
  /**
   * Arrived from a "free today" card: the time is already chosen, so the flow
   * opens on the confirm step. Booking still re-checks the slot.
   */
  initialStartsAt?: string;
  /** Shown at the top of the summary, so the booking feels like this salon. */
  coverUrl?: string | null;
};

type StepId = "location" | "service" | "staff" | "time" | "confirm";

const ANY_STAFF = "__any__";

export function BookingFlow({
  businessId,
  slug,
  businessName,
  timezone,
  locale,
  isSignedIn,
  cancellationWindowHours,
  locations,
  services,
  staff,
  initialServiceId,
  initialStaffId,
  initialStartsAt,
  coverUrl,
}: BookingFlowProps) {
  const t = useTranslations("booking");
  const business = useTranslations("business");
  const common = useTranslations("common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [locationId, setLocationId] = useState<string | null>(
    locations.length === 1 ? locations[0].id : null,
  );
  const [serviceId, setServiceId] = useState<string | null>(
    initialServiceId && services.some((s) => s.id === initialServiceId)
      ? initialServiceId
      : null,
  );
  const preferredStaff =
    initialStaffId && staff.some((member) => member.id === initialStaffId)
      ? initialStaffId
      : null;

  /** Keep the stylist someone came for, as long as they do the chosen service. */
  function staffFor(item: BookingService) {
    return preferredStaff && item.staffIds.includes(preferredStaff) ? preferredStaff : ANY_STAFF;
  }

  const [staffChoice, setStaffChoice] = useState<string>(() => {
    const initial = services.find((item) => item.id === initialServiceId);
    return initial ? staffFor(initial) : ANY_STAFF;
  });
  // A preselected time only stands when everything around it is settled: the
  // service is known, and there is one location to be at.
  const preselected = (() => {
    const initial = services.find((item) => item.id === initialServiceId);
    if (!initial || !initialStartsAt || locations.length > 1) return null;
    const start = new Date(initialStartsAt);
    if (Number.isNaN(start.getTime())) return null;
    return {
      starts_at: start.toISOString(),
      ends_at: new Date(start.getTime() + initial.durationMinutes * 60_000).toISOString(),
      staff_profile_id: preferredStaff,
    } satisfies Slot;
  })();

  const [slot, setSlot] = useState<Slot | null>(preselected);
  const [notes, setNotes] = useState("");
  // Location (only when several), service, staff (only with a team), time,
  // confirm - the same list `steps` builds below, counted up front so a
  // preselected time can open straight on "confirm".
  const [stepIndex, setStepIndex] = useState(() =>
    preselected
      ? (locations.length > 1 ? 1 : 0) + 1 + (staff.filter((m) => m.id).length > 1 ? 1 : 0) + 1
      : 0,
  );

  const service = services.find((item) => item.id === serviceId) ?? null;

  const eligibleStaff = useMemo(
    () => (service ? staff.filter((member) => service.staffIds.includes(member.id)) : []),
    [service, staff],
  );

  // The step list is fixed the moment the page loads. Deriving the staff step
  // from the *chosen service* made the indicator grow from three steps to four
  // as soon as someone picked one, which is disorienting: progress you are
  // walking through should not get longer while you walk it. It depends on
  // whether the salon has a team at all, which is known up front.
  const bookableStaff = useMemo(
    () => staff.filter((member) => member.id),
    [staff],
  );

  const steps = useMemo<StepId[]>(() => {
    const list: StepId[] = [];
    if (locations.length > 1) list.push("location");
    list.push("service");
    if (bookableStaff.length > 1) list.push("staff");
    list.push("time", "confirm");
    return list;
  }, [bookableStaff.length, locations.length]);

  const current = steps[Math.min(stepIndex, steps.length - 1)];

  const canAdvance =
    (current === "location" && Boolean(locationId)) ||
    (current === "service" && Boolean(serviceId)) ||
    current === "staff" ||
    (current === "time" && Boolean(slot));

  function goNext() {
    setStepIndex((index) => Math.min(index + 1, steps.length - 1));
  }

  function goBack() {
    setStepIndex((index) => Math.max(index - 1, 0));
  }

  function confirm() {
    if (!service || !slot) return;

    const staffProfileId =
      staffChoice !== ANY_STAFF ? staffChoice : slot.staff_profile_id;

    if (!staffProfileId) {
      toast.error(t("errors.generic"));
      return;
    }

    startTransition(async () => {
      const result = await bookAppointment({
        serviceId: service.id,
        startsAt: slot.starts_at,
        staffProfileId,
        locationId,
        notes,
        locale,
      });

      if (!result.ok) {
        const code = result.code;
        if (code === "unauthenticated") {
          router.push("/login");
          return;
        }
        toast.error(
          code === "slot_unavailable" ||
            code === "slot_taken" ||
            code === "payment_unavailable"
            ? t(`errors.${code}`)
            : t("errors.generic"),
        );
        // The slot is gone; force a refetch by clearing the selection.
        setSlot(null);
        setStepIndex(steps.indexOf("time"));
        return;
      }

      // The slot is held; the deposit that secures it is paid on Stripe's
      // page, which comes back to the booking with the outcome.
      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
        return;
      }
      router.push(`/bookings/${result.appointmentId}?booked=1`);
    });
  }

  const summaryPrice = service
    ? formatPrice(service.priceCents, service.currency, locale)
    : null;
  const deposit =
    service && service.depositCents > 0
      ? formatPrice(service.depositCents, service.currency, locale)
      : null;
  const remainder =
    service && service.depositCents > 0
      ? formatPrice(service.priceCents - service.depositCents, service.currency, locale)
      : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      {/* A grid item defaults to `min-width: auto`, so the horizontally
          scrolling date strip stretched this column to the width of all 21
          days - 1504px on a 375px phone - and pushed "next" off screen. */}
      <div className="min-w-0 space-y-6">
        {/* Progress. The colour alone does not say which step you are on, so
            the current item is marked for assistive tech as well. */}
        <ol aria-label={t("stepsLabel")} className="flex items-center gap-2">
          {steps.map((step, index) => {
            const active = index === stepIndex;
            const done = index < stepIndex;
            return (
              <li
                key={step}
                aria-current={active ? "step" : undefined}
                className="flex flex-1 items-center gap-2 last:flex-none"
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300",
                    active
                      ? "bg-primary text-primary-foreground ring-primary/20 ring-4"
                      : done
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-3.5" aria-hidden /> : index + 1}
                </span>
                <span
                  className={cn(
                    "text-sm whitespace-nowrap",
                    active ? "font-medium" : "text-muted-foreground hidden sm:inline",
                  )}
                >
                  {t(
                    step === "location"
                      ? "stepLocation"
                      : step === "service"
                        ? "stepService"
                        : step === "staff"
                          ? "stepStaff"
                          : step === "time"
                            ? "stepTime"
                            : "stepConfirm",
                  )}
                </span>
                {index < steps.length - 1 ? (
                  <span
                    className={cn(
                      "h-px min-w-4 flex-1 transition-colors duration-300",
                      done ? "bg-foreground/40" : "bg-border",
                    )}
                    aria-hidden
                  />
                ) : null}
              </li>
            );
          })}
        </ol>

        <m.div
          key={current}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35 }}
          className="space-y-6"
        >

        {current === "location" ? (
          <section className="space-y-3">
            <h2 className="font-heading text-xl">{t("chooseLocation")}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {locations.map((location) => (
                <button
                  key={location.id}
                  type="button"
                  onClick={() => setLocationId(location.id)}
                  aria-pressed={locationId === location.id}
                  className={cn(
                    "glowa-focus rounded-xl border p-4 text-left transition-colors",
                    locationId === location.id
                      ? "border-primary bg-accent"
                      : "border-border hover:bg-accent/60",
                  )}
                >
                  <p className="font-medium">{location.name}</p>
                  {location.city ? (
                    <p className="text-muted-foreground text-sm">{location.city}</p>
                  ) : null}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {current === "service" ? (
          <section className="space-y-3">
            <h2 className="font-heading text-xl">{t("chooseService")}</h2>
            <div className="space-y-2">
              {services.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setServiceId(item.id);
                    setStaffChoice(staffFor(item));
                    setSlot(null);
                  }}
                  aria-pressed={serviceId === item.id}
                  className={cn(
                    "glowa-focus flex w-full items-start justify-between gap-4 rounded-xl border p-4 text-left transition-colors",
                    serviceId === item.id
                      ? "border-primary bg-accent"
                      : "border-border hover:bg-accent/60",
                  )}
                >
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">{item.name}</p>
                    {item.description ? (
                      <p className="text-muted-foreground line-clamp-2 text-sm">
                        {item.description}
                      </p>
                    ) : null}
                    <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                      <Clock className="size-3.5" aria-hidden />
                      {formatDuration(item.durationMinutes, locale)}
                    </p>
                  </div>
                  <span className="flex shrink-0 flex-col items-end gap-1 text-sm font-medium">
                    <span
                      className={cn(
                        "mb-1 flex size-5 items-center justify-center rounded-full border transition-colors",
                        serviceId === item.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border",
                      )}
                      aria-hidden
                    >
                      {serviceId === item.id ? <Check className="size-3" /> : null}
                    </span>
                    {formatPrice(item.priceCents, item.currency, locale)}
                    {item.depositCents > 0 ? (
                      <span className="text-muted-foreground inline-flex items-center gap-1 text-xs font-normal">
                        <ShieldCheck className="size-3" aria-hidden />
                        {t("depositChip", {
                          amount: formatPrice(item.depositCents, item.currency, locale) ?? "",
                        })}
                      </span>
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {current === "staff" ? (
          <section className="space-y-3">
            <h2 className="font-heading text-xl">{t("chooseStaff")}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setStaffChoice(ANY_STAFF);
                  setSlot(null);
                }}
                aria-pressed={staffChoice === ANY_STAFF}
                className={cn(
                  "glowa-focus flex items-center gap-3 rounded-xl border p-4 text-left transition-colors",
                  staffChoice === ANY_STAFF
                    ? "border-primary bg-accent"
                    : "border-border hover:bg-accent/60",
                )}
              >
                <span className="bg-secondary flex size-11 items-center justify-center rounded-full">
                  <Sparkles className="text-primary size-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">{t("anyStaff")}</span>
                  <span className="text-muted-foreground block text-sm">
                    {t("anyStaffHint")}
                  </span>
                </span>
              </button>

              {eligibleStaff.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => {
                    setStaffChoice(member.id);
                    setSlot(null);
                  }}
                  aria-pressed={staffChoice === member.id}
                  className={cn(
                    "glowa-focus flex items-center gap-3 rounded-xl border p-4 text-left transition-colors",
                    staffChoice === member.id
                      ? "border-primary bg-accent"
                      : "border-border hover:bg-accent/60",
                  )}
                >
                  <Avatar className="size-12 rounded-xl">
                    {member.avatarUrl ? (
                      <AvatarImage src={member.avatarUrl} alt="" className="object-cover" />
                    ) : null}
                    <AvatarFallback
                      style={{ backgroundColor: `${member.color}22`, color: member.color }}
                    >
                      {member.displayName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{member.displayName}</span>
                    <span className="text-muted-foreground block truncate text-sm">
                      {member.title}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {current === "time" && service ? (
          <section className="space-y-4">
            <h2 className="font-heading text-xl">{t("chooseTime")}</h2>
            <SlotPicker
              key={`${service.id}-${staffChoice}-${locationId ?? "any"}`}
              serviceId={service.id}
              staffProfileId={staffChoice === ANY_STAFF ? null : staffChoice}
              locationId={locationId}
              timezone={timezone}
              locale={locale}
              value={slot}
              onChange={setSlot}
              waitlist={
                <WaitlistDialog
                  businessId={businessId}
                  services={services.map((entry) => ({
                    id: entry.id,
                    name: entry.name,
                  }))}
                  staff={staff.map((member) => ({
                    id: member.id,
                    displayName: member.displayName,
                  }))}
                  defaultServiceId={service.id}
                  isSignedIn={isSignedIn}
                />
              }
            />
          </section>
        ) : null}

        {current === "confirm" && service && slot ? (
          <section className="space-y-4">
            <h2 className="font-heading text-xl">{t("stepConfirm")}</h2>

            {preselected && slot.starts_at === preselected.starts_at ? (
              <div className="border-primary/25 bg-primary/5 flex items-center gap-3 rounded-2xl border p-4">
                <CalendarCheck className="text-primary size-5 shrink-0" aria-hidden />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold first-letter:uppercase">
                    {formatDate(slot.starts_at, { timeZone: timezone, locale })} ·{" "}
                    {formatTime(slot.starts_at, { timeZone: timezone, locale })}
                  </p>
                  <p className="text-muted-foreground">{t("preselected")}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setStepIndex(steps.indexOf("time"))}
                >
                  {common("change")}
                </Button>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="booking-notes">{t("notes")}</Label>
              <Textarea
                id="booking-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder={t("notesPlaceholder")}
                rows={3}
                maxLength={500}
              />
            </div>

            {deposit ? (
              <div className="border-primary/30 bg-primary/5 rounded-xl border p-4">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <ShieldCheck className="text-primary size-4" aria-hidden />
                  {t("depositTitle", { amount: deposit })}
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {t("depositBody", {
                    rest: remainder ?? "",
                    hours: cancellationWindowHours,
                  })}
                </p>
                <p className="text-muted-foreground mt-2 text-xs">{t("depositHold")}</p>
              </div>
            ) : null}

            <div className="border-border/70 bg-secondary/40 rounded-xl border p-4">
              <p className="text-sm font-medium">{t("policy")}</p>
              <p className="text-muted-foreground mt-1 text-sm">
                {business("cancellationPolicy", { hours: cancellationWindowHours })}
              </p>
            </div>

            {!isSignedIn ? (
              <div className="border-border/70 rounded-xl border border-dashed p-4">
                <p className="font-medium">{t("signInToBook")}</p>
                <p className="text-muted-foreground mt-1 text-sm">{t("signInHint")}</p>
                <Button asChild className="mt-3">
                  <Link href="/login">{t("signInToBook")}</Link>
                </Button>
              </div>
            ) : null}
          </section>
        ) : null}

        </m.div>

        {/* Pinned to the bottom of the viewport, so a long service list never
            hides the way forward. */}
        <div className="bg-background/90 sticky bottom-0 z-10 -mx-4 flex items-center gap-3 border-t px-4 py-3 backdrop-blur-xl sm:mx-0 sm:rounded-2xl sm:border sm:px-3">
          {stepIndex > 0 ? (
            <Button type="button" variant="ghost" onClick={goBack} disabled={isPending}>
              <ArrowLeft className="size-4" aria-hidden />
              {common("back")}
            </Button>
          ) : (
            <Button asChild variant="ghost">
              <Link href={`/business/${slug}`}>
                <ArrowLeft className="size-4" aria-hidden />
                {common("back")}
              </Link>
            </Button>
          )}

          {current === "confirm" ? (
            <Button
              type="button"
              size="lg"
              onClick={confirm}
              disabled={isPending || !isSignedIn || !slot}
              className="ml-auto"
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : deposit ? (
                <CreditCard className="size-4" aria-hidden />
              ) : (
                <Check className="size-4" aria-hidden />
              )}
              {isPending
                ? deposit
                  ? t("openingPayment")
                  : t("confirming")
                : deposit
                  ? t("payDeposit", { amount: deposit })
                  : t("confirm")}
            </Button>
          ) : (
            <Button
              type="button"
              size="lg"
              onClick={goNext}
              disabled={!canAdvance}
              className="ml-auto"
            >
              {common("next")}
            </Button>
          )}
        </div>
      </div>

      {/* Summary */}
      <aside className="glowa-card h-fit space-y-4 overflow-hidden rounded-2xl p-5 lg:sticky lg:top-24">
        {coverUrl ? (
          <div className="relative -mx-5 -mt-5 mb-1 h-32">
            <Image src={coverUrl} alt="" fill sizes="20rem" className="object-cover" />
            <div className="from-card absolute inset-0 bg-gradient-to-t to-transparent" />
          </div>
        ) : null}
        <div>
          <p className="text-muted-foreground text-xs tracking-wide uppercase">
            {t("summary")}
          </p>
          <p className="font-heading mt-1 text-lg">{businessName}</p>
        </div>

        <dl className="space-y-3 text-sm">
          {locationId ? (
            <div>
              <dt className="text-muted-foreground text-xs">{t("stepLocation")}</dt>
              <dd>{locations.find((l) => l.id === locationId)?.name}</dd>
            </div>
          ) : null}

          {service ? (
            <>
              <div>
                <dt className="text-muted-foreground text-xs">{t("stepService")}</dt>
                <dd>{service.name}</dd>
              </div>
              <div className="flex gap-6">
                <div>
                  <dt className="text-muted-foreground text-xs">{t("duration")}</dt>
                  <dd className="flex items-center gap-1.5">
                    <Clock className="size-3.5" aria-hidden />
                    {formatDuration(service.durationMinutes, locale)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">{t("price")}</dt>
                  <dd className="flex items-center gap-1.5">
                    <Tag className="size-3.5" aria-hidden />
                    {summaryPrice}
                  </dd>
                </div>
              </div>
              {deposit ? (
                <div>
                  <dt className="text-muted-foreground text-xs">{t("depositLabel")}</dt>
                  <dd className="flex items-center gap-1.5">
                    <ShieldCheck className="text-primary size-3.5" aria-hidden />
                    {t("depositSummary", { amount: deposit, rest: remainder ?? "" })}
                  </dd>
                </div>
              ) : null}
            </>
          ) : null}

          {staffChoice !== ANY_STAFF ? (
            <div>
              <dt className="text-muted-foreground text-xs">{t("stepStaff")}</dt>
              <dd>{eligibleStaff.find((m) => m.id === staffChoice)?.displayName}</dd>
            </div>
          ) : null}

          {slot ? (
            <div>
              <dt className="text-muted-foreground text-xs">{t("stepTime")}</dt>
              <dd>
                {formatDate(slot.starts_at, { timeZone: timezone, locale })},{" "}
                {formatTime(slot.starts_at, { timeZone: timezone, locale })}–
                {formatTime(slot.ends_at, { timeZone: timezone, locale })}
              </dd>
            </div>
          ) : null}
        </dl>
      </aside>
    </div>
  );
}
