"use client";

import { EyeOff, Loader2, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { respondToReview, setReviewStatus } from "@/lib/actions/crm";

export function ReviewResponse({
  businessId,
  reviewId,
  initialResponse,
  status,
}: {
  businessId: string;
  reviewId: string;
  initialResponse: string;
  status: "published" | "pending" | "hidden";
}) {
  const t = useTranslations("admin.reviewsAdmin");
  const [response, setResponse] = useState(initialResponse);
  const [open, setOpen] = useState(initialResponse.length > 0);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    startTransition(async () => {
      const result = await respondToReview({ businessId, reviewId, response });
      if (!result.ok) {
        toast.error(t("respond"));
        return;
      }
      toast.success(t("responded"));
      router.refresh();
    });
  }

  function toggleVisibility() {
    startTransition(async () => {
      const result = await setReviewStatus({
        businessId,
        reviewId,
        status: status === "hidden" ? "published" : "hidden",
      });
      if (!result.ok) {
        toast.error(t("respond"));
        return;
      }
      toast.success(t("statusChanged"));
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {open ? (
        <>
          <Textarea
            rows={3}
            maxLength={2000}
            value={response}
            placeholder={t("responsePlaceholder")}
            onChange={(event) => setResponse(event.target.value)}
            aria-label={t("response")}
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={save} disabled={isPending}>
              {isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Send className="size-4" aria-hidden />
              )}
              {t("saveResponse")}
            </Button>
            <Button size="sm" variant="ghost" onClick={toggleVisibility} disabled={isPending}>
              <EyeOff className="size-4" aria-hidden />
              {status === "hidden" ? t("publish") : t("hide")}
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            {t("respond")}
          </Button>
          <Button size="sm" variant="ghost" onClick={toggleVisibility} disabled={isPending}>
            <EyeOff className="size-4" aria-hidden />
            {status === "hidden" ? t("publish") : t("hide")}
          </Button>
        </div>
      )}
    </div>
  );
}
