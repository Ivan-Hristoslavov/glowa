"use client";

import { useTranslations } from "next-intl";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { setNotificationPreference } from "@/lib/actions/settings";
import type { Database } from "@/types/database";

type EventType = Database["public"]["Enums"]["notification_event"];

const EVENTS: EventType[] = [
  "booking_confirmation",
  "reminder",
  "cancellation",
  "reschedule",
  "review_request",
  "waitlist_offer",
  "rebook_nudge",
  "marketing",
];

/**
 * Email only for now: SMS, WhatsApp and Viber have no provider behind them
 * yet, and offering a switch that does nothing is worse than saying "soon".
 */
export function NotificationSettings({
  initial,
}: {
  initial: Record<string, boolean>;
}) {
  const t = useTranslations("settings");
  const auth = useTranslations("auth");
  const [, startTransition] = useTransition();
  const [enabled, setEnabled] = useOptimistic(initial);

  function toggle(eventType: EventType, value: boolean) {
    startTransition(async () => {
      setEnabled({ ...enabled, [eventType]: value });
      const result = await setNotificationPreference({
        channel: "email",
        eventType,
        enabled: value,
      });
      if (!result.ok) toast.error(auth("errors.generic"));
    });
  }

  return (
    <div className="space-y-1">
      <div className="text-muted-foreground mb-3 flex items-center gap-2 text-sm">
        <Badge variant="secondary">{t("channels.email")}</Badge>
        <span className="text-xs">
          {t("channels.sms")} · {t("channels.whatsapp")} · {t("channels.viber")} —{" "}
          {t("channelSoon")}
        </span>
      </div>

      <ul className="divide-border/70 divide-y">
        {EVENTS.map((eventType) => (
          <li key={eventType} className="flex items-center justify-between gap-4 py-3">
            <Label htmlFor={`notify-${eventType}`} className="font-normal">
              {t(`events.${eventType}`)}
            </Label>
            <Switch
              id={`notify-${eventType}`}
              checked={enabled[eventType] ?? eventType !== "marketing"}
              onCheckedChange={(value) => toggle(eventType, value)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
