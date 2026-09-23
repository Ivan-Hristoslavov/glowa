"use client";

import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { toggleSavedBusiness } from "@/lib/actions/favorites";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type SaveBusinessButtonProps = {
  businessId: string;
  variant?: "default" | "icon";
  className?: string;
};

/**
 * Resolves both "is this person signed in" and "have they saved this salon"
 * in the browser.
 *
 * Passing them in from the server meant the salon page read cookies, which
 * made the one page that has to rank and be cached render per request. The
 * heart starts empty and fills in a moment later - the same state a
 * signed-out visitor sees, so for most traffic nothing changes at all.
 */
export function SaveBusinessButton({
  businessId,
  variant = "default",
  className,
}: SaveBusinessButtonProps) {
  const t = useTranslations("business");
  const favorites = useTranslations("favorites");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [initiallySaved, setInitiallySaved] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [saved, setSaved] = useOptimistic(initiallySaved);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    supabase.auth.getClaims().then(async ({ data }) => {
      const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
      if (!active) return;
      setIsSignedIn(Boolean(userId));
      if (!userId) return;

      // RLS scopes this to the caller's own rows, so no filter on profile id
      // is needed - or trusted.
      const { data: row } = await supabase
        .from("saved_businesses")
        .select("business_id")
        .eq("business_id", businessId)
        .maybeSingle();

      if (active) setInitiallySaved(Boolean(row));
    });

    return () => {
      active = false;
    };
  }, [businessId]);

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
      className={className}
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
