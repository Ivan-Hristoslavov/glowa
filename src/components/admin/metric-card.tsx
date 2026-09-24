import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type MetricCardProps = {
  label: string;
  value: string;
  hint?: string | null;
  icon?: LucideIcon;
  tone?: "default" | "warning" | "success" | "accent";
  /** 0–100. Drawn as a thin bar under the value, for rates like utilisation. */
  progress?: number | null;
  /** Colour the number itself - reserved for something that needs attention. */
  alert?: boolean;
};

const TONES = {
  default: "bg-secondary text-secondary-foreground",
  accent: "bg-primary/12 text-primary",
  success: "bg-success/12 text-success",
  warning: "bg-warning/14 text-warning",
} as const;

/** One number, its name and at most one line of context. Nothing else. */
export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  progress,
  alert = false,
}: MetricCardProps) {
  return (
    <div className="glowa-card group hover:shadow-lift relative overflow-hidden rounded-2xl p-5 transition-shadow duration-300">
      <div className="flex items-start justify-between gap-3">
        <p className="text-muted-foreground text-sm">{label}</p>
        {Icon ? (
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105",
              TONES[tone],
            )}
          >
            <Icon className="size-4" aria-hidden />
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          "font-heading mt-3 text-3xl leading-none tabular-nums",
          alert && "text-warning",
        )}
      >
        {value}
      </p>
      {progress != null ? (
        <div className="bg-muted mt-4 h-1.5 overflow-hidden rounded-full" aria-hidden>
          <div
            className="bg-primary h-full rounded-full transition-[width] duration-700"
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      ) : null}
      {hint ? <p className="text-muted-foreground mt-2 text-xs">{hint}</p> : null}
    </div>
  );
}
