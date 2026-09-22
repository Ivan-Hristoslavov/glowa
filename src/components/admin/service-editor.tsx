"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { localeLabels, routing, type Locale } from "@/i18n/routing";
import { deleteService, upsertService } from "@/lib/actions/catalog";

const SERVICE_CATEGORIES = [
  "hair", "barber", "nails", "lashes_brows", "skincare",
  "makeup", "massage", "spa", "tattoo", "other",
] as const;

type LocalizedDraft = Record<Locale, string>;

export type ServiceDraft = {
  id?: string;
  name: LocalizedDraft;
  description: LocalizedDraft;
  category: (typeof SERVICE_CATEGORIES)[number];
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  priceCents: number;
  requiresDeposit: boolean;
  depositCents: number;
  isActive: boolean;
  staffIds: string[];
};

export function emptyServiceDraft(): ServiceDraft {
  return {
    name: { bg: "", en: "", ro: "" },
    description: { bg: "", en: "", ro: "" },
    category: "hair",
    durationMinutes: 60,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    priceCents: 0,
    requiresDeposit: false,
    depositCents: 0,
    isActive: true,
    staffIds: [],
  };
}

export function ServiceEditor({
  businessId,
  staff,
  service,
  trigger,
}: {
  businessId: string;
  staff: Array<{ id: string; displayName: string }>;
  service?: ServiceDraft;
  trigger: React.ReactNode;
}) {
  const t = useTranslations("admin.services");
  const common = useTranslations("common");
  const categories = useTranslations("serviceCategories");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ServiceDraft>(service ?? emptyServiceDraft());
  const [isPending, startTransition] = useTransition();

  function patch(next: Partial<ServiceDraft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await upsertService({
        businessId,
        serviceId: draft.id,
        name: draft.name,
        description: draft.description,
        category: draft.category,
        durationMinutes: draft.durationMinutes,
        bufferBeforeMinutes: draft.bufferBeforeMinutes,
        bufferAfterMinutes: draft.bufferAfterMinutes,
        priceCents: draft.priceCents,
        requiresDeposit: draft.requiresDeposit,
        depositCents: draft.depositCents,
        isActive: draft.isActive,
        staffIds: draft.staffIds,
      });

      if (!result.ok) {
        toast.error(result.code === "name_required" ? t("name") : t("save"));
        return;
      }

      toast.success(draft.id ? t("updated") : t("created"));
      setOpen(false);
      router.refresh();
    });
  }

  function onDelete() {
    if (!draft.id) return;
    startTransition(async () => {
      const result = await deleteService(businessId, draft.id!);
      if (!result.ok) {
        toast.error(t("save"));
        return;
      }
      toast.success(t("deleted"));
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{draft.id ? t("edit") : t("add")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-5">
          {/* One tab per language: the schema stores {bg,en,ro} and Bulgarian
              is required, so the editor makes that structure visible. */}
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
                  <Label htmlFor={`service-name-${value}`}>
                    {t("name")}
                    {value === routing.defaultLocale ? " *" : ""}
                  </Label>
                  <Input
                    id={`service-name-${value}`}
                    value={draft.name[value]}
                    onChange={(event) =>
                      patch({ name: { ...draft.name, [value]: event.target.value } })
                    }
                    required={value === routing.defaultLocale}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`service-desc-${value}`}>{t("description")}</Label>
                  <Textarea
                    id={`service-desc-${value}`}
                    rows={3}
                    maxLength={1000}
                    value={draft.description[value]}
                    onChange={(event) =>
                      patch({
                        description: { ...draft.description, [value]: event.target.value },
                      })
                    }
                  />
                </div>
              </TabsContent>
            ))}
          </Tabs>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="service-category">{t("category")}</Label>
              <Select
                value={draft.category}
                onValueChange={(value) =>
                  patch({ category: value as ServiceDraft["category"] })
                }
              >
                <SelectTrigger id="service-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_CATEGORIES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {categories(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-duration">{t("duration")}</Label>
              <Input
                id="service-duration"
                type="number"
                min={5}
                max={1440}
                step={5}
                value={draft.durationMinutes}
                onChange={(event) => patch({ durationMinutes: Number(event.target.value) })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-price">{t("price")}</Label>
              <Input
                id="service-price"
                type="number"
                min={0}
                step={1}
                value={draft.priceCents / 100}
                onChange={(event) =>
                  patch({ priceCents: Math.round(Number(event.target.value) * 100) })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-buffer-before">{t("bufferBefore")}</Label>
              <Input
                id="service-buffer-before"
                type="number"
                min={0}
                max={240}
                step={5}
                value={draft.bufferBeforeMinutes}
                onChange={(event) =>
                  patch({ bufferBeforeMinutes: Number(event.target.value) })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-buffer-after">{t("bufferAfter")}</Label>
              <Input
                id="service-buffer-after"
                type="number"
                min={0}
                max={240}
                step={5}
                value={draft.bufferAfterMinutes}
                onChange={(event) =>
                  patch({ bufferAfterMinutes: Number(event.target.value) })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-deposit">{t("deposit")}</Label>
              <Input
                id="service-deposit"
                type="number"
                min={0}
                step={1}
                disabled={!draft.requiresDeposit}
                value={draft.depositCents / 100}
                onChange={(event) =>
                  patch({ depositCents: Math.round(Number(event.target.value) * 100) })
                }
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={draft.requiresDeposit}
                onCheckedChange={(value) => patch({ requiresDeposit: value })}
              />
              {t("requiresDeposit")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={draft.isActive}
                onCheckedChange={(value) => patch({ isActive: value })}
              />
              {t("active")}
            </label>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t("staff")}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {staff.map((member) => (
                <label key={member.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={draft.staffIds.includes(member.id)}
                    onCheckedChange={(checked) =>
                      patch({
                        staffIds: checked
                          ? [...draft.staffIds, member.id]
                          : draft.staffIds.filter((id) => id !== member.id),
                      })
                    }
                  />
                  {member.displayName}
                </label>
              ))}
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

export function AddServiceButton({
  businessId,
  staff,
}: {
  businessId: string;
  staff: Array<{ id: string; displayName: string }>;
}) {
  const t = useTranslations("admin.services");
  return (
    <ServiceEditor
      businessId={businessId}
      staff={staff}
      trigger={
        <Button>
          <Plus className="size-4" aria-hidden />
          {t("add")}
        </Button>
      }
    />
  );
}
