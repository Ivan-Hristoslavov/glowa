"use client";

import { Loader2, Plus, Send, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Section } from "@/components/common/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createWebhookAction,
  deleteWebhookAction,
  flushWebhooksAction,
  setWebhookActiveAction,
  testWebhookAction,
} from "@/lib/actions/integrations";

import { CopyBlock, useDateTime } from "./shared";

export type WebhookRow = {
  id: string;
  url: string;
  description: string | null;
  events: string[];
  isActive: boolean;
  consecutiveFailures: number;
  disabledReason: string | null;
  lastSuccessAt: string | null;
};

export type DeliveryRow = {
  id: string;
  endpointId: string;
  event: string;
  status: string;
  attempts: number;
  lastStatusCode: number | null;
  lastError: string | null;
  createdAt: string;
};

const EVENTS = ["created", "rescheduled", "cancelled", "status_changed"] as const;
const ERROR_CODES = ["timeout", "network", "too_large", "unsafe_url", "endpoint_inactive"] as const;

export function WebhooksPanel({
  businessId,
  endpoints,
  deliveries,
  timezone,
  locale,
}: {
  businessId: string;
  endpoints: WebhookRow[];
  deliveries: DeliveryRow[];
  timezone: string;
  locale: string;
}) {
  const t = useTranslations("admin.integrations");
  const w = useTranslations("admin.integrations.webhooks");
  const [pending, start] = useTransition();
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [secret, setSecret] = useState<string | null>(null);
  const when = useDateTime(timezone, locale);

  function errorText(code: string | null) {
    if (!code) return "";
    if ((ERROR_CODES as readonly string[]).includes(code)) return w(`errorCodes.${code}` as never);
    if (code.startsWith("http_")) return w("errorCodes.http", { status: code.slice(5) });
    return code;
  }

  function create(event: React.FormEvent) {
    event.preventDefault();
    start(async () => {
      const result = await createWebhookAction({
        businessId,
        url,
        description: description || undefined,
        events: events as ("booking.created" | "booking.rescheduled" | "booking.cancelled" | "booking.status_changed")[],
      });
      if (!result.ok) {
        toast.error(t(`errors.${result.code}` as never));
        return;
      }
      setSecret(result.secret);
      setUrl("");
      setDescription("");
      setEvents([]);
    });
  }

  function test(id: string) {
    start(async () => {
      const result = await testWebhookAction({ businessId, id });
      if (!result.ok) {
        toast.error(t(`errors.${result.code}` as never));
        return;
      }
      if (result.error) toast.error(w("testFail", { error: errorText(result.error) }));
      else toast.success(w("testOk", { status: result.status ?? 200 }));
    });
  }

  function toggle(id: string, active: boolean) {
    start(async () => {
      const result = await setWebhookActiveAction({ businessId, id, active });
      if (!result.ok) toast.error(t(`errors.${result.code}` as never));
    });
  }

  function remove(id: string) {
    start(async () => {
      const result = await deleteWebhookAction({ businessId, id });
      if (!result.ok) toast.error(t(`errors.${result.code}` as never));
    });
  }

  function flush() {
    start(async () => {
      const result = await flushWebhooksAction({ businessId });
      if (!result.ok) toast.error(t(`errors.${result.code}` as never));
    });
  }

  const urlById = new Map(endpoints.map((endpoint) => [endpoint.id, endpoint.url]));

  return (
    <Section
      id="webhooks"
      title={w("title")}
      description={w("description")}
      action={
        <Button type="button" variant="outline" size="sm" onClick={flush} disabled={pending}>
          {w("flush")}
        </Button>
      }
    >
      <form onSubmit={create} className="bg-card space-y-4 rounded-xl border p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="webhook-url">{w("url")}</Label>
            <Input
              id="webhook-url"
              type="url"
              inputMode="url"
              required
              maxLength={500}
              value={url}
              placeholder="https://example.com/lavena-hook"
              onChange={(event) => setUrl(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="webhook-note">{w("note")}</Label>
            <Input
              id="webhook-note"
              maxLength={120}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{w("events")}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {EVENTS.map((name) => {
              const full = `booking.${name}`;
              return (
                <label key={name} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={events.includes(full)}
                    onCheckedChange={(value) =>
                      setEvents((current) =>
                        value === true ? [...new Set([...current, full])] : current.filter((e) => e !== full),
                      )
                    }
                  />
                  <span>{w(`eventNames.${name}`)}</span>
                </label>
              );
            })}
          </div>
          <p className="text-muted-foreground text-xs">{w("eventsHint")}</p>
        </fieldset>
        <Button type="submit" disabled={pending || !url.trim()} className="gap-2">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
          {w("add")}
        </Button>
      </form>

      {secret ? (
        <div role="status" className="border-primary/40 bg-primary/5 space-y-2 rounded-xl border p-4">
          <p className="text-sm font-medium">{w("secretTitle")}</p>
          <p className="text-muted-foreground text-sm">{w("secretBody")}</p>
          <CopyBlock value={secret} label={w("secretLabel")} multiline />
          <Button type="button" variant="outline" size="sm" onClick={() => setSecret(null)}>
            {t("keys.done")}
          </Button>
        </div>
      ) : null}

      {endpoints.length === 0 ? (
        <p className="text-muted-foreground text-sm">{w("empty")}</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {endpoints.map((endpoint) => (
            <li key={endpoint.id} className="space-y-2 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="font-mono text-sm break-all">{endpoint.url}</p>
                  {endpoint.description ? (
                    <p className="text-muted-foreground text-xs">{endpoint.description}</p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={endpoint.isActive ? "secondary" : "destructive"}>
                      {endpoint.isActive ? w("active") : endpoint.disabledReason ? w("switchedOff") : w("paused")}
                    </Badge>
                    {(endpoint.events.length ? endpoint.events : ["all"]).map((name) => (
                      <Badge key={name} variant="outline">
                        {name === "all" ? w("allEvents") : w(`eventNames.${name.replace("booking.", "")}` as never)}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {endpoint.lastSuccessAt
                      ? w("lastSuccess", { when: when(endpoint.lastSuccessAt) ?? "" })
                      : w("noSuccessYet")}
                    {endpoint.consecutiveFailures > 0
                      ? ` · ${w("failures", { count: endpoint.consecutiveFailures })}`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => test(endpoint.id)} className="gap-1.5">
                    <Send className="size-3.5" aria-hidden />
                    {w("test")}
                  </Button>
                  <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => toggle(endpoint.id, !endpoint.isActive)}>
                    {endpoint.isActive ? w("pause") : w("resume")}
                  </Button>
                  <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => remove(endpoint.id)} className="text-destructive gap-1.5">
                    <Trash2 className="size-3.5" aria-hidden />
                    <span className="sr-only">{w("delete")}</span>
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {deliveries.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">{w("recent")}</h3>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground bg-muted/40 text-xs">
                <tr>
                  <th className="px-3 py-2 font-medium">{w("colWhen")}</th>
                  <th className="px-3 py-2 font-medium">{w("colEvent")}</th>
                  <th className="px-3 py-2 font-medium">{w("colTo")}</th>
                  <th className="px-3 py-2 font-medium">{w("colResult")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {deliveries.map((delivery) => (
                  <tr key={delivery.id}>
                    <td className="px-3 py-2 whitespace-nowrap">{when(delivery.createdAt)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{delivery.event}</td>
                    <td className="max-w-[14rem] truncate px-3 py-2 font-mono text-xs">
                      {urlById.get(delivery.endpointId) ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={delivery.status === "failed" ? "destructive" : "secondary"}>
                        {w(`deliveryStatus.${delivery.status}` as never)}
                      </Badge>
                      {delivery.lastError ? (
                        <span className="text-muted-foreground ml-2 text-xs">{errorText(delivery.lastError)}</span>
                      ) : null}
                      {delivery.attempts > 1 ? (
                        <span className="text-muted-foreground ml-2 text-xs">
                          {w("attempts", { count: delivery.attempts })}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </Section>
  );
}
