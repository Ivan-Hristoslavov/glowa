"use client";

import { ArrowLeft, Check, Clock, Loader2, Sparkles, Tag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { SlotPicker } from "@/components/booking/slot-picker";
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

export function BookingFlow({
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
  const [staffChoice, setStaffChoice] = useState<string>(ANY_STAFF);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [notes, setNotes] = useState("");
  const [stepIndex, setStepIndex] = useState(0);

  const service = services.find((item) => item.id === serviceId) ?? null;

  const eligibleStaff = useMemo(
    () => (service ? staff.filter((member) => service.staffIds.includes(member.id)) : []),
    [service, staff],
  );

  const steps = useMemo<StepId[]>(() => {
    const list: StepId[] = [];
    if (locations.length > 1) list.push("location");
    list.push("service");
    if (eligibleStaff.length > 1) list.push("staff");
    list.push("time", "confirm");
    return list;
  }, [eligibleStaff.length, locations.length]);

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
      });

      if (!result.ok) {
        const code = result.code;
        if (code === "unauthenticated") {
          router.push("/login");
          return;
        }
        toast.error(
          code === "slot_unavailable" || code === "slot_taken"
            ? t(`errors.${code}`)
            : t("errors.generic"),
        );
        // The slot is gone; force a refetch by clearing the selection.
        setSlot(null);
        setStepIndex(steps.indexOf("time"));
        return;
      }

      router.push(`/bookings/${result.appointmentId}?booked=1`);
    });
  }

  const summaryPrice = service
    ? formatPrice(service.priceCents, service.currency, locale)
    : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        {/* Progress. The colour alone does not say which step you are on, so
            the current item is marked for assistive tech as well. */}
        <ol
          aria-label={t("stepsLabel")}
          className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs"
        >
          {steps.map((step, index) => (
            <li
              key={step}
              aria-current={index === stepIndex ? "step" : undefined}
              className="flex items-center gap-2"
            >
              <span
                className={cn(
                  "rounded-full px-2 py-0.5",
                  index === stepIndex && "bg-primary text-primary-foreground font-medium",
                  index < stepIndex && "text-foreground",
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
              {index < steps.length - 1 ? <span aria-hidden>·</span> : null}
            </li>
          ))}
        </ol>

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
                    setStaffChoice(ANY_STAFF);
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
                  <span className="shrink-0 text-sm font-medium">
                    {formatPrice(item.priceCents, item.currency, locale)}
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
                  <Avatar className="size-11">
                    {member.avatarUrl ? <AvatarImage src={member.avatarUrl} alt="" /> : null}
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
            />
          </section>
        ) : null}

        {current === "confirm" && service && slot ? (
          <section className="space-y-4">
            <h2 className="font-heading text-xl">{t("stepConfirm")}</h2>

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

        <div className="flex items-center gap-3 pt-2">
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
              ) : (
                <Check className="size-4" aria-hidden />
              )}
              {isPending ? t("confirming") : t("confirm")}
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
      <aside className="glowa-card h-fit space-y-4 p-5 lg:sticky lg:top-24">
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
