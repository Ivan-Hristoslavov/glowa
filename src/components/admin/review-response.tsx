"use client";

import { Eye, EyeOff, Loader2, MessageSquareReply, Pencil, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { respondToReview, setReviewStatus } from "@/lib/actions/crm";

/**
 * The salon's side of a review. A published reply reads as a reply - quoted
 * under the review, the way the client sees it - and only turns back into a
 * text box when someone chooses to edit it.
 */
export function ReviewResponse({
  businessId,
  reviewId,
  initialResponse,
  respondedLabel,
  status,
}: {
  businessId: string;
  reviewId: string;
  initialResponse: string;
  /** "Replied 22 Sep" - formatted on the server, in the salon's language. */
  respondedLabel: string | null;
  status: "published" | "pending" | "hidden";
}) {
  const t = useTranslations("admin.reviewsAdmin");
  const common = useTranslations("common");
  const [response, setResponse] = useState(initialResponse);
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    startTransition(async () => {
      const result = await respondToReview({ businessId, reviewId, response });
      if (!result.ok) {
        toast.error(t("error"));
        return;
      }
      toast.success(t("responded"));
      setEditing(false);
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
        toast.error(t("error"));
        return;
      }
      toast.success(t("statusChanged"));
      router.refresh();
    });
  }

  const visibility = (
    <Button size="sm" variant="ghost" onClick={toggleVisibility} disabled={isPending}>
      {status === "hidden" ? (
        <Eye className="size-4" aria-hidden />
      ) : (
        <EyeOff className="size-4" aria-hidden />
      )}
      {status === "hidden" ? t("publish") : t("hide")}
    </Button>
  );

  if (editing) {
    return (
      <div className="space-y-2">
        <Textarea
          rows={3}
          maxLength={2000}
          autoFocus
          value={response}
          placeholder={t("responsePlaceholder")}
          onChange={(event) => setResponse(event.target.value)}
          aria-label={t("response")}
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={save} disabled={isPending || !response.trim()}>
            {isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Send className="size-4" aria-hidden />
            )}
            {t("saveResponse")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={() => {
              setResponse(initialResponse);
              setEditing(false);
            }}
          >
            {common("cancel")}
          </Button>
        </div>
      </div>
    );
  }

  if (initialResponse) {
    return (
      <div className="space-y-2">
        <div className="bg-muted/60 border-primary/50 rounded-r-xl border-l-2 px-4 py-3">
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
            <MessageSquareReply className="size-3.5" aria-hidden />
            {t("yourResponse")}
            {respondedLabel ? <span className="font-normal">· {respondedLabel}</span> : null}
          </p>
          <p className="mt-1 text-sm leading-relaxed whitespace-pre-line">{initialResponse}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            <Pencil className="size-4" aria-hidden />
            {common("edit")}
          </Button>
          {visibility}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
        <MessageSquareReply className="size-4" aria-hidden />
        {t("respond")}
      </Button>
      {visibility}
    </div>
  );
}
