"use client";

import { CalendarSync, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Section } from "@/components/common/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  createCalendarFeedAction,
  deleteCalendarFeedAction,
  syncCalendarFeedAction,
} from "@/lib/actions/integrations";

import { useDateTime } from "./shared";

export type FeedRow = {
  id: string;
  name: string;
  staffName: string;
  lastSyncedAt: string | null;
  lastError: string | null;
  lastEventCount: number | null;
};

const ERROR_CODES = ["timeout", "network", "too_large", "unsafe_url", "not_calendar"] as const;

export function FeedsPanel({
  businessId,
  feeds,
  staff,
  timezone,
  locale,
}: {
  businessId: string;
  feeds: FeedRow[];
  staff: { id: string; name: string }[];
  timezone: string;
  locale: string;
}) {
  const t = useTranslations("admin.integrations");
  const f = useTranslations("admin.integrations.feeds");
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [staffId, setStaffId] = useState(staff[0]?.id ?? "");
  const when = useDateTime(timezone, locale);

  function errorText(code: string | null) {
    if (!code) return "";
    if ((ERROR_CODES as readonly string[]).includes(code)) return f(`errorCodes.${code}` as never);
    if (code.startsWith("http_")) return f("errorCodes.http", { status: code.slice(5) });
    return code;
  }

  function report(error: string | null, count: number) {
    if (error) toast.error(f("syncFailed", { error: errorText(error) }));
    else toast.success(f("syncOk", { count }));
  }

  function create(event: React.FormEvent) {
    event.preventDefault();
    start(async () => {
      const result = await createCalendarFeedAction({ businessId, staffProfileId: staffId, name, url });
      if (!result.ok) {
        toast.error(t(`errors.${result.code}` as never));
        return;
      }
      setName("");
      setUrl("");
      report(result.error, result.count);
    });
  }

  function sync(id: string) {
    start(async () => {
      const result = await syncCalendarFeedAction({ businessId, id });
      if (!result.ok) {
        toast.error(t(`errors.${result.code}` as never));
        return;
      }
      report(result.error, result.count);
    });
  }

  function remove(id: string) {
    start(async () => {
      const result = await deleteCalendarFeedAction({ businessId, id });
      if (!result.ok) toast.error(t(`errors.${result.code}` as never));
    });
  }

  return (
    <Section id="calendar" title={f("title")} description={f("description")}>
      {staff.length === 0 ? (
        <p className="text-muted-foreground text-sm">{f("noStaff")}</p>
      ) : (
        <form onSubmit={create} className="bg-card space-y-4 rounded-xl border p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="feed-staff">{f("staff")}</Label>
              <Select value={staffId} onValueChange={setStaffId}>
                <SelectTrigger id="feed-staff" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="feed-name">{f("name")}</Label>
              <Input
                id="feed-name"
                required
                maxLength={80}
                value={name}
                placeholder={f("namePlaceholder")}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="feed-url">{f("url")}</Label>
            <Input
              id="feed-url"
              required
              inputMode="url"
              maxLength={1000}
              value={url}
              placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
              onChange={(event) => setUrl(event.target.value)}
            />
            <p className="text-muted-foreground text-xs">{f("urlHelp")}</p>
          </div>
          <Button type="submit" disabled={pending || !name.trim() || !url.trim() || !staffId} className="gap-2">
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CalendarSync className="size-4" aria-hidden />}
            {f("add")}
          </Button>
        </form>
      )}

      {feeds.length === 0 ? (
        <p className="text-muted-foreground text-sm">{f("empty")}</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {feeds.map((feed) => (
            <li key={feed.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium">
                  {feed.name} <span className="text-muted-foreground font-normal">· {feed.staffName}</span>
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {feed.lastError ? (
                    <Badge variant="destructive">{errorText(feed.lastError)}</Badge>
                  ) : feed.lastSyncedAt ? (
                    <Badge variant="secondary">{f("blocks", { count: feed.lastEventCount ?? 0 })}</Badge>
                  ) : null}
                  <span className="text-muted-foreground text-xs">
                    {feed.lastSyncedAt ? f("lastSynced", { when: when(feed.lastSyncedAt) ?? "" }) : f("neverSynced")}
                  </span>
                </div>
                {feed.lastError ? <p className="text-muted-foreground text-xs">{f("keptOldBlocks")}</p> : null}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => sync(feed.id)} className="gap-1.5">
                  <RefreshCw className="size-3.5" aria-hidden />
                  {f("syncNow")}
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => remove(feed.id)} className="text-destructive gap-1.5">
                  <Trash2 className="size-3.5" aria-hidden />
                  <span className="sr-only">{f("delete")}</span>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-muted-foreground text-xs">{f("note")}</p>
    </Section>
  );
}
