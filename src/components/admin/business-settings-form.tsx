"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { localeLabels, routing, type Locale } from "@/i18n/routing";
import { updateBusinessSettings } from "@/lib/actions/business";

export type BusinessSettingsDraft = {
  name: string;
  phone: string;
  email: string;
  website: string;
  googleReviewUrl: string;
  description: Record<Locale, string>;
  cancellationWindowHours: number;
  minLeadMinutes: number;
  maxAdvanceDays: number;
  allowCustomerReschedule: boolean;
};

export function BusinessSettingsForm({
  businessId,
  initial,
}: {
  businessId: string;
  initial: BusinessSettingsDraft;
}) {
  const t = useTranslations("admin.onboarding");
  const business = useTranslations("business");
  const common = useTranslations("common");
  const router = useRouter();
  const [draft, setDraft] = useState(initial);
  const [isPending, startTransition] = useTransition();

  function patch(next: Partial<BusinessSettingsDraft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateBusinessSettings({ businessId, ...draft });
      if (!result.ok) {
        toast.error(common("retry"));
        return;
      }
      toast.success(common("save"));
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="settings-name">{t("name")}</Label>
          <Input
            id="settings-name"
            value={draft.name}
            onChange={(event) => patch({ name: event.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-phone">{t("phone")}</Label>
          <Input
            id="settings-phone"
            type="tel"
            value={draft.phone}
            onChange={(event) => patch({ phone: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-email">Email</Label>
          <Input
            id="settings-email"
            type="email"
            value={draft.email}
            onChange={(event) => patch({ email: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-website">{business("website")}</Label>
          <Input
            id="settings-website"
            type="url"
            value={draft.website}
            onChange={(event) => patch({ website: event.target.value })}
          />
        </div>
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
          <TabsContent key={value} value={value} className="mt-4">
            <div className="space-y-2">
              <Label htmlFor={`settings-desc-${value}`}>{business("about")}</Label>
              <Textarea
                id={`settings-desc-${value}`}
                rows={4}
                maxLength={2000}
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

      <fieldset className="space-y-4">
        <legend className="text-sm font-medium">{business("policies")}</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="settings-window">
              {business("cancellationPolicy", { hours: draft.cancellationWindowHours })}
            </Label>
            <Input
              id="settings-window"
              type="number"
              min={0}
              max={336}
              value={draft.cancellationWindowHours}
              onChange={(event) =>
                patch({ cancellationWindowHours: Number(event.target.value) })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-lead">
              {business("leadTime", { minutes: draft.minLeadMinutes })}
            </Label>
            <Input
              id="settings-lead"
              type="number"
              min={0}
              max={43200}
              step={15}
              value={draft.minLeadMinutes}
              onChange={(event) => patch({ minLeadMinutes: Number(event.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-advance">
              {business("advanceWindow", { days: draft.maxAdvanceDays })}
            </Label>
            <Input
              id="settings-advance"
              type="number"
              min={1}
              max={365}
              value={draft.maxAdvanceDays}
              onChange={(event) => patch({ maxAdvanceDays: Number(event.target.value) })}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={draft.allowCustomerReschedule}
            onCheckedChange={(value) => patch({ allowCustomerReschedule: value })}
          />
          {business("rescheduleAllowed")}
        </label>
      </fieldset>

      <Button type="submit" disabled={isPending}>
        {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {common("save")}
      </Button>
    </form>
  );
}
