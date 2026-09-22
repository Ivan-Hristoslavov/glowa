import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type MetricCardProps = {
  label: string;
  value: string;
  hint?: string | null;
  icon?: LucideIcon;
  tone?: "default" | "warning";
};

/** One number, its name and at most one line of context. Nothing else. */
export function MetricCard({ label, value, hint, icon: Icon, tone = "default" }: MetricCardProps) {
  return (
    <div className="glowa-card p-4">
      <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
        <span>{label}</span>
        {Icon ? <Icon className="size-4" aria-hidden /> : null}
      </div>
      <p
        className={cn(
          "font-heading mt-2 text-2xl leading-none",
          tone === "warning" && "text-primary",
        )}
      >
        {value}
      </p>
      {hint ? <p className="text-muted-foreground mt-1.5 text-xs">{hint}</p> : null}
    </div>
  );
}
