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
import { useRouter } from "@/i18n/navigation";
import { addTimeOff } from "@/lib/actions/catalog";
import { instantFromZoned } from "@/lib/timezone";
import type { CalendarStaff } from "./types";

export function BlockTimeDialog({
  open,
  onOpenChange,
  businessId,
  timezone,
  staff,
  defaultDateKey,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  timezone: string;
  staff: CalendarStaff[];
  defaultDateKey: string;
}) {
  const t = useTranslations("admin.calendar");
  const common = useTranslations("common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [staffId, setStaffId] = useState(staff[0]?.id ?? "");
  const [dateKey, setDateKey] = useState(defaultDateKey);
  const [from, setFrom] = useState("12:00");
  const [to, setTo] = useState("13:00");
  const [reason, setReason] = useState("");

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!staffId) return;

    const [fh, fm] = from.split(":").map(Number);
    const [th, tm] = to.split(":").map(Number);
    const startsAt = instantFromZoned(dateKey, fh * 60 + fm, timezone);
    const endsAt = instantFromZoned(dateKey, th * 60 + tm, timezone);

    if (endsAt <= startsAt) {
      toast.error(t("errors.generic"));
      return;
    }

    startTransition(async () => {
      const result = await addTimeOff({
        businessId,
        staffProfileId: staffId,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        reason,
      });

      if (!result.ok) {
        toast.error(t("errors.generic"));
        return;
      }

      toast.success(t("blockCreated"));
      onOpenChange(false);
      setReason("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("blockTitle")}</DialogTitle>
          <DialogDescription>{t("blockReason")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="block-staff">{t("staff")}</Label>
            <Select value={staffId} onValueChange={setStaffId}>
              <SelectTrigger id="block-staff">
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

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="block-date">{t("startsAt")}</Label>
              <Input
                id="block-date"
                type="date"
                value={dateKey}
                onChange={(event) => setDateKey(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="block-from">{t("blockFrom")}</Label>
              <Input
                id="block-from"
                type="time"
                step={900}
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="block-to">{t("blockTo")}</Label>
              <Input
                id="block-to"
                type="time"
                step={900}
                value={to}
                onChange={(event) => setTo(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="block-reason">{t("blockReason")}</Label>
            <Input
              id="block-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={200}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {common("cancel")}
            </Button>
            <Button type="submit" disabled={isPending || !staffId}>
              {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {t("blockCreate")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
