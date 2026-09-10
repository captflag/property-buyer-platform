"use client";

import { Table2, LineChart as LineChartIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Shared chart shell.
 *
 * Every chart in the app renders inside this. It supplies three things that the
 * design rules make non-optional rather than nice-to-have:
 *
 *   * A legend whenever there are two or more series, so identity is never
 *     carried by colour alone.
 *   * A table view toggle. Three of the light-mode series colours sit below 3:1
 *     against the surface, which obligates "relief" -- either visible direct
 *     labels or a table. Shipping the table means every chart satisfies it.
 *   * A single place for the accessible description, so screen reader users get
 *     the finding rather than "graphic".
 */

export interface Series {
  key: string;
  label: string;
  /** A CSS colour, normally `var(--series-N)`. */
  colour: string;
  /** Dashed marks read as projections/plans rather than measurements. */
  dashed?: boolean;
}

export function ChartFrame({
  title,
  description,
  series,
  table,
  children,
  action,
  className,
  height = "auto",
}: {
  title?: string;
  /** Read by screen readers in place of the chart. State the finding. */
  description: string;
  series?: Series[];
  /** Rendered when the reader switches to the table view. */
  table?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  height?: string | number;
}) {
  const [view, setView] = React.useState<"chart" | "table">("chart");
  const showLegend = (series?.length ?? 0) >= 2;

  return (
    <figure className={cn("m-0 flex flex-col gap-3", className)}>
      {(title || table || action) && (
        <div className="flex items-start justify-between gap-3">
          {title ? (
            <figcaption className="text-ink text-[13px] font-semibold">{title}</figcaption>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-1.5">
            {action}
            {table ? (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setView((v) => (v === "chart" ? "table" : "chart"))}
                aria-pressed={view === "table"}
                title={view === "chart" ? "Show as a table" : "Show as a chart"}
              >
                {view === "chart" ? <Table2 /> : <LineChartIcon />}
                <span className="sr-only">
                  {view === "chart" ? "Show the data as a table" : "Show the chart"}
                </span>
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {showLegend ? <ChartLegend series={series!} /> : null}

      {view === "chart" ? (
        <div
          role="img"
          aria-label={description}
          className="relative w-full"
          style={height === "auto" ? undefined : { height }}
        >
          {children}
        </div>
      ) : (
        <div className="max-h-80 scrollbar-thin overflow-auto">{table}</div>
      )}

      {/* The description is also exposed as text for the table view and for
          anyone reading with images off. */}
      <p className="sr-only">{description}</p>
    </figure>
  );
}

export function ChartLegend({ series, className }: { series: Series[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)}>
      {series.map((s) => (
        <li key={s.key} className="text-ink-2 flex items-center gap-1.5 text-[11px]">
          <span
            aria-hidden="true"
            className="h-0.5 w-3.5 shrink-0 rounded-full"
            style={
              s.dashed
                ? {
                    backgroundImage: `repeating-linear-gradient(90deg, ${s.colour} 0 4px, transparent 4px 7px)`,
                  }
                : { backgroundColor: s.colour }
            }
          />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/* Tooltip                                                                     */
/* -------------------------------------------------------------------------- */

export interface TooltipRow {
  label: string;
  value: string;
  colour?: string;
}

export function ChartTooltip({
  x,
  y,
  title,
  rows,
  containerWidth,
}: {
  x: number;
  y: number;
  title: string;
  rows: TooltipRow[];
  containerWidth: number;
}) {
  // Flip to the left of the cursor near the right edge so the tooltip never
  // hangs off the card.
  const flip = x > containerWidth * 0.62;

  return (
    <div
      role="presentation"
      className={cn(
        "pointer-events-none absolute z-20 min-w-36",
        "bg-surface border-line rounded-[var(--radius-card)] border px-2.5 py-2",
        "shadow-[0_8px_24px_rgba(11,11,11,0.14)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.7)]",
      )}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        transform: `translate(${flip ? "calc(-100% - 12px)" : "12px"}, -50%)`,
      }}
    >
      <p className="text-ink-3 mb-1 text-[10px] font-medium tracking-wide uppercase">{title}</p>
      <ul className="flex flex-col gap-1">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-4 text-[11px]">
            <span className="text-ink-2 flex items-center gap-1.5">
              {row.colour ? (
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: row.colour }}
                />
              ) : null}
              {row.label}
            </span>
            <span className="text-ink tabular font-semibold">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Track the pointer over a chart and hand back its position in both pixel and
 * data space. Kept here so every chart's hover behaves identically.
 */
export function usePointerTracking<T extends SVGSVGElement>() {
  const ref = React.useRef<T>(null);
  const [pointer, setPointer] = React.useState<{ x: number; y: number; width: number } | null>(
    null,
  );

  const onPointerMove = React.useCallback((event: React.PointerEvent<T>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setPointer({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      width: rect.width,
    });
  }, []);

  const onPointerLeave = React.useCallback(() => setPointer(null), []);

  return { ref, pointer, handlers: { onPointerMove, onPointerLeave } };
}

/* Series colours live in a non-client module so server components can resolve
   them too; re-exported here because the charts import them from this file. */
export { SERIES_COLOURS, seriesColour } from "@/lib/palette";
