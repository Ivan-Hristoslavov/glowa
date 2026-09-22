"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";
import { updateBusinessSettings } from "@/lib/actions/business";

type GoogleReviewLinkProps = {
  businessId: string;
  initialUrl: string;
  /** The settings action writes the whole record, so it needs the rest as-is. */
  rest: Omit<
    Parameters<typeof updateBusinessSettings>[0],
    "businessId" | "googleReviewUrl"
  >;
};

export function GoogleReviewLink({ businessId, initialUrl, rest }: GoogleReviewLinkProps) {
  const t = useTranslations("admin.reviewsAdmin");
  const common = useTranslations("common");
  const [url, setUrl] = useState(initialUrl);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateBusinessSettings({
        ...rest,
        businessId,
        googleReviewUrl: url,
      });
      if (!result.ok) {
        toast.error(common("retry"));
        return;
      }
      toast.success(t("googleSaved"));
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <p className="text-muted-foreground text-sm">{t("googleBody")}</p>
      <div className="space-y-2">
        <Label htmlFor="google-url">{t("googleLabel")}</Label>
        <div className="flex gap-2">
          <Input
            id="google-url"
            type="url"
            inputMode="url"
            placeholder="https://g.page/r/…"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {common("save")}
          </Button>
        </div>
      </div>
    </form>
  );
}
