"use client";

import { Info, Loader2, Send, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/i18n/routing";
import { askAssistant } from "@/lib/actions/assistant";
import type { AssistantMessage } from "@/lib/ai";
import { cn } from "@/lib/utils";

export function AssistantPanel({
  businessId,
  locale,
  configured,
}: {
  businessId: string;
  locale: Locale;
  configured: boolean;
}) {
  const t = useTranslations("admin.assistant");
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const question = input.trim();
    if (!question || !configured) return;

    const next: AssistantMessage[] = [...messages, { role: "user", content: question }];
    setMessages(next);
    setInput("");

    startTransition(async () => {
      const result = await askAssistant({ businessId, locale, messages: next });
      setMessages([
        ...next,
        {
          role: "assistant",
          content: result.ok
            ? result.text
            : result.code === "unavailable"
              ? t("unavailableBody")
              : t("disclaimer"),
        },
      ]);
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
      });
    });
  }

  if (!configured) {
    return (
      <div className="border-border/70 space-y-2 rounded-xl border border-dashed p-6">
        <p className="flex items-center gap-2 font-medium">
          <Sparkles className="text-primary size-4" aria-hidden />
          {t("unavailable")}
        </p>
        <p className="text-muted-foreground text-sm">{t("unavailableBody")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        ref={listRef}
        className="glowa-card max-h-[26rem] min-h-40 space-y-3 overflow-y-auto p-4"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={cn(
                "max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-line",
                message.role === "user"
                  ? "bg-primary text-primary-foreground ml-auto"
                  : "bg-secondary text-secondary-foreground",
              )}
            >
              {message.content}
            </div>
          ))
        )}
        {isPending ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t("thinking")}
          </p>
        ) : null}
      </div>

      <form onSubmit={onSubmit} className="flex gap-2">
        <Input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={t("placeholder")}
          aria-label={t("placeholder")}
          disabled={isPending}
        />
        <Button type="submit" disabled={isPending || !input.trim()}>
          <Send className="size-4" aria-hidden />
          <span className="sr-only sm:not-sr-only">{t("send")}</span>
        </Button>
      </form>

      <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {t("disclaimer")} {t("dataNote")}
      </p>
    </div>
  );
}
