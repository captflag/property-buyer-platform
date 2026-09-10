"use client";

import { AlertTriangle } from "lucide-react";
import * as React from "react";

import {
  ChartFrame,
  ChartTooltip,
  seriesColour,
  usePointerTracking,
  type Series,
} from "@/components/charts/chart-frame";
import { formatCurrency, formatDate, parseDate } from "@/lib/format";
import type { CategoryRollup } from "@/lib/domain/finance";
import { cn, clamp, scale } from "@/lib/utils";
import type { CostEntry } from "@/types/database";

/**
 * Budget versus spend, one row per cost category.
 *
 * Bars beat a pie here for the same reason they usually do: the question is
 * "which categories are running hot", which is a magnitude comparison, and
 * comparing bar lengths against a shared baseline is far easier than comparing
 * angles. It also keeps the palette on its adjacent pairlist rather than the
 * all-pairs one a pie would force.
 *
 * Committed and actual are stacked with a 2px surface gap between them, so the
 * split stays legible without a second chart.
 */
export function BudgetBarChart({
  categories,
  currency,
  className,
}: {
  categories: CategoryRollup[];
  currency: string;
  className?: string;
}) {
  const max = Math.max(...categories.map((c) => Math.max(c.budgeted, c.actual + c.committed)), 1);
  const overCount = categories.filter((c) => c.isOverBudget).length;

  const series: Series[] = [
    { key: "actual", label: "Spent", colour: "var(--series-1)" },
    { key: "committed", label: "Committed", colour: "var(--series-4)" },
    { key: "budget", label: "Budget", colour: "var(--line-strong)" },
  ];

  return (
    <ChartFrame
      description={`Budget against spend for ${categories.length} cost categories. ${overCount === 0 ? "All categories are within budget." : `${overCount} ${overCount === 1 ? "category is" : "categories are"} over budget once committed orders are counted.`}`}
      series={series}
      className={className}
      table={<BudgetTable categories={categories} currency={currency} />}
    >
      <ul className="flex flex-col gap-3">
        {categories.map((category) => {
          const spentPct = (category.actual / max) * 100;
          const committedPct = (category.committed / max) * 100;
          const budgetPct = (category.budgeted / max) * 100;

          return (
            <li key={category.id} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-ink-2 flex items-center gap-1.5 text-[12px]">
                  {category.name}
                  {category.isOverBudget ? (
                    <AlertTriangle
                      className="text-serious size-3"
                      aria-label="Over budget"
                      strokeWidth={2.5}
                    />
                  ) : null}
                </span>
                {/* Direct label -- the relief the light-mode palette obliges. */}
                <span className="tabular text-ink text-[12px] font-medium">
                  {formatCurrency(category.actual + category.committed, currency, {
                    compact: true,
                  })}
                  <span className="text-ink-3 font-normal">
                    {" / "}
                    {formatCurrency(category.budgeted, currency, { compact: true })}
                  </span>
                </span>
              </div>

              <div className="relative h-4">
                {/* Budget track */}
                <div
                  className="bg-surface-3 absolute inset-y-0 left-0"
                  style={{ width: `${budgetPct}%` }}
                />
                {/* Spent */}
                <div
                  className="chart-mark absolute inset-y-0 left-0"
                  style={{
                    width: `${spentPct}%`,
                    backgroundColor: "var(--series-1)",
                    borderTopRightRadius: 0,
                    borderBottomRightRadius: 0,
                  }}
                />
                {/* Committed, offset by 2px so the two segments never merge */}
                {committedPct > 0 ? (
                  <div
                    className="chart-mark absolute inset-y-0"
                    style={{
                      left: `calc(${spentPct}% + 2px)`,
                      width: `calc(${committedPct}% - 2px)`,
                      backgroundColor: "var(--series-4)",
                    }}
                  />
                ) : null}
                {/* Budget ceiling tick */}
                <span
                  aria-hidden="true"
                  className="bg-line-strong absolute inset-y-0 w-0.5"
                  style={{ left: `${budgetPct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </ChartFrame>
  );
}

function BudgetTable({ categories, currency }: { categories: CategoryRollup[]; currency: string }) {
  return (
    <table className="w-full text-[13px]">
      <caption className="sr-only">Budget, committed and actual spend by category</caption>
      <thead className="text-ink-3 border-line sticky top-0 border-b text-left text-[11px] tracking-wide uppercase">
        <tr className="bg-surface">
          <th scope="col" className="py-2 pr-3 font-medium">
            Category
          </th>
          <th scope="col" className="py-2 pr-3 text-right font-medium">
            Budget
          </th>
          <th scope="col" className="py-2 pr-3 text-right font-medium">
            Spent
          </th>
          <th scope="col" className="py-2 pr-3 text-right font-medium">
            Committed
          </th>
          <th scope="col" className="py-2 text-right font-medium">
            Remaining
          </th>
        </tr>
      </thead>
      <tbody className="divide-line divide-y">
        {categories.map((c) => (
          <tr key={c.id}>
            <td className="py-1.5 pr-3">{c.name}</td>
            <td className="tabular py-1.5 pr-3 text-right">
              {formatCurrency(c.budgeted, currency)}
            </td>
            <td className="tabular py-1.5 pr-3 text-right">{formatCurrency(c.actual, currency)}</td>
            <td className="tabular py-1.5 pr-3 text-right">
              {formatCurrency(c.committed, currency)}
            </td>
            <td
              className={cn(
                "tabular py-1.5 text-right font-medium",
                c.isOverBudget ? "text-critical-ink" : "text-ink-2",
              )}
            >
              {formatCurrency(c.remaining, currency)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Spend composition as a single stacked bar.
 *
 * Stacked segments sit on the adjacent pairlist, and the 2px surface gaps keep
 * neighbouring categories from reading as one block.
 */
export function SpendCompositionBar({
  categories,
  currency,
  className,
}: {
  categories: CategoryRollup[];
  currency: string;
  className?: string;
}) {
  const spent = categories.map((c) => ({ ...c, total: c.actual + c.committed }));
  const grandTotal = spent.reduce((t, c) => t + c.total, 0);
  const visible = spent.filter((c) => c.total > 0);

  if (grandTotal === 0) {
    return <p className="text-ink-3 text-sm">No spend recorded yet.</p>;
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex h-7 w-full gap-[2px] overflow-hidden rounded-[var(--radius-card)]">
        {visible.map((c) => (
          <div
            key={c.id}
            className="chart-mark h-full"
            style={{
              width: `${(c.total / grandTotal) * 100}%`,
              backgroundColor: seriesColour(c.colourSlot),
            }}
            title={`${c.name}: ${formatCurrency(c.total, currency)}`}
          />
        ))}
      </div>

      <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {visible.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-ink-2 flex min-w-0 items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-2 shrink-0"
                style={{ backgroundColor: seriesColour(c.colourSlot) }}
              />
              <span className="truncate">{c.name}</span>
            </span>
            <span className="tabular text-ink shrink-0 font-medium">
              {((c.total / grandTotal) * 100).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Cumulative spend over time. One series, so no legend -- the title names it.
 */
export function CashflowChart({
  costs,
  budgetTotal,
  currency,
  className,
}: {
  costs: CostEntry[];
  budgetTotal: number;
  currency: string;
  className?: string;
}) {
  const { ref, pointer, handlers } = usePointerTracking<SVGSVGElement>();

  const W = 620;
  const H = 180;
  const M = { top: 12, right: 12, bottom: 24, left: 46 };
  const PLOT_W = W - M.left - M.right;
  const PLOT_H = H - M.top - M.bottom;

  const points = React.useMemo(() => {
    const actual = costs
      .filter((c) => c.kind === "actual")
      .slice()
      .sort((a, b) => (a.incurred_on < b.incurred_on ? -1 : 1));

    // Roll up to month buckets so the line reads as cash flow, not noise.
    const byMonth = new Map<string, number>();
    for (const cost of actual) {
      const month = cost.incurred_on.slice(0, 7);
      byMonth.set(month, (byMonth.get(month) ?? 0) + cost.amount);
    }

    const sorted = [...byMonth.entries()].sort(([a], [b]) => (a < b ? -1 : 1));

    // Prefix sum without a running accumulator captured by the callback. This
    // is quadratic, but the list is one entry per month of a build -- a couple
    // of dozen at most -- so clarity is worth more than the constant factor.
    return sorted.map(([month, amount], index) => ({
      month,
      amount,
      cumulative: sorted.slice(0, index + 1).reduce((total, [, value]) => total + value, 0),
    }));
  }, [costs]);

  if (points.length < 2) {
    return <p className="text-ink-3 py-6 text-center text-sm">Not enough spend history yet.</p>;
  }

  const maxY = Math.max(budgetTotal, points[points.length - 1]!.cumulative) * 1.05;

  const coords = points.map((p, i) => ({
    ...p,
    x: M.left + scale(i, [0, points.length - 1], [0, PLOT_W]),
    y: M.top + scale(p.cumulative, [0, maxY], [PLOT_H, 0]),
  }));

  const path = coords
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const budgetY = M.top + scale(budgetTotal, [0, maxY], [PLOT_H, 0]);

  // Nearest point to the cursor, found without reassignment so the render
  // stays free of mutation.
  const hovered = pointer
    ? coords.reduce((closest, candidate) => {
        const svgX = (pointer.x / pointer.width) * W;
        return Math.abs(candidate.x - svgX) < Math.abs(closest.x - svgX) ? candidate : closest;
      })
    : null;

  return (
    <ChartFrame
      title="Cumulative spend"
      description={`Cumulative actual spend has reached ${formatCurrency(points[points.length - 1]!.cumulative, currency)} against a total budget of ${formatCurrency(budgetTotal, currency)}.`}
      className={className}
      table={
        <table className="w-full text-[13px]">
          <caption className="sr-only">Monthly and cumulative spend</caption>
          <thead className="text-ink-3 border-line border-b text-left text-[11px] tracking-wide uppercase">
            <tr className="bg-surface">
              <th scope="col" className="py-2 pr-3 font-medium">
                Month
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Spend
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Cumulative
              </th>
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {points
              .slice()
              .reverse()
              .map((p) => (
                <tr key={p.month}>
                  <td className="text-ink-2 py-1.5 pr-3">
                    {formatDate(`${p.month}-01`, "medium")}
                  </td>
                  <td className="tabular py-1.5 pr-3 text-right">
                    {formatCurrency(p.amount, currency)}
                  </td>
                  <td className="tabular py-1.5 text-right font-medium">
                    {formatCurrency(p.cumulative, currency)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      }
    >
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none"
        preserveAspectRatio="xMidYMid meet"
        {...handlers}
      >
        <defs>
          <linearGradient id="cashflow-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--series-1)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--series-1)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 0.5, 1].map((f) => {
          const y = M.top + PLOT_H * (1 - f);
          return (
            <g key={f}>
              <line x1={M.left} y1={y} x2={W - M.right} y2={y} className="chart-grid" />
              <text x={M.left - 8} y={y + 3} textAnchor="end" className="chart-label">
                {formatCurrency(maxY * f, currency, { compact: true })}
              </text>
            </g>
          );
        })}

        <line
          x1={M.left}
          y1={budgetY}
          x2={W - M.right}
          y2={budgetY}
          stroke="var(--ink-3)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        <text x={W - M.right} y={budgetY - 5} textAnchor="end" className="chart-label">
          Budget
        </text>

        <path
          d={`${path} L${coords[coords.length - 1]!.x.toFixed(1)},${M.top + PLOT_H} L${coords[0]!.x.toFixed(1)},${M.top + PLOT_H} Z`}
          fill="url(#cashflow-fill)"
        />
        <path
          d={path}
          fill="none"
          stroke="var(--series-1)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="chart-mark"
        />

        {hovered ? (
          <>
            <line
              x1={hovered.x}
              y1={M.top}
              x2={hovered.x}
              y2={M.top + PLOT_H}
              stroke="var(--line-strong)"
              strokeWidth={1}
            />
            <circle
              cx={hovered.x}
              cy={hovered.y}
              r={4}
              fill="var(--series-1)"
              stroke="var(--chart-surface)"
              strokeWidth={2}
            />
          </>
        ) : null}
      </svg>

      {pointer && hovered ? (
        <ChartTooltip
          x={(hovered.x / W) * pointer.width}
          y={pointer.y}
          containerWidth={pointer.width}
          title={formatDate(`${hovered.month}-01`, "medium")}
          rows={[
            { label: "This month", value: formatCurrency(hovered.amount, currency) },
            { label: "Cumulative", value: formatCurrency(hovered.cumulative, currency) },
            {
              label: "Of budget",
              value: `${clamp((hovered.cumulative / budgetTotal) * 100, 0, 999).toFixed(0)}%`,
            },
          ]}
        />
      ) : null}
    </ChartFrame>
  );
}

/** Small helper kept next to the charts that use it. */
export function monthLabel(month: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(parseDate(`${month}-01`));
}
