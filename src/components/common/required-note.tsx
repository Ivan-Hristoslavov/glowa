import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

/** "Fields marked * are required" - once per form, at the top. */
export function RequiredNote({ className }: { className?: string }) {
  const t = useTranslations("common");
  return (
    <p className={cn("text-muted-foreground text-xs", className)}>
      <span aria-hidden className="text-primary font-semibold">
        *
      </span>{" "}
      {t("requiredHint")}
    </p>
  );
}
