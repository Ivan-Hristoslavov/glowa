"use client";

import { Loader2, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRouter } from "@/i18n/navigation";
import { sendCampaign } from "@/lib/actions/crm";

/**
 * Sending is irreversible in the way that matters: an email that has left
 * cannot be recalled. So it asks first, and says how many people it is about
 * to write to rather than just "are you sure?".
 */
export function CampaignSendButton({
  businessId,
  campaignId,
  recipients,
  disabled,
}: {
  businessId: string;
  campaignId: string;
  recipients: number | null;
  disabled?: boolean;
}) {
  const t = useTranslations("admin.marketing");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await sendCampaign(businessId, campaignId);

      if (!result.ok) {
        toast.error(t(`sendError.${result.code}`));
        return;
      }

      toast.success(
        result.queued === 0
          ? t("sendEmpty")
          : t("sendQueued", { count: result.queued }),
      );
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <Send className="size-4" />
        {t("send")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("sendConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {recipients === null
                ? t("sendConfirmBody")
                : t("sendConfirmCount", { count: recipients })}
            </DialogDescription>
          </DialogHeader>

          <p className="text-muted-foreground text-sm">{t("sendConsentNote")}</p>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("sendCancel")}
            </Button>
            <Button onClick={confirm} disabled={pending}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Send className="size-4" />
              )}
              {t("sendNow")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
