"use client";

import { ChartShell, type SeriesMeta } from "@/components/admin/charts/chart-shell";

export type HorizontalBarRow = { label: string; value: number; display: string };

/**
 * Ranked magnitudes. Horizontal because the labels are names, and a name reads
 * better beside its bar than rotated under it. Single series, so no legend:
 * the title says what the length means, and every bar is directly labelled.
 */
export function HorizontalBarChart({
  title,
  description,
  rows,
  color = "var(--viz-series-1)",
}: {
  title: string;
  description?: string;
  rows: HorizontalBarRow[];
  color?: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  const series: SeriesMeta[] = [{ key: "value", label: title, color }];

  return (
    <ChartShell
      title={title}
      description={description}
      series={series}
      rows={rows.map((row) => ({ label: row.label, values: [row.display] }))}
    >
      <ul className="space-y-2.5">
        {rows.map((row) => (
          <li key={row.label} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{row.label}</span>
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {row.display}
              </span>
            </div>
            <div className="bg-muted h-2 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max((row.value / max) * 100, row.value > 0 ? 3 : 0)}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </ChartShell>
  );
}
