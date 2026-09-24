"use client";

import { ArrowLeft, ArrowRight, Check, Clock, Loader2, Sparkles, Tag } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { inlineAuthAction } from "@/app/[locale]/(auth)/actions";
import { AuthForm } from "@/components/auth/auth-form";
import { SlotPicker } from "@/components/booking/slot-picker";
import { WaitlistDialog } from "@/components/booking/waitlist-dialog";
import { AUTH_CHANGED_EVENT } from "@/components/layout/use-account";
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
};

type StepId = "location" | "service" | "staff" | "time" | "confirm";

const ANY_STAFF = "__any__";

/**
 * How long a choice stays on screen before the funnel moves on by itself.
 * Long enough to see the card light up and know the tap registered; short
 * enough that nobody reaches for "next" in the meantime.
 */
const AUTO_ADVANCE_MS = 260;

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
}: BookingFlowProps) {
  const t = useTranslations("booking");
  const auth = useTranslations("auth");
  const business = useTranslations("business");
  const common = useTranslations("common");
  const router = useRouter();
  const activeLocale = useLocale();
  const [isPending, startTransition] = useTransition();

  const preselected =
    initialServiceId && services.some((s) => s.id === initialServiceId) ? initialServiceId : null;

  const [locationId, setLocationId] = useState<string | null>(
    locations.length === 1 ? locations[0].id : null,
  );
  const [serviceId, setServiceId] = useState<string | null>(preselected);
  const [staffChoice, setStaffChoice] = useState<string>(ANY_STAFF);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [notes, setNotes] = useState("");
  // +1 forward, -1 back: the direction the next step slides in from.
  const [direction, setDirection] = useState(1);

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
  const steps = useMemo<StepId[]>(() => {
    const list: StepId[] = [];
    if (locations.length > 1) list.push("location");
    list.push("service");
    if (staff.length > 1) list.push("staff");
    list.push("time", "confirm");
    return list;
  }, [staff.length, locations.length]);

  // Arriving from a service's own "book" button means the service is already
  // chosen - starting on the list of services made people pick it twice.
  const [stepIndex, setStepIndex] = useState(() => {
    if (!preselected || locations.length > 1) return 0;
    return steps.indexOf("service") + 1;
  });

  const current = steps[Math.min(stepIndex, steps.length - 1)];

  const canAdvance =
    (current === "location" && Boolean(locationId)) ||
    (current === "service" && Boolean(serviceId)) ||
    current === "staff" ||
    (current === "time" && Boolean(slot));

  // The inline sign-in's server action revalidates the page in the same
  // commit that reports success, so the form unmounts before it can say so.
  // The flip of `isSignedIn` is the reliable signal: thank them, and tell the
  // header (which reads the session in the browser) to look again.
  const wasSignedIn = useRef(isSignedIn);
  useEffect(() => {
    if (isSignedIn && !wasSignedIn.current) {
      toast.success(auth("signedIn"));
      window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
    }
    wasSignedIn.current = isSignedIn;
  }, [isSignedIn, auth]);

  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    },
    [],
  );

  function goTo(index: number) {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setDirection(index >= stepIndex ? 1 : -1);
    setStepIndex(Math.max(0, Math.min(index, steps.length - 1)));
  }

  function goNext() {
    goTo(stepIndex + 1);
  }

  function goBack() {
    goTo(stepIndex - 1);
  }

  /** Select, let the choice register visually, then move on. */
  function chooseAndAdvance(apply: () => void) {
    apply();
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => {
      setDirection(1);
      setStepIndex((index) => Math.min(index + 1, steps.length - 1));
    }, AUTO_ADVANCE_MS);
  }

  const confirmRef = useRef<HTMLDivElement>(null);

  function confirm() {
    if (!service || !slot) return;

    const staffProfileId = staffChoice !== ANY_STAFF ? staffChoice : slot.staff_profile_id;

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
      });

      if (!result.ok) {
        const code = result.code;
        if (code === "unauthenticated") {
          // The session lapsed between steps. The sign-in form is on this
          // step; refreshing brings it back without losing the choices.
          router.refresh();
          confirmRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
        toast.error(
          code === "slot_unavailable" || code === "slot_taken"
            ? t(`errors.${code}`)
            : t("errors.generic"),
        );
        // The slot is gone; force a refetch by clearing the selection.
        setSlot(null);
        goTo(steps.indexOf("time"));
        return;
      }

      router.push(`/bookings/${result.appointmentId}?booked=1`);
    });
  }

  const summaryPrice = service ? formatPrice(service.priceCents, service.currency, locale) : null;

  const stepLabel = (step: StepId) =>
    t(
      step === "location"
        ? "stepLocation"
        : step === "service"
          ? "stepService"
          : step === "staff"
            ? "stepStaff"
            : step === "time"
              ? "stepTime"
              : "stepConfirm",
    );

  const optionClass = (selected: boolean) =>
    cn(
      "glowa-focus group/option relative w-full rounded-2xl border p-4 text-left transition-all duration-300",
      "active:scale-[0.99]",
      selected
        ? "border-primary bg-accent shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_18%,transparent)]"
        : "border-border bg-card hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]",
    );

  const bookingPath = `/${activeLocale}/business/${slug}/book${
    serviceId ? `?service=${serviceId}` : ""
  }`;

  return (
    <div className="grid gap-8 pb-28 lg:grid-cols-[1fr_20rem] lg:pb-0">
      {/* A grid item defaults to `min-width: auto`, so the horizontally
          scrolling date strip stretched this column to the width of all 21
          days - 1504px on a 375px phone - and pushed "next" off screen. */}
      <div className="min-w-0 space-y-6">
        {/* Progress. The colour alone does not say which step you are on, so
            the current item is marked for assistive tech as well. Steps
            already done are buttons: going back is one tap, not several. */}
        <div className="space-y-3">
          <div className="bg-muted relative h-1.5 overflow-hidden rounded-full" aria-hidden>
            <m.div
              className="bg-primary absolute inset-y-0 left-0 rounded-full"
              initial={false}
              animate={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <ol
            aria-label={t("stepsLabel")}
            className="text-muted-foreground flex flex-wrap items-center gap-x-1 gap-y-1 text-xs"
          >
            {steps.map((step, index) => {
              const done = index < stepIndex;
              const active = index === stepIndex;
              return (
                <li
                  key={step}
                  aria-current={active ? "step" : undefined}
                  className="flex items-center"
                >
                  <button
                    type="button"
                    disabled={!done}
                    onClick={() => goTo(index)}
                    className={cn(
                      "glowa-focus flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors",
                      active && "bg-primary text-primary-foreground font-medium",
                      done && "text-foreground hover:bg-accent",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-4 items-center justify-center rounded-full text-[0.6rem] font-semibold",
                        active
                          ? "bg-primary-foreground/20"
                          : done
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted-foreground/15",
                      )}
                    >
                      {done ? <Check className="size-2.5" aria-hidden /> : index + 1}
                    </span>
                    {stepLabel(step)}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="relative">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <m.section
              key={current}
              custom={direction}
              initial={{ opacity: 0, x: direction * 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -28 }}
              transition={{ duration: 0.28 }}
              className="space-y-4"
            >
              {current === "location" ? (
                <>
                  <h2 className="font-heading text-xl sm:text-2xl">{t("chooseLocation")}</h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {locations.map((location) => (
                      <button
                        key={location.id}
                        type="button"
                        onClick={() => {
                          setLocationId(location.id);
                          // A service chosen on the salon page is still chosen:
                          // skip straight past the list of services.
                          const target = serviceId
                            ? steps.indexOf("service") + 1
                            : steps.indexOf("service");
                          if (advanceTimer.current) clearTimeout(advanceTimer.current);
                          advanceTimer.current = setTimeout(() => goTo(target), AUTO_ADVANCE_MS);
                        }}
                        aria-pressed={locationId === location.id}
                        className={optionClass(locationId === location.id)}
                      >
                        <p className="font-medium">{location.name}</p>
                        {location.city ? (
                          <p className="text-muted-foreground text-sm">{location.city}</p>
                        ) : null}
                        <SelectedTick show={locationId === location.id} />
                      </button>
                    ))}
                  </div>
                </>
              ) : null}

              {current === "service" ? (
                <>
                  <h2 className="font-heading text-xl sm:text-2xl">{t("chooseService")}</h2>
                  <div className="space-y-2.5">
                    {services.map((item, index) => (
                      // The entrance lives on a wrapper: motion writes an inline
                      // transform, which would otherwise cancel the card's own
                      // hover lift.
                      <m.div
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(index, 8) * 0.04, duration: 0.3 }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            chooseAndAdvance(() => {
                              setServiceId(item.id);
                              setStaffChoice(ANY_STAFF);
                              setSlot(null);
                            })
                          }
                          aria-pressed={serviceId === item.id}
                          className={cn(
                            optionClass(serviceId === item.id),
                            "flex items-start justify-between gap-4 pr-12",
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
                          <span className="shrink-0 text-sm font-semibold tabular-nums">
                            {formatPrice(item.priceCents, item.currency, locale)}
                          </span>
                          <SelectedTick show={serviceId === item.id} />
                        </button>
                      </m.div>
                    ))}
                  </div>
                </>
              ) : null}

              {current === "staff" ? (
                <>
                  <h2 className="font-heading text-xl sm:text-2xl">{t("chooseStaff")}</h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() =>
                        chooseAndAdvance(() => {
                          setStaffChoice(ANY_STAFF);
                          setSlot(null);
                        })
                      }
                      aria-pressed={staffChoice === ANY_STAFF}
                      className={cn(
                        optionClass(staffChoice === ANY_STAFF),
                        "flex items-center gap-3",
                      )}
                    >
                      <span className="bg-secondary flex size-12 shrink-0 items-center justify-center rounded-full">
                        <Sparkles className="text-primary size-5" aria-hidden />
                      </span>
                      <span className="min-w-0 pr-6">
                        <span className="block font-medium">{t("anyStaff")}</span>
                        <span className="text-muted-foreground block text-sm">
                          {t("anyStaffHint")}
                        </span>
                      </span>
                      <SelectedTick show={staffChoice === ANY_STAFF} />
                    </button>

                    {eligibleStaff.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() =>
                          chooseAndAdvance(() => {
                            setStaffChoice(member.id);
                            setSlot(null);
                          })
                        }
                        aria-pressed={staffChoice === member.id}
                        className={cn(
                          optionClass(staffChoice === member.id),
                          "flex items-center gap-3",
                        )}
                      >
                        <Avatar className="size-12 shrink-0">
                          {member.avatarUrl ? <AvatarImage src={member.avatarUrl} alt="" /> : null}
                          <AvatarFallback
                            style={{ backgroundColor: `${member.color}22`, color: member.color }}
                            className="font-medium"
                          >
                            {member.displayName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="min-w-0 pr-6">
                          <span className="block truncate font-medium">{member.displayName}</span>
                          <span className="text-muted-foreground block truncate text-sm">
                            {member.title}
                          </span>
                        </span>
                        <SelectedTick show={staffChoice === member.id} />
                      </button>
                    ))}
                  </div>
                </>
              ) : null}

              {current === "time" && service ? (
                <>
                  <h2 className="font-heading text-xl sm:text-2xl">{t("chooseTime")}</h2>
                  <SlotPicker
                    key={`${service.id}-${staffChoice}-${locationId ?? "any"}`}
                    serviceId={service.id}
                    staffProfileId={staffChoice === ANY_STAFF ? null : staffChoice}
                    locationId={locationId}
                    timezone={timezone}
                    locale={locale}
                    value={slot}
                    onChange={(next) => {
                      if (next) chooseAndAdvance(() => setSlot(next));
                      else setSlot(null);
                    }}
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
                </>
              ) : null}

              {current === "confirm" && service && slot ? (
                <div ref={confirmRef} className="space-y-4">
                  <h2 className="font-heading text-xl sm:text-2xl">{t("stepConfirm")}</h2>

                  {/* What they are about to book, restated where they decide -
                      on a phone the summary card is far below. */}
                  <div className="from-accent to-card border-primary/25 rounded-2xl border bg-gradient-to-br p-4 sm:p-5">
                    <p className="font-medium">{service.name}</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {formatDate(slot.starts_at, { timeZone: timezone, locale })} ·{" "}
                      <span className="text-foreground font-medium">
                        {formatTime(slot.starts_at, { timeZone: timezone, locale })}–
                        {formatTime(slot.ends_at, { timeZone: timezone, locale })}
                      </span>
                    </p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {businessName}
                      {summaryPrice ? ` · ${summaryPrice}` : null}
                    </p>
                  </div>

                  {!isSignedIn ? (
                    <div className="glowa-card space-y-4 p-5">
                      <div>
                        <p className="font-heading text-lg">{auth("inlineTitle")}</p>
                        <p className="text-muted-foreground mt-1 text-sm">
                          {auth("inlineSubtitle")}
                        </p>
                      </div>
                      <AuthForm
                        mode="sign-up"
                        action={inlineAuthAction}
                        nextPath={bookingPath}
                        inline={{
                          onSignedIn: () => router.refresh(),
                        }}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="booking-notes">
                          {t("notes")}{" "}
                          <span className="text-muted-foreground font-normal">
                            ({common("optional")})
                          </span>
                        </Label>
                        <Textarea
                          id="booking-notes"
                          value={notes}
                          onChange={(event) => setNotes(event.target.value)}
                          placeholder={t("notesPlaceholder")}
                          rows={3}
                          maxLength={500}
                        />
                      </div>

                      <div className="border-border/70 bg-secondary/40 rounded-xl border p-4">
                        <p className="text-sm font-medium">{t("policy")}</p>
                        <p className="text-muted-foreground mt-1 text-sm">
                          {business("cancellationPolicy", { hours: cancellationWindowHours })}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </m.section>
          </AnimatePresence>
        </div>

        {/* Actions. On a phone they sit in a bar pinned to the bottom of the
            screen with the running total, the way a checkout does; on a wide
            screen they follow the content. */}
        <div
          className={cn(
            "bg-background/90 fixed inset-x-0 bottom-0 z-30 border-t px-4 py-3 backdrop-blur-lg",
            "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
            "lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:pt-2 lg:backdrop-blur-none",
          )}
        >
          <div className="mx-auto flex max-w-5xl items-center gap-3">
            {stepIndex > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={goBack}
                disabled={isPending}
                className="px-3"
              >
                <ArrowLeft className="size-4" aria-hidden />
                <span className="sr-only sm:not-sr-only">{common("back")}</span>
              </Button>
            ) : (
              <Button asChild variant="ghost" size="lg" className="px-3">
                <Link href={`/business/${slug}`}>
                  <ArrowLeft className="size-4" aria-hidden />
                  <span className="sr-only sm:not-sr-only">{common("back")}</span>
                </Link>
              </Button>
            )}

            {/* Running total on a phone, where the summary card is off screen. */}
            {service ? (
              <div className="min-w-0 flex-1 lg:hidden">
                <p className="truncate text-sm font-medium">{service.name}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {slot
                    ? `${formatDate(slot.starts_at, { timeZone: timezone, locale })}, ${formatTime(slot.starts_at, { timeZone: timezone, locale })}`
                    : formatDuration(service.durationMinutes, locale)}
                  {summaryPrice ? ` · ${summaryPrice}` : null}
                </p>
              </div>
            ) : (
              <div className="flex-1 lg:hidden" />
            )}

            {current === "confirm" ? (
              isSignedIn ? (
                <Button
                  type="button"
                  size="lg"
                  onClick={confirm}
                  disabled={isPending || !slot}
                  className="shadow-primary/30 ml-auto shadow-lg"
                >
                  {isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Check className="size-4" aria-hidden />
                  )}
                  {isPending ? t("confirming") : t("confirm")}
                </Button>
              ) : null
            ) : (
              <Button
                type="button"
                size="lg"
                onClick={goNext}
                disabled={!canAdvance}
                className="group ml-auto"
              >
                {common("next")}
                <ArrowRight
                  className="size-4 transition-transform duration-300 group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Summary */}
      <aside className="glowa-card hidden h-fit space-y-4 p-5 lg:sticky lg:top-24 lg:block">
        <div>
          <p className="text-muted-foreground text-xs tracking-wide uppercase">{t("summary")}</p>
          <p className="font-heading mt-1 text-lg">{businessName}</p>
        </div>

        <dl className="space-y-3 text-sm">
          {locationId ? (
            <SummaryRow label={t("stepLocation")}>
              {locations.find((l) => l.id === locationId)?.name}
            </SummaryRow>
          ) : null}

          <AnimatePresence initial={false}>
            {service ? (
              <SummaryRow key="service" label={t("stepService")}>
                {service.name}
              </SummaryRow>
            ) : null}
            {service ? (
              <m.div
                key="facts"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex gap-6"
              >
                <div>
                  <dt className="text-muted-foreground text-xs">{t("duration")}</dt>
                  <dd className="flex items-center gap-1.5">
                    <Clock className="size-3.5" aria-hidden />
                    {formatDuration(service.durationMinutes, locale)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">{t("price")}</dt>
                  <dd className="flex items-center gap-1.5 tabular-nums">
                    <Tag className="size-3.5" aria-hidden />
                    {summaryPrice}
                  </dd>
                </div>
              </m.div>
            ) : null}

            {staffChoice !== ANY_STAFF ? (
              <SummaryRow key="staff" label={t("stepStaff")}>
                {eligibleStaff.find((member) => member.id === staffChoice)?.displayName}
              </SummaryRow>
            ) : null}

            {slot ? (
              <SummaryRow key="slot" label={t("stepTime")}>
                {formatDate(slot.starts_at, { timeZone: timezone, locale })},{" "}
                {formatTime(slot.starts_at, { timeZone: timezone, locale })}–
                {formatTime(slot.ends_at, { timeZone: timezone, locale })}
              </SummaryRow>
            ) : null}
          </AnimatePresence>
        </dl>
      </aside>
    </div>
  );
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <m.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3 }}
      className="overflow-hidden"
    >
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd>{children}</dd>
    </m.div>
  );
}

/** The corner tick on a chosen card; springs in so the tap feels answered. */
function SelectedTick({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show ? (
        <m.span
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 28 }}
          className="bg-primary text-primary-foreground absolute top-3 right-3 flex size-6 items-center justify-center rounded-full"
          aria-hidden
        >
          <Check className="size-3.5" />
        </m.span>
      ) : null}
    </AnimatePresence>
  );
}
