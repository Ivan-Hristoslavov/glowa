"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { createAdminAppointment } from "@/lib/actions/admin-appointments";
import { instantFromZoned } from "@/lib/timezone";
import type { CalendarLocation, CalendarService, CalendarStaff } from "./types";

type NewAppointmentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  timezone: string;
  locations: CalendarLocation[];
  services: CalendarService[];
  staff: CalendarStaff[];
  /** Pre-filled from the grid cell the user clicked. */
  initial: { dateKey: string; minutes: number; staffProfileId: string } | null;
};

function minutesToTimeValue(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function NewAppointmentDialog({
  open,
  onOpenChange,
  businessId,
  timezone,
  locations,
  services,
  staff,
  initial,
}: NewAppointmentDialogProps) {
  const t = useTranslations("admin.calendar");
  const common = useTranslations("common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [staffId, setStaffId] = useState(initial?.staffProfileId ?? staff[0]?.id ?? "");
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [dateKey, setDateKey] = useState(initial?.dateKey ?? "");
  const [time, setTime] = useState(minutesToTimeValue(initial?.minutes ?? 540));
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");

  // Re-seed from the clicked cell each time the dialog opens.
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const seedKey = initial ? `${initial.dateKey}-${initial.minutes}-${initial.staffProfileId}` : null;
  if (open && seedKey && seedKey !== seededFor) {
    setSeededFor(seedKey);
    setDateKey(initial!.dateKey);
    setTime(minutesToTimeValue(initial!.minutes));
    setStaffId(initial!.staffProfileId);
  }

  const eligibleServices = services.filter(
    (service) => service.staffIds.length === 0 || service.staffIds.includes(staffId),
  );

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!serviceId || !staffId || !dateKey) return;

    const [hh, mm] = time.split(":").map(Number);
    const startsAt = instantFromZoned(dateKey, hh * 60 + mm, timezone);

    startTransition(async () => {
      const result = await createAdminAppointment({
        businessId,
        serviceId,
        staffProfileId: staffId,
        locationId: locationId || null,
        startsAt: startsAt.toISOString(),
        customerName,
        customerEmail,
        customerPhone,
        internalNotes: notes,
      });

      if (!result.ok) {
        toast.error(
          result.code === "overlap"
            ? t("errors.overlap")
            : result.code === "customer_required"
              ? t("guestName")
              : t("errors.generic"),
        );
        return;
      }

      toast.success(t("created"));
      onOpenChange(false);
      setCustomerName("");
      setCustomerEmail("");
      setCustomerPhone("");
      setNotes("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("newAppointment")}</DialogTitle>
          <DialogDescription>{t("internalNotesHint")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="appt-staff">{t("staff")}</Label>
              <Select value={staffId} onValueChange={setStaffId}>
                <SelectTrigger id="appt-staff">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="appt-service">{t("service")}</Label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger id="appt-service">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {eligibleServices.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name} · {service.durationMinutes} min
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="appt-date">{t("startsAt")}</Label>
              <Input
                id="appt-date"
                type="date"
                value={dateKey}
                onChange={(event) => setDateKey(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="appt-time" className="sr-only sm:not-sr-only">
                {t("startsAt")}
              </Label>
              <Input
                id="appt-time"
                type="time"
                step={900}
                value={time}
                onChange={(event) => setTime(event.target.value)}
                required
              />
            </div>

            {locations.length > 1 ? (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="appt-location">{t("service")}</Label>
                <Select value={locationId} onValueChange={setLocationId}>
                  <SelectTrigger id="appt-location">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          <fieldset className="grid gap-4 sm:grid-cols-3">
            <legend className="mb-2 text-sm font-medium">{t("customer")}</legend>
            <div className="space-y-2">
              <Label htmlFor="appt-name">{t("guestName")}</Label>
              <Input
                id="appt-name"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="appt-email">{t("guestEmail")}</Label>
              <Input
                id="appt-email"
                type="email"
                value={customerEmail}
                onChange={(event) => setCustomerEmail(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="appt-phone">{t("guestPhone")}</Label>
              <Input
                id="appt-phone"
                type="tel"
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
              />
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="appt-notes">{t("internalNotes")}</Label>
            <Textarea
              id="appt-notes"
              rows={2}
              maxLength={2000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {common("cancel")}
            </Button>
            <Button type="submit" disabled={isPending || !serviceId || !staffId}>
              {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {isPending ? t("creating") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
