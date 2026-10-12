"use client";

import { KeyRound, Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Section } from "@/components/common/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createApiKeyAction, revokeApiKeyAction } from "@/lib/actions/integrations";

import { CopyBlock, useDateTime } from "./shared";

export type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

const SCOPES = ["read", "bookings", "catalog"] as const;

export function ApiKeysPanel({
  businessId,
  keys,
  siteUrl,
  timezone,
  locale,
}: {
  businessId: string;
  keys: ApiKeyRow[];
  siteUrl: string;
  timezone: string;
  locale: string;
}) {
  const t = useTranslations("admin.integrations");
  const k = useTranslations("admin.integrations.keys");
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["read", "bookings"]);
  const [created, setCreated] = useState<string | null>(null);
  const when = useDateTime(timezone, locale);

  function toggle(scope: string, on: boolean) {
    setScopes((current) => (on ? [...new Set([...current, scope])] : current.filter((s) => s !== scope)));
  }

  function create(event: React.FormEvent) {
    event.preventDefault();
    start(async () => {
      const result = await createApiKeyAction({
        businessId,
        name,
        scopes: scopes as ("read" | "bookings" | "catalog")[],
      });
      if (!result.ok) {
        toast.error(t(`errors.${result.code}` as never));
        return;
      }
      setCreated(result.key);
      setName("");
    });
  }

  function revoke(id: string) {
    start(async () => {
      const result = await revokeApiKeyAction({ businessId, id });
      if (!result.ok) toast.error(t(`errors.${result.code}` as never));
      else toast.success(k("revokedToast"));
    });
  }

  const active = keys.filter((key) => !key.revokedAt);
  const revoked = keys.filter((key) => key.revokedAt);

  const sample = [
    `curl ${siteUrl}/api/v1/services \\`,
    `  -H "Authorization: Bearer ${created ?? "lv_live_…"}"`,
  ].join("\n");

  return (
    <Section id="api" title={k("title")} description={k("description")}>
      <form onSubmit={create} className="bg-card space-y-4 rounded-xl border p-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="api-key-name">{k("name")}</Label>
            <Input
              id="api-key-name"
              value={name}
              maxLength={80}
              required
              placeholder={k("namePlaceholder")}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={pending || !name.trim() || scopes.length === 0} className="gap-2">
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <KeyRound className="size-4" aria-hidden />}
            {k("create")}
          </Button>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{k("scopesTitle")}</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {SCOPES.map((scope) => (
              <label key={scope} className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={scopes.includes(scope)}
                  onCheckedChange={(value) => toggle(scope, value === true)}
                  className="mt-0.5"
                />
                <span>
                  <span className="block font-medium">{k(`scopes.${scope}.label`)}</span>
                  <span className="text-muted-foreground block text-xs">{k(`scopes.${scope}.hint`)}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </form>

      {created ? (
        <div role="status" className="border-primary/40 bg-primary/5 space-y-2 rounded-xl border p-4">
          <p className="text-sm font-medium">{k("createdTitle")}</p>
          <p className="text-muted-foreground text-sm">{k("createdBody")}</p>
          <CopyBlock value={created} label={k("keyLabel")} multiline />
          <CopyBlock value={sample} label="curl" multiline />
          <Button type="button" variant="outline" size="sm" onClick={() => setCreated(null)}>
            {k("done")}
          </Button>
        </div>
      ) : null}

      {active.length === 0 ? (
        <p className="text-muted-foreground text-sm">{k("empty")}</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {active.map((key) => (
            <li key={key.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0 space-y-1">
                <p className="truncate text-sm font-medium">{key.name}</p>
                <p className="text-muted-foreground font-mono text-xs">{key.keyPrefix}…</p>
                <div className="flex flex-wrap gap-1">
                  {key.scopes.map((scope) => (
                    <Badge key={scope} variant="secondary">
                      {k(`scopes.${scope as (typeof SCOPES)[number]}.label`)}
                    </Badge>
                  ))}
                </div>
                <p className="text-muted-foreground text-xs">
                  {key.lastUsedAt ? k("lastUsed", { when: when(key.lastUsedAt) ?? "" }) : k("neverUsed")}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => revoke(key.id)}
                className="text-destructive gap-1.5"
              >
                <Trash2 className="size-3.5" aria-hidden />
                {k("revoke")}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {revoked.length > 0 ? (
        <p className="text-muted-foreground text-xs">{k("revokedCount", { count: revoked.length })}</p>
      ) : null}
    </Section>
  );
}
