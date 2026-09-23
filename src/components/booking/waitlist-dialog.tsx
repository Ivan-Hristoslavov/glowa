"use client";

import { BellRing, Loader2 } from "lucide-react";
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
  DialogTrigger,
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
import { joinWaitlist } from "@/lib/actions/waitlist";

const ANY = "__any__";

/**
 * Joining the waitlist.
 *
 * Offered where a booking attempt would otherwise dead-end: the customer
 * wanted a day that is full, and today that is simply the end of the story.
 * A cancelled slot is revenue that already existed and is about to evaporate,
 * so this is the salon's cheapest possible sale.
 *
 * Deliberately not auto-booking. Being put into a time you never confirmed is
 * worse than missing it.
 */
export function WaitlistDialog({
  businessId,
  services,
  staff,
  defaultServiceId,
  isSignedIn,
}: {
  businessId: string;
  services: { id: string; name: string }[];
  staff: { id: string; displayName: string }[];
  defaultServiceId?: string | null;
  isSignedIn: boolean;
}) {
  const t = useTranslations("waitlist");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [[today, plus30]] = useState(() => [
    new Date().toISOString().slice(0, 10),
    new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
  ]);

  const [serviceId, setServiceId] = useState(defaultServiceId ?? ANY);
  const [staffId, setStaffId] = useState(ANY);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(plus30);
  const [note, setNote] = useState("");

  function submit() {
    startTransition(async () => {
      const result = await joinWaitlist({
        businessId,
        serviceId: serviceId === ANY ? null : serviceId,
        staffProfileId: staffId === ANY ? null : staffId,
        fromDate,
        toDate,
        note: note.trim() || undefined,
      });

      if (!result.ok) {
        toast.error(t(`errors.${result.code}`));
        return;
      }

      toast.success(t("joined"));
      setOpen(false);
      router.refresh();
    });
  }

  if (!isSignedIn) {
    return (
      <Button asChild variant="outline">
        <a href="?signin=waitlist">
          <BellRing className="size-4" />
          {t("cta")}
        </a>
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <BellRing className="size-4" />
          {t("cta")}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="waitlist-from">{t("from")}</Label>
              <Input
                id="waitlist-from"
                type="date"
                min={today}
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="waitlist-to">{t("to")}</Label>
              <Input
                id="waitlist-to"
                type="date"
                min={fromDate}
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="waitlist-service">{t("service")}</Label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger id="waitlist-service">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>{t("anyService")}</SelectItem>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {staff.length > 1 ? (
            <div className="space-y-2">
              <Label htmlFor="waitlist-staff">{t("staff")}</Label>
              <Select value={staffId} onValueChange={setStaffId}>
                <SelectTrigger id="waitlist-staff">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>{t("anyStaff")}</SelectItem>
                  {staff.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="waitlist-note">{t("note")}</Label>
            <Textarea
              id="waitlist-note"
              rows={2}
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t("notePlaceholder")}
            />
          </div>

          <p className="text-muted-foreground text-xs">{t("fairness")}</p>
        </div>

        <DialogFooter>
          <Button onClick={submit} disabled={pending || toDate < fromDate}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {t("join")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
