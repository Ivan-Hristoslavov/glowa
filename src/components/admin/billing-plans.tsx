"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { PricingPlans } from "@/components/pricing/pricing-plans";
import { Button } from "@/components/ui/button";
import { openBillingPortal, startCheckout, type BillingResult } from "@/lib/actions/billing";
import type { PlanId } from "@/lib/pricing";

type BillingPlansProps = {
  businessId: string;
  canManage: boolean;
  configured: boolean;
  current: PlanId | null;
  subscribed: boolean;
  recommended: PlanId;
};

/**
 * The plans with a button that pays. Stripe hosts the payment page, so no
 * card number ever touches Glowa; the buttons only ask the server for the
 * Stripe URL and go there.
 */
export function BillingPlans({
  businessId,
  canManage,
  configured,
  current,
  subscribed,
  recommended,
}: BillingPlansProps) {
  const t = useTranslations("admin.billing");
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function go(key: string, request: () => Promise<BillingResult>) {
    setBusy(key);
    startTransition(async () => {
      const result = await request();
      if (result.ok) {
        window.location.assign(result.url);
        return;
      }
      setBusy(null);
      toast.error(t(`errors.${result.code}`));
    });
  }

  const disabled = !canManage || !configured;

  return (
    <PricingPlans
      current={current}
      recommended={current ? null : recommended}
      action={(plan, interval) => {
        const key = `${plan}-${interval}`;
        const isCurrent = subscribed && plan === current;
        return (
          <Button
            size="lg"
            variant={isCurrent ? "outline" : plan === recommended ? "default" : "outline"}
            className="w-full rounded-full"
            disabled={disabled || busy !== null}
            onClick={() =>
              go(key, () =>
                subscribed
                  ? openBillingPortal({ businessId })
                  : startCheckout({ businessId, plan, interval }),
              )
            }
          >
            {busy === key ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {isCurrent ? t("manage") : subscribed ? t("switch") : t("choose")}
          </Button>
        );
      }}
    />
  );
}

/** "Manage payment": card, invoices, cancellation - Stripe's portal. */
export function ManageBillingButton({ businessId }: { businessId: string }) {
  const t = useTranslations("admin.billing");
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await openBillingPortal({ businessId });
          if (result.ok) window.location.assign(result.url);
          else toast.error(t(`errors.${result.code}`));
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {t("manage")}
    </Button>
  );
}
