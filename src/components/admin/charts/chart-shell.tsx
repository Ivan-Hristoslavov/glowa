import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type SeriesMeta = { key: string; label: string; color: string };

/**
 * Shared chrome for every chart: title, optional legend, and a visually hidden
 * table holding the same numbers. The table is the accessibility path and the
 * relief mechanism the dataviz rules require - identity is never colour alone.
 */
export function ChartShell({
  title,
  description,
  series,
  rows,
  children,
  className,
}: {
  title: string;
  description?: string;
  series: SeriesMeta[];
  /** Same data as the marks, for the hidden table. */
  rows: Array<{ label: string; values: string[] }>;
  children: ReactNode;
  className?: string;
}) {
  return (
    <figure className={cn("glowa-card space-y-3 p-5", className)}>
      <figcaption className="space-y-1">
        <h3 className="font-heading text-base">{title}</h3>
        {description ? (
          <p className="text-muted-foreground text-xs">{description}</p>
        ) : null}
      </figcaption>

      {series.length > 1 ? (
        <ul className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {series.map((item) => (
            <li key={item.key} className="flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-[3px]"
                style={{ backgroundColor: item.color }}
                aria-hidden
              />
              {item.label}
            </li>
          ))}
        </ul>
      ) : null}

      {children}

      {/* The `sr-only` utility clamps to 1px, but a <table> sizes itself from
          its content regardless and pushed the page 34px wider than the
          phone. Clamping the wrapper instead keeps the table readable to a
          screen reader without it escaping the layout. */}
      <div className="sr-only">
        <table>
          <caption>{title}</caption>
          <thead>
            <tr>
              <th scope="col">—</th>
              {series.map((item) => (
                <th key={item.key} scope="col">
                  {item.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {row.values.map((value, index) => (
                  <td key={index}>{value}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
