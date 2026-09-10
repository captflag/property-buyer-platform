import * as React from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Content-shaped loading states.
 *
 * These deliberately mirror the geometry of the real thing rather than being
 * generic grey boxes: same grid, same card count, same proportions. That is
 * what stops the layout jumping when data arrives, and it is the difference
 * between a skeleton that reassures and a spinner that just says "wait".
 *
 * The whole tree is `aria-hidden` and the wrapper carries a single polite
 * status message. Announcing eighteen shimmering rectangles individually would
 * be actively hostile to a screen reader user.
 */

function Bar({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn("skeleton h-3", className)} style={style} aria-hidden="true" />;
}

/** Wraps a skeleton tree with one announcement for assistive tech. */
export function LoadingRegion({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p role="status" aria-live="polite" className="sr-only">
        {label}
      </p>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="mb-6 flex flex-col gap-2">
      <Bar className="h-7 w-56" />
      <Bar className="h-3.5 w-full max-w-lg" />
    </div>
  );
}

export function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} className="flex flex-col justify-between gap-4 p-4">
          <Bar className="h-2.5 w-24" />
          <Bar className="h-7 w-20" />
          <Bar className="h-2.5 w-32" />
        </Card>
      ))}
    </div>
  );
}

export function ChartSkeleton({ height = 220 }: { height?: number }) {
  // Bars of varied height read as a chart rather than as a grey slab.
  const heights = [42, 61, 55, 72, 68, 84, 78, 91, 86, 74, 88, 96];

  return (
    <div className="flex flex-col gap-3">
      <Bar className="h-2.5 w-32" />
      <div className="flex items-end gap-1.5" style={{ height }}>
        {heights.map((h, i) => (
          <div key={i} className="skeleton flex-1" style={{ height: `${h}%` }} aria-hidden="true" />
        ))}
      </div>
      <div className="flex justify-between">
        <Bar className="h-2 w-12" />
        <Bar className="h-2 w-12" />
        <Bar className="h-2 w-12" />
      </div>
    </div>
  );
}

export function GanttSkeleton({ rows = 8 }: { rows?: number }) {
  // Staggered offsets and widths so it reads as a schedule, not a bar chart.
  const layout = [
    [0, 26],
    [12, 22],
    [24, 30],
    [40, 18],
    [46, 34],
    [62, 24],
    [70, 26],
    [80, 18],
  ];

  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, i) => {
        const [start, width] = layout[i % layout.length]!;
        return (
          <div key={i} className="grid grid-cols-[132px_1fr] items-center gap-3">
            <Bar className="h-2.5" style={{ width: `${60 + ((i * 13) % 40)}%` }} />
            <div className="relative h-4">
              <div
                className="skeleton absolute inset-y-0"
                style={{ left: `${start}%`, width: `${width}%` }}
                aria-hidden="true"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function FeedSkeleton({ items = 3 }: { items?: number }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: items }, (_, i) => (
        <Card key={i} className="flex flex-col gap-3 p-5">
          <div className="flex items-center gap-2">
            <Bar className="h-4 w-20" />
            <Bar className="h-2.5 w-28" />
            <Bar className="ml-auto h-2.5 w-16" />
          </div>
          <Bar className="h-4 w-3/4" />
          <div className="flex flex-col gap-1.5">
            <Bar className="h-2.5 w-full" />
            <Bar className="h-2.5 w-full" />
            <Bar className="h-2.5 w-4/5" />
          </div>
          <div className="skeleton aspect-[16/9] w-full" aria-hidden="true" />
        </Card>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="flex flex-col">
      <div className="border-line-strong flex gap-4 border-b py-2.5">
        {Array.from({ length: columns }, (_, i) => (
          <Bar key={i} className="h-2.5 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="border-line flex gap-4 border-b py-3">
          {Array.from({ length: columns }, (_, c) => (
            <Bar key={c} className={cn("h-3 flex-1", c === 0 && "max-w-none")} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardListSkeleton({ items = 6 }: { items?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: items }, (_, i) => (
        <Card key={i} className="flex flex-col gap-3 p-4">
          <div className="flex gap-3">
            <div className="skeleton size-9 shrink-0" aria-hidden="true" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Bar className="h-3 w-4/5" />
              <Bar className="h-2 w-1/2" />
            </div>
          </div>
          <Bar className="h-2 w-1/3" />
          <div className="flex gap-2">
            <Bar className="h-8 flex-1" />
            <div className="skeleton size-8" aria-hidden="true" />
          </div>
        </Card>
      ))}
    </div>
  );
}

/** The dashboard, in outline. Mirrors the real grid exactly. */
export function DashboardSkeleton() {
  return (
    <LoadingRegion label="Loading your project overview">
      <PageHeaderSkeleton />

      <div className="flex flex-col gap-6">
        <Card className="grid lg:grid-cols-[1.35fr_1fr]">
          <div className="skeleton min-h-56 lg:min-h-full" aria-hidden="true" />
          <div className="flex flex-col items-center justify-center gap-5 p-6">
            <div className="skeleton size-[132px] rounded-full" aria-hidden="true" />
            <div className="flex w-full flex-col gap-3">
              <Bar className="h-3" />
              <Bar className="h-3" />
              <Bar className="h-3" />
            </div>
          </div>
        </Card>

        <StatGridSkeleton />

        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <Card className="p-5">
            <ChartSkeleton />
          </Card>
          <div className="flex flex-col gap-4">
            <Card className="flex flex-col gap-3 p-5">
              <Bar className="h-2.5 w-28" />
              <Bar className="h-10 w-24" />
              <Bar className="h-2" />
            </Card>
            <Card className="flex flex-col gap-3 p-5">
              <Bar className="h-2.5 w-32" />
              <Bar className="h-6 w-40" />
              <Bar className="h-2" />
            </Card>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="flex flex-col gap-4 p-5">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex gap-3">
                <div className="skeleton size-6 shrink-0 rounded-full" aria-hidden="true" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Bar className="h-3 w-2/3" />
                  <Bar className="h-2 w-1/3" />
                </div>
              </div>
            ))}
          </Card>
          <Card className="p-5">
            <ChartSkeleton height={160} />
          </Card>
        </div>
      </div>
    </LoadingRegion>
  );
}
