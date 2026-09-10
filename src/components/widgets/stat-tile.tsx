import { ArrowDownRight, ArrowRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import * as React from "react";

import { Card } from "@/components/ui/card";
import { Hint } from "@/components/ui/overlay";
import { cn } from "@/lib/utils";

/**
 * A single headline figure.
 *
 * The form heuristic says a lone number is a stat tile, not a chart -- so this
 * leads with the value at display size and treats everything else as support.
 *
 * The delta indicator pairs an arrow with a colour rather than relying on
 * colour alone, and `deltaMeaning` exists because "up" is not always good: a
 * rising issue count is bad, a rising completion percentage is good, and the
 * component cannot guess which it is holding.
 */
export function StatTile({
  label,
  value,
  unit,
  delta,
  deltaLabel,
  deltaMeaning = "up-is-good",
  icon: Icon,
  hint,
  footer,
  tone = "default",
  raised = false,
  className,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  /** Signed change. Sign picks the arrow; `deltaMeaning` picks the colour. */
  delta?: number | null;
  deltaLabel?: string;
  deltaMeaning?: "up-is-good" | "down-is-good" | "neutral";
  icon?: LucideIcon;
  hint?: string;
  footer?: React.ReactNode;
  tone?: "default" | "good" | "warning" | "serious" | "critical";
  /** The figure that most needs acting on: shown as the page's one panel. */
  raised?: boolean;
  className?: string;
}) {
  // Status colours the figure's own rule, rather than a rail on a box.
  const toneRule = {
    default: "",
    good: "border-t-good",
    warning: "border-t-warning",
    serious: "border-t-serious",
    critical: "border-t-critical",
  }[tone];

  const hasDelta = delta != null && Number.isFinite(delta);
  const direction = hasDelta ? (delta > 0.05 ? "up" : delta < -0.05 ? "down" : "flat") : "flat";

  const good =
    deltaMeaning === "neutral"
      ? null
      : deltaMeaning === "up-is-good"
        ? direction === "up"
        : direction === "down";

  const DeltaIcon =
    direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : ArrowRight;

  return (
    <Card
      raised={raised}
      className={cn(
        "flex flex-col justify-between gap-3 pt-4 pb-2",
        tone !== "default" && !raised && "border-t-2",
        !raised && toneRule,
        raised && "pb-4",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="ui-label text-ink-3 text-[10px]">{label}</span>
          {hint ? (
            <Hint content={hint}>
              <button
                type="button"
                className="text-ink-3 hover:text-ink-2 rounded-full text-[10px] leading-none"
                aria-label={`About ${label}`}
              >
                <span
                  aria-hidden="true"
                  className="border-line-strong flex size-3.5 items-center justify-center rounded-full border font-semibold"
                >
                  i
                </span>
              </button>
            </Hint>
          ) : null}
        </div>
        {Icon ? (
          <Icon className="text-ink-3 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        ) : null}
      </div>

      <div className="flex items-end justify-between gap-3">
        <p className="ui-display text-ink text-[40px] leading-[0.9] tracking-[-0.055em]">
          {value}
          {unit ? <span className="text-ink-3 ml-0.5 text-base font-medium">{unit}</span> : null}
        </p>

        {hasDelta ? (
          <span
            className={cn(
              "tabular flex items-center gap-0.5 border px-1.5 py-0.5 text-[11px] font-semibold",
              good === null
                ? "bg-surface-3 text-ink-2 border-line"
                : good
                  ? "bg-good-subtle text-good-ink border-good/40"
                  : "bg-critical-subtle text-critical-ink border-critical/40",
            )}
          >
            <DeltaIcon className="size-3" strokeWidth={2.5} aria-hidden="true" />
            {deltaLabel ?? `${Math.abs(delta).toFixed(1)}`}
          </span>
        ) : null}
      </div>

      {footer ? <div className="text-ink-3 text-[11px] leading-snug">{footer}</div> : null}
    </Card>
  );
}

/** A responsive row of stat tiles. */
export function StatGrid({
  children,
  columns = 4,
  className,
}: {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-3",
        columns === 2 && "grid-cols-1 sm:grid-cols-2",
        columns === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        columns === 4 && "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
