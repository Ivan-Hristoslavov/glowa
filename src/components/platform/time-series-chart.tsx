"use client";

import { useEffect, useId, useRef, useState } from "react";

export type SeriesPoint = { label: string; value: number; display: string };

const PAD = { top: 12, right: 12, bottom: 26, left: 40 };

/** A round maximum, so the grid lines land on readable numbers. */
/**
 * The top of the scale and how many grid steps it has. Small counts get one
 * step per whole number (a booking is never "1.3"); larger ones get four steps
 * of 1, 2, 5 or 10 times a power of ten.
 */
function scaleFor(value: number) {
  if (value <= 4) {
    const top = Math.max(2, Math.ceil(value));
    return { max: top, steps: top };
  }
  const raw = value / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const n = raw / magnitude;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * magnitude;
  return { max: step * 4, steps: 4 };
}

/**
 * One line with a soft area, a crosshair and a tooltip that follows the
 * pointer (or the arrow keys). A single y-scale starting at zero; the grid is
 * quiet and the line is drawn in once when the data changes. The same numbers
 * are in a visually hidden table for screen readers.
 */
export function TimeSeriesChart({
  points,
  color = "var(--chart-1)",
  caption,
  height = 280,
  formatAxis,
}: {
  points: SeriesPoint[];
  color?: string;
  caption: string;
  height?: number;
  formatAxis: (value: number) => string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);
  const gradientId = useId();

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    observer.observe(node);
    setWidth(Math.max(280, node.clientWidth));
    return () => observer.disconnect();
  }, []);

  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const { max, steps } = scaleFor(Math.max(0, ...points.map((p) => p.value)));
  const x = (i: number) => PAD.left + (points.length <= 1 ? 0 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = points.length
    ? `${line} L${x(points.length - 1).toFixed(1)},${PAD.top + innerH} L${x(0).toFixed(1)},${PAD.top + innerH} Z`
    : "";

  const ticks = Array.from({ length: steps + 1 }, (_, i) => (i / steps) * max);
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(innerW / 90))));

  function indexFromPointer(clientX: number) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || points.length === 0) return null;
    const relative = (clientX - rect.left - PAD.left) / innerW;
    return Math.min(points.length - 1, Math.max(0, Math.round(relative * (points.length - 1))));
  }

  const active = hover !== null ? points[hover] : null;
  const tooltipLeft = hover !== null ? Math.min(Math.max(x(hover), 80), width - 80) : 0;

  return (
    <div ref={wrapRef} className="relative w-full select-none" style={{ height }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={caption}
        tabIndex={0}
        className="glowa-focus touch-pan-y overflow-visible rounded-lg"
        onPointerMove={(event) => setHover(indexFromPointer(event.clientX))}
        onPointerDown={(event) => setHover(indexFromPointer(event.clientX))}
        onPointerLeave={() => setHover(null)}
        onBlur={() => setHover(null)}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") setHover((h) => Math.min(points.length - 1, (h ?? -1) + 1));
          if (event.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? points.length) - 1));
          if (event.key === "Escape") setHover(null);
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="currentColor"
              strokeOpacity={tick === 0 ? 0.28 : 0.1}
              strokeDasharray={tick === 0 ? undefined : "2 4"}
            />
            <text
              x={PAD.left - 8}
              y={y(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted-foreground text-[10px] tabular-nums"
            >
              {formatAxis(tick)}
            </text>
          </g>
        ))}

        {points.map((p, i) =>
          i % labelEvery === 0 ? (
            <text
              key={p.label + i}
              x={x(i)}
              y={height - 6}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {p.label}
            </text>
          ) : null,
        )}

        {area ? <path d={area} fill={`url(#${gradientId})`} className="lav-fade" /> : null}
        {line ? (
          <path
            key={line.length + color}
            d={line}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            pathLength={1}
            className="lav-draw"
          />
        ) : null}

        {hover !== null && active ? (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke="currentColor" strokeOpacity={0.25} />
            <circle cx={x(hover)} cy={y(active.value)} r={5} fill={color} stroke="var(--card)" strokeWidth={2} />
          </g>
        ) : null}
      </svg>

      {active ? (
        <div
          className="bg-popover text-popover-foreground pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-xl border px-3 py-2 text-xs shadow-lg"
          style={{ left: tooltipLeft }}
          role="status"
        >
          <p className="text-muted-foreground">{active.label}</p>
          <p className="font-heading text-base tabular-nums">{active.display}</p>
        </div>
      ) : null}

      <div className="sr-only">
        <table>
          <caption>{caption}</caption>
          <tbody>
            {points.map((p, i) => (
              <tr key={p.label + i}>
                <th scope="row">{p.label}</th>
                <td>{p.display}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** A tiny trend line for a stat tile. No axes, no tooltip - it only shows direction. */
export function Sparkline({ values, color = "var(--chart-1)" }: { values: number[]; color?: string }) {
  const w = 96;
  const h = 32;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? w / (values.length - 1) : 0;
  const d = values
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - 3 - (v / max) * (h - 6)).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="shrink-0 overflow-visible">
      <path d={d} fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="lav-draw" />
    </svg>
  );
}
