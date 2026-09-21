"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { updatePreferences } from "@/lib/actions/settings";
import type { Database } from "@/types/database";

type Channel = Database["public"]["Enums"]["notification_channel"];

/** Only channels that are actually wired up are selectable. */
const AVAILABLE_CHANNELS: Channel[] = ["email"];
const REMINDER_OPTIONS = ["60", "180", "720", "1440", "2880"] as const;

type PreferencesFormProps = {
  initial: {
    preferredChannel: Channel;
    reminderLeadMinutes: number;
    notes: string;
    accessibilityNotes: string;
  };
};

export function PreferencesForm({ initial }: PreferencesFormProps) {
  const t = useTranslations("settings");
  const common = useTranslations("common");
  const auth = useTranslations("auth");
  const router = useRouter();

  const [channel, setChannel] = useState<Channel>(initial.preferredChannel);
  const [lead, setLead] = useState(String(initial.reminderLeadMinutes));
  const [notes, setNotes] = useState(initial.notes);
  const [accessibilityNotes, setAccessibilityNotes] = useState(
    initial.accessibilityNotes,
  );
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updatePreferences({
        preferredChannel: channel,
        reminderLeadMinutes: Number(lead),
        notes,
        accessibilityNotes,
      });
      if (!result.ok) {
        toast.error(auth("errors.generic"));
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
          <Label htmlFor="preferred-channel">{t("preferredChannel")}</Label>
          <Select value={channel} onValueChange={(value) => setChannel(value as Channel)}>
            <SelectTrigger id="preferred-channel">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AVAILABLE_CHANNELS.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`channels.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="reminder-lead">{t("reminderLead")}</Label>
          <Select value={lead} onValueChange={setLead}>
            <SelectTrigger id="reminder-lead">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REMINDER_OPTIONS.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`reminderOptions.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="pref-notes">{t("notes")}</Label>
        <Textarea
          id="pref-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder={t("notesPlaceholder")}
          rows={3}
          maxLength={2000}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="pref-accessibility">{t("accessibilityNotes")}</Label>
        <Textarea
          id="pref-accessibility"
          value={accessibilityNotes}
          onChange={(event) => setAccessibilityNotes(event.target.value)}
          placeholder={t("accessibilityPlaceholder")}
          rows={2}
          maxLength={2000}
        />
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {isPending ? common("saving") : common("save")}
      </Button>
    </form>
  );
}
