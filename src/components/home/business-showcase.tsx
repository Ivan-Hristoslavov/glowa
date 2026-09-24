import { getTranslations } from "next-intl/server";

/**
 * A working-day calendar drawn in HTML: three stylists, a handful of
 * appointments landing one after another, and the "now" line drifting down.
 *
 * It is a picture of the product, not data. Names and services are generic
 * and nothing claims a figure about any real salon.
 */
const COLUMNS = [
  { key: "staff1", color: "var(--glowa-coral)" },
  { key: "staff2", color: "#7f9a86" },
  { key: "staff3", color: "#c9a893" },
] as const;

type Block = { column: 0 | 1 | 2; start: number; length: number; label: 1 | 2 | 3 | 4 | 5 };

/** Start and length in half-hour rows from 09:00. */
const BLOCKS: Block[] = [
  { column: 0, start: 0, length: 3, label: 1 },
  { column: 1, start: 1, length: 2, label: 3 },
  { column: 2, start: 0, length: 1, label: 2 },
  { column: 2, start: 2, length: 1, label: 2 },
  { column: 0, start: 4, length: 2, label: 4 },
  { column: 1, start: 4, length: 3, label: 1 },
  { column: 2, start: 5, length: 1, label: 5 },
];

const ROWS = 8;

export async function BusinessShowcase() {
  const t = await getTranslations("home.business");
  const hours = ["09:00", "10:00", "11:00", "12:00"];

  return (
    <div
      aria-hidden
      className="bg-card text-card-foreground relative overflow-hidden rounded-3xl border shadow-[var(--shadow-pop)]"
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex gap-1">
            <span className="bg-border size-2.5 rounded-full" />
            <span className="bg-border size-2.5 rounded-full" />
            <span className="bg-border size-2.5 rounded-full" />
          </span>
          <span className="font-heading ml-2 text-sm">{t("calendarTitle")}</span>
        </div>
        <span className="text-success flex items-center gap-1.5 text-xs font-medium">
          <span className="relative flex size-2">
            <span className="bg-success absolute inset-0 animate-ping rounded-full opacity-60" />
            <span className="bg-success relative size-2 rounded-full" />
          </span>
          {t("live")}
        </span>
      </div>

      <div className="grid grid-cols-[3rem_repeat(3,1fr)]">
        <div />
        {COLUMNS.map((column) => (
          <div key={column.key} className="flex items-center gap-2 border-l px-3 py-2.5">
            <span
              className="flex size-6 items-center justify-center rounded-full text-[0.65rem] font-semibold text-white"
              style={{ background: column.color }}
            >
              {t(column.key).charAt(0)}
            </span>
            <span className="truncate text-xs font-medium">{t(column.key)}</span>
          </div>
        ))}
      </div>

      <div className="relative grid grid-cols-[3rem_repeat(3,1fr)]">
        <div className="text-muted-foreground">
          {Array.from({ length: ROWS }).map((_, row) => (
            <div key={row} className="h-9 pr-2 text-right text-[0.6rem] tabular-nums">
              {row % 2 === 0 ? hours[row / 2] : ""}
            </div>
          ))}
        </div>
        {COLUMNS.map((column, columnIndex) => (
          <div
            key={column.key}
            className="relative border-l [background-image:linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:100%_2.25rem]"
          >
            {BLOCKS.filter((block) => block.column === columnIndex).map((block, index) => (
              <div
                key={`${block.start}-${index}`}
                className="glowa-enter absolute inset-x-1.5 overflow-hidden rounded-lg border-l-[3px] px-2 py-1.5"
                style={
                  {
                    top: `calc(${block.start} * 2.25rem + 3px)`,
                    height: `calc(${block.length} * 2.25rem - 6px)`,
                    borderColor: column.color,
                    background: `color-mix(in oklab, ${column.color} 16%, var(--card))`,
                    "--delay": `${400 + (block.column * 3 + block.start) * 90}ms`,
                  } as React.CSSProperties
                }
              >
                <p className="truncate text-[0.68rem] font-semibold">{t(`appt${block.label}`)}</p>
                {block.length > 1 ? (
                  <p className="text-muted-foreground truncate text-[0.6rem] tabular-nums">
                    {`${9 + Math.floor(block.start / 2)}:${block.start % 2 ? "30" : "00"}`}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ))}

        {/* The "now" line, drifting through the morning. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-full">
          <div className="absolute inset-x-0 flex animate-[glowa-now_14s_ease-in-out_infinite_alternate] items-center">
            <span className="bg-primary ml-11 size-2 rounded-full" />
            <span className="bg-primary h-px flex-1" />
          </div>
        </div>
      </div>
    </div>
  );
}
