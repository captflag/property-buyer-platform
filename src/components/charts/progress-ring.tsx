"use client";

import * as React from "react";

import { useCountUp } from "@/lib/hooks";
import { clamp, cn, scale } from "@/lib/utils";

/**
 * A single completion figure as a ring.
 *
 * The number is the point of this widget, so it is the largest thing in it and
 * the ring is the supporting mark -- not the other way round. A second, muted
 * arc shows where the plan says the project should be, which turns a bare
 * number into a comparison without adding a chart.
 */
export function ProgressRing({
  value,
  target,
  size = 132,
  strokeWidth = 9,
  label,
  caption,
  tone = "brand",
  className,
}: {
  value: number;
  /** Optional planned position, drawn as a tick on the track. */
  target?: number | null;
  size?: number;
  strokeWidth?: number;
  label: string;
  caption?: string;
  tone?: "brand" | "good" | "warning" | "critical";
  className?: string;
}) {
  const pct = clamp(value, 0, 100);
  const shown = useCountUp(pct, { decimals: 0 });
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (pct / 100) * circumference;

  const colour = {
    brand: "var(--brand)",
    good: "var(--good)",
    warning: "var(--warning)",
    critical: "var(--critical)",
  }[tone];

  // The tick sits on the ring at the target's angle, starting from 12 o'clock.
  const targetAngle = target != null ? (clamp(target, 0, 100) / 100) * 360 - 90 : null;

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          aria-hidden="true"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--surface-3)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colour}
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
            strokeDasharray={`${dash} ${circumference - dash}`}
            className="chart-mark transition-[stroke-dasharray] duration-700 ease-out"
          />
          {targetAngle !== null ? (
            <line
              x1={
                size / 2 + (radius - strokeWidth / 2 - 2) * Math.cos((targetAngle * Math.PI) / 180)
              }
              y1={
                size / 2 + (radius - strokeWidth / 2 - 2) * Math.sin((targetAngle * Math.PI) / 180)
              }
              x2={
                size / 2 + (radius + strokeWidth / 2 + 2) * Math.cos((targetAngle * Math.PI) / 180)
              }
              y2={
                size / 2 + (radius + strokeWidth / 2 + 2) * Math.sin((targetAngle * Math.PI) / 180)
              }
              stroke="var(--ink-2)"
              strokeWidth={2}
              strokeLinecap="butt"
            />
          ) : null}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="ui-display text-ink text-[38px] leading-none tracking-[-0.055em]">
            <span aria-hidden="true">{Math.round(shown)}</span>
            <span className="text-ink-3 text-base">%</span>
          </span>
          {caption ? (
            <span className="text-ink-3 mt-1 text-[11px] font-medium">{caption}</span>
          ) : null}
        </div>
      </div>
      <p className="sr-only">
        {label}: {pct.toFixed(1)} percent
        {target != null ? `, against a plan of ${target.toFixed(1)} percent` : ""}.
      </p>
    </div>
  );
}

/**
 * A compact trend line for stat tiles. No axes, no labels -- it exists to show
 * shape, and the tile's number carries the value.
 */
export function Sparkline({
  values,
  width = 84,
  height = 26,
  colour = "var(--series-1)",
  label,
  className,
}: {
  values: number[];
  width?: number;
  height?: number;
  colour?: string;
  label: string;
  className?: string;
}) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = 2;

  const points = values.map((v, i) => ({
    x: scale(i, [0, values.length - 1], [pad, width - pad]),
    y: scale(v, [min, max === min ? min + 1 : max], [height - pad, pad]),
  }));

  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const last = points[points.length - 1]!;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible", className)}
      role="img"
      aria-label={label}
    >
      <path
        d={d}
        fill="none"
        stroke={colour}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="chart-mark"
      />
      <circle cx={last.x} cy={last.y} r={2.25} fill={colour} className="chart-mark" />
    </svg>
  );
}

/**
 * A horizontal meter: one value against a track, with an optional threshold.
 * Used wherever a stat tile needs "how far along" without a full chart.
 */
export function Meter({
  value,
  max = 100,
  threshold,
  tone = "brand",
  label,
  className,
}: {
  value: number;
  max?: number;
  threshold?: number;
  tone?: "brand" | "good" | "warning" | "critical" | "accent";
  label: string;
  className?: string;
}) {
  const pct = clamp((value / max) * 100, 0, 100);
  const thresholdPct = threshold != null ? clamp((threshold / max) * 100, 0, 100) : null;

  const fill = {
    brand: "bg-brand",
    good: "bg-good",
    warning: "bg-warning",
    critical: "bg-critical",
    accent: "bg-accent",
  }[tone];

  return (
    <div
      className={cn(
        "bg-surface-3 border-line relative h-2 w-full overflow-hidden border",
        className,
      )}
      role="meter"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
    >
      <div
        className={cn("h-full transition-[width] duration-500 ease-out", fill)}
        style={{ width: `${pct}%` }}
      />
      {thresholdPct !== null ? (
        <span
          aria-hidden="true"
          className="bg-ink-2 absolute inset-y-0 w-0.5"
          style={{ left: `${thresholdPct}%` }}
        />
      ) : null}
    </div>
  );
}
