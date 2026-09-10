"use client";

import * as React from "react";

import {
  ChartFrame,
  ChartTooltip,
  usePointerTracking,
  type Series,
} from "@/components/charts/chart-frame";
import { formatDate, parseDate } from "@/lib/format";
import { useInView } from "@/lib/hooks";
import { scale } from "@/lib/utils";
import type { ProgressSnapshot } from "@/types/database";

const W = 720;
const H = 260;
const M = { top: 16, right: 16, bottom: 28, left: 34 };
const PLOT_W = W - M.left - M.right;
const PLOT_H = H - M.top - M.bottom;

const SERIES: Series[] = [
  { key: "planned", label: "Planned", colour: "var(--series-1)", dashed: true },
  { key: "actual", label: "Actual", colour: "var(--series-3)" },
];

/**
 * Planned versus actual completion over time -- the S-curve.
 *
 * The planned line is dashed and the actual is solid: a reader should be able
 * to tell the intention from the measurement without consulting the legend.
 * The gap between them at the right edge is the schedule variance every other
 * widget on the page reports as a number.
 */
export function SCurveChart({
  snapshots,
  targetDate,
  className,
}: {
  snapshots: ProgressSnapshot[];
  targetDate?: string | null;
  className?: string;
}) {
  const { ref, pointer, handlers } = usePointerTracking<SVGSVGElement>();
  // Draw-in is triggered by scroll position, never gated on it: if the
  // observer never fires the lines are simply already drawn.
  const { ref: viewRef, hasEntered } = useInView<HTMLDivElement>();

  const points = React.useMemo(() => {
    if (snapshots.length === 0) return [];
    const t0 = parseDate(snapshots[0]!.captured_on).getTime();
    const t1 = parseDate(snapshots[snapshots.length - 1]!.captured_on).getTime();

    return snapshots.map((s) => {
      const t = parseDate(s.captured_on).getTime();
      return {
        date: s.captured_on,
        x: M.left + scale(t, [t0, t1 || t0 + 1], [0, PLOT_W]),
        planned: s.planned_percent,
        actual: s.actual_percent,
        yPlanned: M.top + scale(s.planned_percent, [0, 100], [PLOT_H, 0]),
        yActual: M.top + scale(s.actual_percent, [0, 100], [PLOT_H, 0]),
      };
    });
  }, [snapshots]);

  const nearest = React.useMemo(() => {
    if (!pointer || points.length === 0) return null;
    // Pointer x is in CSS pixels; the SVG is scaled to the container width.
    const svgX = (pointer.x / pointer.width) * W;
    let best = points[0]!;
    for (const p of points) {
      if (Math.abs(p.x - svgX) < Math.abs(best.x - svgX)) best = p;
    }
    return best;
  }, [pointer, points]);

  if (points.length < 2) {
    return (
      <p className="text-ink-3 py-8 text-center text-sm">
        Not enough progress history yet to draw a curve.
      </p>
    );
  }

  const line = (key: "yPlanned" | "yActual") =>
    points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p[key].toFixed(1)}`).join(" ");

  const area = `${line("yActual")} L${points[points.length - 1]!.x.toFixed(1)},${(M.top + PLOT_H).toFixed(1)} L${points[0]!.x.toFixed(1)},${(M.top + PLOT_H).toFixed(1)} Z`;

  const last = points[points.length - 1]!;
  const variance = last.actual - last.planned;

  const targetX =
    targetDate && points.length > 0
      ? (() => {
          const t0 = parseDate(points[0]!.date).getTime();
          const t1 = parseDate(last.date).getTime();
          const tt = parseDate(targetDate).getTime();
          // Only draw the marker if the target falls inside the plotted window.
          if (tt < t0 || tt > t1) return null;
          return M.left + scale(tt, [t0, t1], [0, PLOT_W]);
        })()
      : null;

  return (
    <ChartFrame
      description={`Progress against plan. Actual completion is ${last.actual.toFixed(1)} percent against a planned ${last.planned.toFixed(1)} percent, a variance of ${variance >= 0 ? "plus" : "minus"} ${Math.abs(variance).toFixed(1)} percentage points.`}
      series={SERIES}
      className={className}
      table={<SCurveTable snapshots={snapshots} />}
    >
      <div ref={viewRef}>
        <svg
          ref={ref}
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full touch-none"
          preserveAspectRatio="xMidYMid meet"
          {...handlers}
        >
          <defs>
            <linearGradient id="s-curve-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--series-3)" stopOpacity="0.16" />
              <stop offset="100%" stopColor="var(--series-3)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Gridlines stay recessive: hairlines, muted, behind the data. */}
          {[0, 25, 50, 75, 100].map((tick) => {
            const y = M.top + scale(tick, [0, 100], [PLOT_H, 0]);
            return (
              <g key={tick}>
                <line x1={M.left} y1={y} x2={W - M.right} y2={y} className="chart-grid" />
                <text x={M.left - 8} y={y + 3} textAnchor="end" className="chart-label">
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Date ticks: first, middle, last only. More would collide. */}
          {[0, Math.floor(points.length / 2), points.length - 1].map((i) => {
            const p = points[i]!;
            return (
              <text
                key={p.date}
                x={p.x}
                y={H - 8}
                textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
                className="chart-label"
              >
                {formatDate(p.date, "short")}
              </text>
            );
          })}

          {targetX !== null ? (
            <g>
              <line
                x1={targetX}
                y1={M.top}
                x2={targetX}
                y2={M.top + PLOT_H}
                stroke="var(--ink-3)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <text x={targetX - 4} y={M.top + 10} textAnchor="end" className="chart-label">
                Target
              </text>
            </g>
          ) : null}

          <path d={area} fill="url(#s-curve-fill)" />

          <path
            d={line("yPlanned")}
            fill="none"
            stroke="var(--series-1)"
            strokeWidth={2}
            strokeDasharray="5 4"
            strokeLinecap="round"
            className="chart-mark"
            opacity={hasEntered ? 1 : 0}
            style={{ transition: "opacity 600ms ease 200ms" }}
          />
          {/* pathLength normalises the stroke to 1 unit, so the dash offset can
            animate exactly from "undrawn" to "drawn" without measuring the
            path in the browser. */}
          <path
            d={line("yActual")}
            fill="none"
            stroke="var(--series-3)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="chart-mark"
            pathLength={1}
            style={{
              strokeDasharray: 1,
              strokeDashoffset: hasEntered ? 0 : 1,
              transition: "stroke-dashoffset 1100ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          />

          {/* Direct labels at the line ends -- the relief the palette obliges,
            and faster to read than a legend round-trip. */}
          <circle
            cx={last.x}
            cy={last.yActual}
            r={3.5}
            fill="var(--series-3)"
            className="chart-mark"
          />
          <circle
            cx={last.x}
            cy={last.yPlanned}
            r={3}
            fill="var(--series-1)"
            className="chart-mark"
          />

          {nearest ? (
            <g>
              <line
                x1={nearest.x}
                y1={M.top}
                x2={nearest.x}
                y2={M.top + PLOT_H}
                stroke="var(--line-strong)"
                strokeWidth={1}
              />
              <circle
                cx={nearest.x}
                cy={nearest.yActual}
                r={4}
                fill="var(--series-3)"
                stroke="var(--chart-surface)"
                strokeWidth={2}
              />
              <circle
                cx={nearest.x}
                cy={nearest.yPlanned}
                r={4}
                fill="var(--series-1)"
                stroke="var(--chart-surface)"
                strokeWidth={2}
              />
            </g>
          ) : null}
        </svg>
      </div>

      {pointer && nearest ? (
        <ChartTooltip
          x={(nearest.x / W) * pointer.width}
          y={pointer.y}
          containerWidth={pointer.width}
          title={formatDate(nearest.date, "medium")}
          rows={[
            {
              label: "Planned",
              value: `${nearest.planned.toFixed(1)}%`,
              colour: "var(--series-1)",
            },
            { label: "Actual", value: `${nearest.actual.toFixed(1)}%`, colour: "var(--series-3)" },
            {
              label: "Variance",
              value: `${nearest.actual - nearest.planned >= 0 ? "+" : "−"}${Math.abs(nearest.actual - nearest.planned).toFixed(1)} pts`,
            },
          ]}
        />
      ) : null}
    </ChartFrame>
  );
}

function SCurveTable({ snapshots }: { snapshots: ProgressSnapshot[] }) {
  // Weekly rows only -- a daily table of 300 rows helps nobody.
  const rows = snapshots
    .filter((_, i) => i % 2 === 0)
    .slice(-26)
    .reverse();

  return (
    <table className="w-full text-[13px]">
      <caption className="sr-only">Planned and actual completion by date</caption>
      <thead className="text-ink-3 border-line sticky top-0 border-b text-left text-[11px] tracking-wide uppercase">
        <tr className="bg-surface">
          <th scope="col" className="py-2 pr-3 font-medium">
            Date
          </th>
          <th scope="col" className="py-2 pr-3 text-right font-medium">
            Planned
          </th>
          <th scope="col" className="py-2 pr-3 text-right font-medium">
            Actual
          </th>
          <th scope="col" className="py-2 text-right font-medium">
            Variance
          </th>
        </tr>
      </thead>
      <tbody className="divide-line divide-y">
        {rows.map((s) => {
          const variance = s.actual_percent - s.planned_percent;
          return (
            <tr key={s.id}>
              <td className="text-ink-2 py-1.5 pr-3">{formatDate(s.captured_on, "medium")}</td>
              <td className="tabular py-1.5 pr-3 text-right">{s.planned_percent.toFixed(1)}%</td>
              <td className="tabular py-1.5 pr-3 text-right">{s.actual_percent.toFixed(1)}%</td>
              <td
                className={`tabular py-1.5 text-right font-medium ${variance < 0 ? "text-critical-ink" : "text-good-ink"}`}
              >
                {variance >= 0 ? "+" : "−"}
                {Math.abs(variance).toFixed(1)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
