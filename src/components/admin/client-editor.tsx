"use client";

import { Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { updateBusinessClient } from "@/lib/actions/crm";

export type ClientDraft = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  notes: string;
  tags: string[];
  consentMarketing: boolean;
};

export function ClientEditor({
  businessId,
  client,
  canEdit,
}: {
  businessId: string;
  client: ClientDraft;
  canEdit: boolean;
}) {
  const t = useTranslations("admin.clients");
  const common = useTranslations("common");
  const router = useRouter();
  const [draft, setDraft] = useState(client);
  const [tagInput, setTagInput] = useState("");
  const [isPending, startTransition] = useTransition();

  function patch(next: Partial<ClientDraft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function addTag() {
    const value = tagInput.trim().toLowerCase();
    if (!value || draft.tags.includes(value) || draft.tags.length >= 20) return;
    patch({ tags: [...draft.tags, value] });
    setTagInput("");
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateBusinessClient({
        businessId,
        clientId: draft.id,
        fullName: draft.fullName,
        email: draft.email,
        phone: draft.phone,
        notes: draft.notes,
        tags: draft.tags,
        consentMarketing: draft.consentMarketing,
      });

      if (!result.ok) {
        toast.error(common("retry"));
        return;
      }
      toast.success(t("saved"));
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="client-name">{t("title")}</Label>
          <Input
            id="client-name"
            value={draft.fullName}
            onChange={(event) => patch({ fullName: event.target.value })}
            disabled={!canEdit}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="client-phone">{t("search")}</Label>
          <Input
            id="client-phone"
            type="tel"
            value={draft.phone}
            onChange={(event) => patch({ phone: event.target.value })}
            disabled={!canEdit}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="client-notes">{t("notes")}</Label>
        <Textarea
          id="client-notes"
          rows={4}
          maxLength={4000}
          placeholder={t("notesPlaceholder")}
          value={draft.notes}
          onChange={(event) => patch({ notes: event.target.value })}
          disabled={!canEdit}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="client-tags">{t("tags")}</Label>
        <div className="flex flex-wrap gap-1.5">
          {draft.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 pr-1">
              {tag}
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => patch({ tags: draft.tags.filter((item) => item !== tag) })}
                  aria-label={`${common("remove")} ${tag}`}
                  className="hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              ) : null}
            </Badge>
          ))}
        </div>
        {canEdit ? (
          <div className="flex gap-2">
            <Input
              id="client-tags"
              value={tagInput}
              placeholder={t("tagsPlaceholder")}
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addTag();
                }
              }}
            />
            <Button type="button" variant="outline" onClick={addTag}>
              {common("save")}
            </Button>
          </div>
        ) : null}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Switch
          checked={draft.consentMarketing}
          onCheckedChange={(value) => patch({ consentMarketing: value })}
          disabled={!canEdit}
        />
        {t("consent")}
      </label>

      {canEdit ? (
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {common("save")}
        </Button>
      ) : null}
    </form>
  );
}
