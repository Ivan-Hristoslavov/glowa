"use client";

import { Loader2, Plus, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { RequiredNote } from "@/components/common/required-note";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { localeLabels, routing, type Locale } from "@/i18n/routing";
import { upsertCampaign } from "@/lib/actions/crm";
import { previewAudienceAction } from "@/lib/actions/marketing";

const TYPES = ["win_back", "reminder", "birthday", "anniversary", "custom"] as const;

export type CampaignDraft = {
  id?: string;
  name: string;
  type: (typeof TYPES)[number];
  lastVisitBeforeDays: string;
  minVisits: string;
  subject: Record<Locale, string>;
  body: Record<Locale, string>;
};

export function emptyCampaignDraft(): CampaignDraft {
  return {
    name: "",
    type: "win_back",
    lastVisitBeforeDays: "60",
    minVisits: "1",
    subject: { bg: "", en: "", ro: "" },
    body: { bg: "", en: "", ro: "" },
  };
}

export function CampaignEditor({
  businessId,
  campaign,
  trigger,
}: {
  businessId: string;
  campaign?: CampaignDraft;
  trigger?: React.ReactNode;
}) {
  const t = useTranslations("admin.marketing");
  const common = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CampaignDraft>(campaign ?? emptyCampaignDraft());
  const [recipients, setRecipients] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  function patch(next: Partial<CampaignDraft>) {
    setDraft((current) => ({ ...current, ...next }));
    setRecipients(null);
  }

  function audience() {
    return {
      last_visit_before_days: draft.lastVisitBeforeDays
        ? Number(draft.lastVisitBeforeDays)
        : undefined,
      min_visits: draft.minVisits ? Number(draft.minVisits) : undefined,
    };
  }

  function preview() {
    startTransition(async () => {
      const result = await previewAudienceAction(businessId, audience());
      setRecipients(result.ok ? result.count : 0);
    });
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await upsertCampaign({
        businessId,
        campaignId: draft.id,
        name: draft.name,
        type: draft.type,
        audience: audience(),
        subject: draft.subject,
        body: draft.body,
      });

      if (!result.ok) {
        toast.error(common("retry"));
        return;
      }
      toast.success(t("saved"));
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="size-4" aria-hidden />
            {t("newCampaign")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{draft.id ? t("campaigns") : t("newCampaign")}</DialogTitle>
          <DialogDescription>{t("consentNote")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-5">

          <RequiredNote />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="campaign-name" required>{t("name")}</Label>
              <Input
                id="campaign-name"
                value={draft.name}
                onChange={(event) => patch({ name: event.target.value })}
                required
                minLength={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaign-type">{t("campaigns")}</Label>
              <Select
                value={draft.type}
                onValueChange={(value) => patch({ type: value as CampaignDraft["type"] })}
              >
                <SelectTrigger id="campaign-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`type.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">{t("audience")}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="campaign-lastvisit">{t("lastVisitBefore")}</Label>
                <Input
                  id="campaign-lastvisit"
                  type="number"
                  min={1}
                  max={3650}
                  value={draft.lastVisitBeforeDays}
                  onChange={(event) => patch({ lastVisitBeforeDays: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="campaign-minvisits">{t("minVisits")}</Label>
                <Input
                  id="campaign-minvisits"
                  type="number"
                  min={0}
                  max={1000}
                  value={draft.minVisits}
                  onChange={(event) => patch({ minVisits: event.target.value })}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" size="sm" onClick={preview} disabled={isPending}>
                <Users className="size-4" aria-hidden />
                {t("preview")}
              </Button>
              {recipients !== null ? (
                <span className="text-muted-foreground text-sm">
                  {recipients === 0 ? t("noRecipients") : t("recipients", { count: recipients })}
                </span>
              ) : null}
            </div>
          </fieldset>

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
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor={`campaign-subject-${value}`}>{t("subject")}</Label>
                    <Input
                      id={`campaign-subject-${value}`}
                      value={draft.subject[value]}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          subject: { ...current.subject, [value]: event.target.value },
                        }))
                      }
                    />
                  </div>

                  {/* Per language, like the subject: a client reading Romanian
                      should not get a Bulgarian paragraph under a Romanian
                      subject line. */}
                  <div className="space-y-2">
                    <Label htmlFor={`campaign-body-${value}`}>{t("body")}</Label>
                    <Textarea
                      id={`campaign-body-${value}`}
                      rows={5}
                      maxLength={4000}
                      value={draft.body[value]}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          body: { ...current.body, [value]: event.target.value },
                        }))
                      }
                    />
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {common("cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
