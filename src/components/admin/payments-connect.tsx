"use client";

import { ArrowUpRight, Loader2, RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { refreshPaymentsAccount, startPaymentsOnboarding } from "@/lib/actions/payments";

export function ConnectPaymentsButton({
  businessId,
  label,
}: {
  businessId: string;
  label: string;
}) {
  const t = useTranslations("admin.payments");
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  function connect() {
    startTransition(async () => {
      const result = await startPaymentsOnboarding({ businessId, locale: locale as Locale });
      if (!result.ok) {
        toast.error(t("connectFailed"));
        return;
      }
      // Stripe's own onboarding, on Stripe's domain: identity documents and
      // bank details go to Stripe and never pass through GLOWA.
      window.location.assign(result.url);
    });
  }

  return (
    <Button size="lg" onClick={connect} disabled={isPending}>
      {isPending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <ArrowUpRight className="size-4" aria-hidden />
      )}
      {label}
    </Button>
  );
}

export function RefreshPaymentsButton({ businessId }: { businessId: string }) {
  const t = useTranslations("admin.payments");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      onClick={() =>
        startTransition(async () => {
          const result = await refreshPaymentsAccount({ businessId });
          if (!result.ok) toast.error(t("refreshFailed"));
          router.refresh();
        })
      }
      disabled={isPending}
    >
      <RefreshCw className={isPending ? "size-4 animate-spin" : "size-4"} aria-hidden />
      {t("refresh")}
    </Button>
  );
}
