"use client";

import { ExternalLink, Loader2, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { submitReview } from "@/lib/actions/reviews";
import { cn } from "@/lib/utils";

type ReviewFormProps = {
  appointmentId: string;
  googleReviewUrl: string | null;
};

export function ReviewForm({ appointmentId, googleReviewUrl }: ReviewFormProps) {
  const t = useTranslations("review");
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (rating < 1) return;

    startTransition(async () => {
      const result = await submitReview({ appointmentId, rating, comment });
      if (!result.ok) {
        toast.error(
          result.code === "alreadyReviewed"
            ? t("alreadyReviewed")
            : result.code === "onlyAfterVisit"
              ? t("onlyAfterVisit")
              : t("errors.generic"),
        );
        return;
      }
      setDone(true);
      toast.success(t("thanks"));
      router.refresh();
    });
  }

  if (done) {
    return (
      <div className="space-y-3">
        <p className="font-heading text-lg">{t("thanks")}</p>
        {googleReviewUrl ? (
          <div className="border-border/70 rounded-lg border border-dashed p-4">
            <p className="text-sm font-medium">{t("googlePrompt")}</p>
            <Button asChild variant="outline" size="sm" className="mt-2">
              <a href={googleReviewUrl} target="_blank" rel="noopener noreferrer">
                Google
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </Button>
            <p className="text-muted-foreground mt-2 text-xs">{t("googleNote")}</p>
          </div>
        ) : null}
      </div>
    );
  }

  const shown = hovered || rating;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <h3 className="font-heading text-lg">{t("title")}</h3>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t("rating")}</legend>
        <div className="flex gap-1" onMouseLeave={() => setHovered(0)}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              onMouseEnter={() => setHovered(value)}
              onFocus={() => setHovered(value)}
              onBlur={() => setHovered(0)}
              aria-label={t("stars", { count: value })}
              aria-pressed={rating === value}
              className="glowa-focus rounded-md p-1"
            >
              <Star
                className={cn(
                  "size-7 transition-colors",
                  value <= shown
                    ? "fill-primary text-primary"
                    : "text-muted-foreground/40",
                )}
              />
            </button>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="review-comment">{t("comment")}</Label>
        <Textarea
          id="review-comment"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder={t("commentPlaceholder")}
          rows={4}
          maxLength={2000}
        />
      </div>

      <Button type="submit" disabled={rating < 1 || isPending}>
        {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {isPending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
