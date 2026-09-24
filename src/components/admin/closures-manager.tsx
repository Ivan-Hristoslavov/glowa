"use client";

import { TZDate } from "@date-fns/tz";
import { CalendarOff, Globe2, Loader2, MapPin, Trash2 } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import type { DateRange } from "react-day-picker";
import { bg, enGB, ro } from "react-day-picker/locale";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useRouter } from "@/i18n/navigation";
import { localeHrefLang, type Locale } from "@/i18n/routing";
import { addClosure, removeClosure } from "@/lib/actions/closures";
import { addDaysToKey, instantFromZoned, keyToDate, zonedDateKey } from "@/lib/timezone";
import { cn } from "@/lib/utils";

export type ClosureRow = {
  id: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
  locationId: string | null;
};

type ClosuresManagerProps = {
  businessId: string;
  timezone: string;
  locale: Locale;
  locations: { id: string; name: string }[];
  closures: ClosureRow[];
  canEdit: boolean;
};

const ALL = "__all__";

const PICKER_LOCALES = { bg, en: enGB, ro } as const;

/**
 * A date the picker shows, from a YYYY-MM-DD key, at noon on the salon's
 * clock. The picker runs in the salon's timezone too (`timeZone` prop), so
 * the server and the browser render the same month whatever zone the owner's
 * laptop is in - and the day you tap is the salon's day.
 */
function keyToPickerDate(key: string, timeZone: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new TZDate(year, month - 1, day, 12, 0, 0, timeZone);
}

function pickerDateToKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function minutesOf(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Days and hours the salon does not take bookings: holidays, a refurbishment,
 * a training day, an afternoon off.
 *
 * Everything is entered on the salon's own clock and converted with its
 * timezone here (DST-safe), so the owner never thinks about UTC and the same
 * screen works for a salon in Sofia, Bucharest or Berlin. Availability is
 * enforced in Postgres (`get_available_slots`), not in this component.
 */
export function ClosuresManager({
  businessId,
  timezone,
  locale,
  locations,
  closures,
  canEdit,
}: ClosuresManagerProps) {
  const t = useTranslations("admin.timeOff");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [todayKey] = useState(() => zonedDateKey(new Date(), timezone));
  const [range, setRange] = useState<DateRange | undefined>(() => ({
    from: keyToPickerDate(todayKey, timezone),
    to: keyToPickerDate(todayKey, timezone),
  }));
  const [allDay, setAllDay] = useState(true);
  const [fromTime, setFromTime] = useState("12:00");
  const [toTime, setToTime] = useState("18:00");
  const [locationId, setLocationId] = useState<string>(ALL);
  const [reason, setReason] = useState("");

  const dateFormat = new Intl.DateTimeFormat(localeHrefLang[locale], {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: timezone,
  });
  const timeFormat = new Intl.DateTimeFormat(localeHrefLang[locale], {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });

  const fromKey = range?.from ? pickerDateToKey(range.from) : null;
  const toKey = range?.to ? pickerDateToKey(range.to) : fromKey;

  function interval() {
    if (!fromKey || !toKey) return null;
    const startsAt = allDay
      ? instantFromZoned(fromKey, 0, timezone)
      : instantFromZoned(fromKey, minutesOf(fromTime), timezone);
    const endsAt = allDay
      ? instantFromZoned(addDaysToKey(toKey, 1), 0, timezone)
      : instantFromZoned(toKey, minutesOf(toTime), timezone);
    return endsAt > startsAt ? { startsAt, endsAt } : null;
  }

  const planned = interval();

  function describe(startsAt: Date | string, endsAt: Date | string) {
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    const startKey = zonedDateKey(start, timezone);
    const endKey = zonedDateKey(end, timezone);
    const endsAtMidnight = timeFormat.format(end) === timeFormat.format(keyToMidnight(endKey));
    const lastDayKey = endsAtMidnight ? addDaysToKey(endKey, -1) : endKey;
    const wholeDays =
      timeFormat.format(start) === timeFormat.format(keyToMidnight(startKey)) && endsAtMidnight;

    if (wholeDays) {
      return startKey === lastDayKey
        ? `${dateFormat.format(start)} · ${t("allDayShort")}`
        : `${dateFormat.format(start)} – ${dateFormat.format(keyToDate(lastDayKey))} · ${t("allDayShort")}`;
    }
    return startKey === endKey
      ? `${dateFormat.format(start)}, ${timeFormat.format(start)}–${timeFormat.format(end)}`
      : `${dateFormat.format(start)} ${timeFormat.format(start)} – ${dateFormat.format(end)} ${timeFormat.format(end)}`;
  }

  function keyToMidnight(key: string) {
    return instantFromZoned(key, 0, timezone);
  }

  function preset(days: number, offset = 0) {
    const from = addDaysToKey(todayKey, offset);
    setRange({ from: keyToPickerDate(from, timezone), to: keyToPickerDate(addDaysToKey(from, days - 1), timezone) });
    setAllDay(true);
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const value = interval();
    if (!value) {
      toast.error(t("errors.range"));
      return;
    }
    startTransition(async () => {
      const result = await addClosure({
        businessId,
        locationId: locationId === ALL ? null : locationId,
        startsAt: value.startsAt.toISOString(),
        endsAt: value.endsAt.toISOString(),
        reason,
      });
      if (!result.ok) {
        toast.error(result.code === "invalid" ? t("errors.range") : t("errors.generic"));
        return;
      }
      if (result.overlapping > 0) {
        toast.warning(t("overlapping", { count: result.overlapping }), { duration: 8000 });
      } else {
        toast.success(t("added"));
      }
      setReason("");
      router.refresh();
    });
  }

  function onRemove(closureId: string) {
    startTransition(async () => {
      const result = await removeClosure({ businessId, closureId });
      if (!result.ok) {
        toast.error(t("errors.generic"));
        return;
      }
      toast.success(t("removed"));
      router.refresh();
    });
  }

  // Days already closed are marked on the picker so nobody closes them twice.
  const closedDays = closures.flatMap((closure) => {
    const start = zonedDateKey(new Date(closure.startsAt), timezone);
    const end = zonedDateKey(new Date(new Date(closure.endsAt).getTime() - 1), timezone);
    const days: Date[] = [];
    for (let key = start; key <= end && days.length < 400; key = addDaysToKey(key, 1)) {
      days.push(keyToPickerDate(key, timezone));
    }
    return days;
  });

  const locationName = (id: string | null) =>
    id ? (locations.find((location) => location.id === id)?.name ?? "") : t("allLocations");

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      {canEdit ? (
        <form onSubmit={onSubmit} className="glowa-card space-y-5 rounded-3xl p-5 sm:p-6">
          <div>
            <h2 className="font-heading text-xl">{t("formTitle")}</h2>
            <p className="text-muted-foreground mt-1 text-sm">{t("formBody")}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { label: t("presetToday"), days: 1, offset: 0 },
              { label: t("presetTomorrow"), days: 1, offset: 1 },
              { label: t("presetWeek"), days: 7, offset: 0 },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => preset(option.days, option.offset)}
                className="glowa-focus hover:border-primary/50 hover:text-primary bg-card rounded-full border px-3 py-1 text-xs font-medium transition-colors"
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="bg-background/60 flex justify-center rounded-2xl border p-2">
            <Calendar
              mode="range"
              selected={range}
              onSelect={setRange}
              numberOfMonths={1}
              weekStartsOn={1}
              timeZone={timezone}
              locale={PICKER_LOCALES[locale]}
              disabled={{ before: keyToPickerDate(todayKey, timezone) }}
              modifiers={{ closed: closedDays }}
              modifiersClassNames={{
                closed:
                  "[&>button]:line-through [&>button]:decoration-destructive/70 [&>button]:text-muted-foreground",
              }}
              className="[--cell-size:--spacing(10)]"
            />
          </div>

          <label className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm">
            <span>
              <span className="block font-medium">{t("allDay")}</span>
              <span className="text-muted-foreground block text-xs">{t("allDayHint")}</span>
            </span>
            <Switch checked={allDay} onCheckedChange={setAllDay} />
          </label>

          <AnimatePresence initial={false}>
            {!allDay ? (
              <m.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <Label htmlFor="closure-from">{t("fromTime", { date: fromKey ? dateFormat.format(keyToDate(fromKey)) : "" })}</Label>
                    <Input
                      id="closure-from"
                      type="time"
                      step={900}
                      value={fromTime}
                      onChange={(event) => setFromTime(event.target.value)}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="closure-to">{t("toTime", { date: toKey ? dateFormat.format(keyToDate(toKey)) : "" })}</Label>
                    <Input
                      id="closure-to"
                      type="time"
                      step={900}
                      value={toTime}
                      onChange={(event) => setToTime(event.target.value)}
                      className="h-11"
                    />
                  </div>
                </div>
              </m.div>
            ) : null}
          </AnimatePresence>

          {locations.length > 1 ? (
            <div className="space-y-1.5">
              <Label>{t("location")}</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("allLocations")}</SelectItem>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="closure-reason">{t("reason")}</Label>
            <Input
              id="closure-reason"
              value={reason}
              maxLength={200}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t("reasonPlaceholder")}
              className="h-11"
            />
            <p className="text-muted-foreground text-xs">{t("reasonHint")}</p>
          </div>

          <div
            className={cn(
              "rounded-2xl border p-4 text-sm transition-colors",
              planned ? "border-primary/30 bg-accent/50" : "border-destructive/40 bg-destructive/5",
            )}
          >
            <p className="font-medium">
              {planned ? describe(planned.startsAt, planned.endsAt) : t("errors.range")}
            </p>
            <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
              <Globe2 className="size-3.5" aria-hidden />
              {t("timezoneNote", { zone: timezone })}
            </p>
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={isPending || !planned}>
            {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CalendarOff className="size-4" aria-hidden />}
            {t("submit")}
          </Button>
        </form>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-heading text-xl">{t("listTitle")}</h2>
        {closures.length === 0 ? (
          <div className="text-muted-foreground rounded-3xl border border-dashed p-8 text-center text-sm">
            <CalendarOff className="mx-auto mb-3 size-6 opacity-60" aria-hidden />
            {t("listEmpty")}
          </div>
        ) : (
          <ul className="space-y-2.5">
            <AnimatePresence initial={false}>
              {closures.map((closure) => (
                <m.li
                  key={closure.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 24 }}
                  className="glowa-card flex items-start gap-3 rounded-2xl p-4"
                >
                  <span className="bg-destructive/10 text-destructive flex size-10 shrink-0 items-center justify-center rounded-xl">
                    <CalendarOff className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{describe(closure.startsAt, closure.endsAt)}</p>
                    <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 text-xs">
                      {locations.length > 1 ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3" aria-hidden />
                          {locationName(closure.locationId)}
                        </span>
                      ) : null}
                      {closure.reason ? <span>{closure.reason}</span> : null}
                    </p>
                  </div>
                  {canEdit ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemove(closure.id)}
                      disabled={isPending}
                      aria-label={t("remove")}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  ) : null}
                </m.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>
    </div>
  );
}
