"use client";

import { CalendarClock, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { SlotPicker } from "@/components/booking/slot-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { rescheduleAppointment, type Slot } from "@/lib/actions/booking";
import { bookingErrorCode } from "@/lib/booking-errors";

type RescheduleDialogProps = {
  appointmentId: string;
  serviceId: string;
  staffProfileId: string | null;
  locationId: string | null;
  timezone: string;
  locale: Locale;
};

export function RescheduleDialog({
  appointmentId,
  serviceId,
  staffProfileId,
  locationId,
  timezone,
  locale,
}: RescheduleDialogProps) {
  const t = useTranslations("bookings");
  const booking = useTranslations("booking");
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function onConfirm() {
    if (!slot) return;
    startTransition(async () => {
      const result = await rescheduleAppointment({
        appointmentId,
        startsAt: slot.starts_at,
        staffProfileId: slot.staff_profile_id ?? staffProfileId,
      });

      if (!result.ok) {
        toast.error(t(`errors.${bookingErrorCode(result.code)}`));
        return;
      }

      toast.success(t("rescheduled"));
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <CalendarClock className="size-4" aria-hidden />
          {t("reschedule")}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85dvh] flex-col gap-4 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("rescheduleTitle")}</DialogTitle>
          <DialogDescription>{booking("chooseTime")}</DialogDescription>
        </DialogHeader>

        {/* The time grid scrolls; the confirm button stays put, so a long
            list of slots never hides the action. */}
        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          {open ? (
            <SlotPicker
              serviceId={serviceId}
              staffProfileId={staffProfileId}
              locationId={locationId}
              timezone={timezone}
              locale={locale}
              value={slot}
              onChange={setSlot}
            />
          ) : null}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button onClick={onConfirm} disabled={!slot || isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {t("reschedule")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
