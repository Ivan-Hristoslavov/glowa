"use client";

import { CreditCard, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { resumeDepositCheckout } from "@/lib/actions/booking";

export function PayDepositButton({
  appointmentId,
  label,
}: {
  appointmentId: string;
  label: string;
}) {
  const t = useTranslations("bookings");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function pay() {
    startTransition(async () => {
      const result = await resumeDepositCheckout({ appointmentId, locale });
      if (!result.ok) {
        toast.error(
          result.code === "expired" ? t("depositExpired") : t("errors.generic"),
        );
        router.refresh();
        return;
      }
      window.location.assign(result.url);
    });
  }

  return (
    <Button onClick={pay} disabled={isPending}>
      {isPending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <CreditCard className="size-4" aria-hidden />
      )}
      {label}
    </Button>
  );
}
