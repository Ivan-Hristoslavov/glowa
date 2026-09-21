"use client";

import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { toggleSavedBusiness } from "@/lib/actions/favorites";
import { cn } from "@/lib/utils";

type SaveBusinessButtonProps = {
  businessId: string;
  initiallySaved: boolean;
  isSignedIn: boolean;
  variant?: "default" | "icon";
};

export function SaveBusinessButton({
  businessId,
  initiallySaved,
  isSignedIn,
  variant = "default",
}: SaveBusinessButtonProps) {
  const t = useTranslations("business");
  const favorites = useTranslations("favorites");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useOptimistic(initiallySaved);

  function onClick() {
    if (!isSignedIn) {
      router.push("/login");
      return;
    }

    const next = !saved;
    startTransition(async () => {
      setSaved(next);
      const result = await toggleSavedBusiness(businessId, next);
      if (!result.ok) {
        toast.error(favorites("removed"));
        return;
      }
      toast.success(next ? favorites("added") : favorites("removed"));
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant={saved ? "secondary" : "outline"}
      size={variant === "icon" ? "icon" : "default"}
      onClick={onClick}
      disabled={isPending}
      aria-pressed={saved}
      aria-label={saved ? t("savedBusiness") : t("saveBusiness")}
    >
      <Heart className={cn("size-4", saved && "fill-primary text-primary")} aria-hidden />
      {variant === "default" ? (saved ? t("savedBusiness") : t("saveBusiness")) : null}
    </Button>
  );
}
