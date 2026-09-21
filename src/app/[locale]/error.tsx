"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    // Surfaced to the server logs; the digest is what ties it to a request.
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <span className="bg-secondary text-primary flex size-12 items-center justify-center rounded-full">
        <AlertTriangle className="size-5" aria-hidden />
      </span>
      <h1 className="font-heading text-2xl">{t("genericTitle")}</h1>
      <p className="text-muted-foreground">{t("genericBody")}</p>
      <Button onClick={reset} className="mt-2">
        {t("tryAgain")}
      </Button>
    </main>
  );
}
