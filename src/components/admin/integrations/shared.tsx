"use client";

import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** A read-only block of text with a copy button; used for keys, secrets and snippets. */
export function CopyBlock({
  value,
  label,
  multiline = false,
  className,
}: {
  value: string;
  label: string;
  multiline?: boolean;
  className?: string;
}) {
  const t = useTranslations("admin.integrations");
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the text stays selectable in the box.
    }
  }

  return (
    <div className={cn("bg-muted/60 rounded-lg border", className)}>
      <div className="flex items-center justify-between gap-2 border-b px-3 py-1.5">
        <span className="text-muted-foreground text-xs font-medium">{label}</span>
        <Button type="button" variant="ghost" size="sm" onClick={copy} className="h-7 gap-1.5 px-2">
          {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
          <span aria-live="polite">{copied ? t("copied") : t("copy")}</span>
        </Button>
      </div>
      <pre
        className={cn(
          "overflow-x-auto px-3 py-2.5 font-mono text-[0.78rem] leading-relaxed",
          multiline ? "whitespace-pre-wrap break-all" : "whitespace-pre",
        )}
        tabIndex={0}
      >
        <code>{value}</code>
      </pre>
    </div>
  );
}

/** "12 Oct, 14:05" on the salon's own clock, so server and browser agree. */
export function useDateTime(timezone: string, locale: string) {
  return (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat(locale, {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: timezone,
        }).format(new Date(iso))
      : null;
}
