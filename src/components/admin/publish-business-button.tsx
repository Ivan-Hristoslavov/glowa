"use client";

import { Loader2, Rocket } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { publishBusiness } from "@/lib/actions/business";

export function PublishBusinessButton({ businessId }: { businessId: string }) {
  const t = useTranslations("admin.dashboard");
  const services = useTranslations("admin.services");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function onClick() {
    startTransition(async () => {
      const result = await publishBusiness(businessId);
      if (!result.ok) {
        // The only expected refusal: a business with nothing bookable.
        toast.error(result.code === "no_services" ? services("emptyBody") : t("draftBody"));
        return;
      }
      toast.success(t("published"));
      router.refresh();
    });
  }

  return (
    <Button onClick={onClick} disabled={isPending}>
      {isPending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <Rocket className="size-4" aria-hidden />
      )}
      {t("publish")}
    </Button>
  );
}
