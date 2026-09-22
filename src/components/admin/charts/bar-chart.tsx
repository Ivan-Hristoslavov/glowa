"use client";

import { useState } from "react";

import { ChartShell, type SeriesMeta } from "@/components/admin/charts/chart-shell";

export type BarPoint = { label: string; values: number[]; display: string[] };

/**
 * Grouped vertical bars. One y-scale only, 4px rounded tops anchored to the
 * baseline, a 2px surface gap between adjacent bars, and a hover tooltip -
 * an HTML chart is interactive by default.
 */
export function BarChart({
  title,
  description,
  series,
  points,
  height = 180,
}: {
  title: string;
  description?: string;
  series: SeriesMeta[];
  points: BarPoint[];
  height?: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  const max = Math.max(1, ...points.flatMap((point) => point.values));
  const groupWidth = 100 / Math.max(points.length, 1);
  const barWidth = (groupWidth * 0.62) / Math.max(series.length, 1);

  return (
    <ChartShell
      title={title}
      description={description}
      series={series}
      rows={points.map((point) => ({ label: point.label, values: point.display }))}
    >
      <div className="relative">
        <svg
          viewBox={`0 0 100 ${height}`}
          preserveAspectRatio="none"
          className="h-44 w-full"
          role="presentation"
        >
          {[0.25, 0.5, 0.75, 1].map((step) => (
            <line
              key={step}
              x1="0"
              x2="100"
              y1={height - step * height * 0.86}
              y2={height - step * height * 0.86}
              stroke="var(--viz-grid)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {points.map((point, pointIndex) =>
            point.values.map((value, seriesIndex) => {
              const barHeight = (value / max) * height * 0.86;
              const x =
                pointIndex * groupWidth +
                groupWidth * 0.19 +
                seriesIndex * barWidth +
                0.3;
              return (
                <rect
                  key={`${point.label}-${seriesIndex}`}
                  x={x}
                  y={height - barHeight}
                  width={Math.max(barWidth - 0.6, 0.5)}
                  height={Math.max(barHeight, value > 0 ? 2 : 0)}
                  rx="1.2"
                  fill={series[seriesIndex]?.color}
                  opacity={hovered === null || hovered === pointIndex ? 1 : 0.45}
                />
              );
            }),
          )}
        </svg>

        {/* Hit targets sit above the marks and are wider than them. */}
        <div className="absolute inset-0 flex">
          {points.map((point, index) => (
            <button
              key={point.label}
              type="button"
              className="flex-1"
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(index)}
              onBlur={() => setHovered(null)}
              aria-label={`${point.label}: ${point.display.join(", ")}`}
            />
          ))}
        </div>

        {hovered !== null ? (
          <div
            className="bg-popover text-popover-foreground pointer-events-none absolute top-1 rounded-md border px-2 py-1 text-xs shadow-md"
            style={{
              left: `${Math.min(Math.max(hovered * groupWidth, 0), 72)}%`,
            }}
            role="status"
          >
            <p className="font-medium">{points[hovered].label}</p>
            {points[hovered].display.map((value, index) => (
              <p key={index} className="text-muted-foreground">
                {series.length > 1 ? `${series[index]?.label}: ` : ""}
                {value}
              </p>
            ))}
          </div>
        ) : null}
      </div>

      <div className="text-muted-foreground flex text-[0.65rem]">
        {points.map((point) => (
          <span key={point.label} className="flex-1 text-center">
            {point.label}
          </span>
        ))}
      </div>
    </ChartShell>
  );
}
