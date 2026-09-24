"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { RequiredNote } from "@/components/common/required-note";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { localeLabels, routing, type Locale } from "@/i18n/routing";
import { deleteStaff, upsertStaff } from "@/lib/actions/catalog";

const PALETTE = ["#D96C61", "#A9B6A6", "#C9A893", "#8E8279", "#3F4A43", "#0F1212"];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export type StaffDraft = {
  id?: string;
  displayName: string;
  title: Record<Locale, string>;
  bio: Record<Locale, string>;
  color: string;
  isBookable: boolean;
  workingHours: Array<{ dayOfWeek: number; startsAt: string; endsAt: string }>;
};

export function emptyStaffDraft(): StaffDraft {
  return {
    displayName: "",
    title: { bg: "", en: "", ro: "" },
    bio: { bg: "", en: "", ro: "" },
    color: PALETTE[0],
    isBookable: true,
    workingHours: [2, 3, 4, 5, 6].map((dayOfWeek) => ({
      dayOfWeek,
      startsAt: "09:00",
      endsAt: "18:00",
    })),
  };
}

export function StaffEditor({
  businessId,
  member,
  trigger,
}: {
  businessId: string;
  member?: StaffDraft;
  trigger: React.ReactNode;
}) {
  const t = useTranslations("admin.staff");
  const common = useTranslations("common");
  const weekdays = useTranslations("weekdays");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<StaffDraft>(member ?? emptyStaffDraft());
  const [isPending, startTransition] = useTransition();

  function patch(next: Partial<StaffDraft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function hoursFor(dayOfWeek: number) {
    return draft.workingHours.find((row) => row.dayOfWeek === dayOfWeek) ?? null;
  }

  function setDayEnabled(dayOfWeek: number, enabled: boolean) {
    patch({
      workingHours: enabled
        ? [...draft.workingHours, { dayOfWeek, startsAt: "09:00", endsAt: "18:00" }]
        : draft.workingHours.filter((row) => row.dayOfWeek !== dayOfWeek),
    });
  }

  function setDayTime(dayOfWeek: number, field: "startsAt" | "endsAt", value: string) {
    patch({
      workingHours: draft.workingHours.map((row) =>
        row.dayOfWeek === dayOfWeek ? { ...row, [field]: value } : row,
      ),
    });
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await upsertStaff({
        businessId,
        staffProfileId: draft.id,
        displayName: draft.displayName,
        title: draft.title,
        bio: draft.bio,
        color: draft.color,
        isBookable: draft.isBookable,
        workingHours: draft.workingHours,
      });

      if (!result.ok) {
        toast.error(t("save"));
        return;
      }
      toast.success(t("saved"));
      setOpen(false);
      router.refresh();
    });
  }

  function onDelete() {
    if (!draft.id) return;
    startTransition(async () => {
      const result = await deleteStaff(businessId, draft.id!);
      if (!result.ok) {
        toast.error(t("save"));
        return;
      }
      toast.success(t("removed"));
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{draft.id ? t("title") : t("add")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-5">

          <RequiredNote />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="staff-name" required>{t("displayName")}</Label>
              <Input
                id="staff-name"
                value={draft.displayName}
                onChange={(event) => patch({ displayName: event.target.value })}
                required
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t("color")}</legend>
              <div className="flex gap-2">
                {PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={color}
                    aria-pressed={draft.color.toUpperCase() === color.toUpperCase()}
                    onClick={() => patch({ color })}
                    className="glowa-focus size-8 rounded-full ring-offset-2 aria-pressed:ring-2 aria-pressed:ring-current"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </fieldset>
          </div>

          <Tabs defaultValue={routing.defaultLocale}>
            <TabsList>
              {routing.locales.map((value) => (
                <TabsTrigger key={value} value={value}>
                  {localeLabels[value]}
                </TabsTrigger>
              ))}
            </TabsList>
            {routing.locales.map((value) => (
              <TabsContent key={value} value={value} className="mt-4 space-y-3">
                <div className="space-y-2">
                  <Label htmlFor={`staff-title-${value}`}>{t("jobTitle")}</Label>
                  <Input
                    id={`staff-title-${value}`}
                    value={draft.title[value]}
                    onChange={(event) =>
                      patch({ title: { ...draft.title, [value]: event.target.value } })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`staff-bio-${value}`}>{t("bio")}</Label>
                  <Textarea
                    id={`staff-bio-${value}`}
                    rows={3}
                    maxLength={1000}
                    value={draft.bio[value]}
                    onChange={(event) =>
                      patch({ bio: { ...draft.bio, [value]: event.target.value } })
                    }
                  />
                </div>
              </TabsContent>
            ))}
          </Tabs>

          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={draft.isBookable}
              onCheckedChange={(value) => patch({ isBookable: value })}
            />
            {t("bookable")}
          </label>

          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">{t("workingHours")}</legend>
            <div className="space-y-2">
              {DAY_ORDER.map((dayOfWeek) => {
                const hours = hoursFor(dayOfWeek);
                return (
                  <div key={dayOfWeek} className="flex flex-wrap items-center gap-3">
                    <label className="flex w-36 items-center gap-2 text-sm">
                      <Switch
                        checked={hours !== null}
                        onCheckedChange={(value) => setDayEnabled(dayOfWeek, value)}
                      />
                      {weekdays(String(dayOfWeek))}
                    </label>
                    <Input
                      type="time"
                      step={900}
                      className="w-28"
                      disabled={hours === null}
                      value={hours?.startsAt ?? "09:00"}
                      onChange={(event) =>
                        setDayTime(dayOfWeek, "startsAt", event.target.value)
                      }
                      aria-label={`${weekdays(String(dayOfWeek))} ${t("from")}`}
                    />
                    <span className="text-muted-foreground text-sm">–</span>
                    <Input
                      type="time"
                      step={900}
                      className="w-28"
                      disabled={hours === null}
                      value={hours?.endsAt ?? "18:00"}
                      onChange={(event) => setDayTime(dayOfWeek, "endsAt", event.target.value)}
                      aria-label={`${weekdays(String(dayOfWeek))} ${t("to")}`}
                    />
                  </div>
                );
              })}
            </div>
          </fieldset>

          <DialogFooter className="gap-2 sm:justify-between">
            {draft.id ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={onDelete}
                disabled={isPending}
              >
                <Trash2 className="size-4" aria-hidden />
                {common("remove")}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {common("cancel")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {t("save")}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddStaffButton({ businessId }: { businessId: string }) {
  const t = useTranslations("admin.staff");
  return (
    <StaffEditor
      businessId={businessId}
      trigger={
        <Button>
          <Plus className="size-4" aria-hidden />
          {t("add")}
        </Button>
      }
    />
  );
}
