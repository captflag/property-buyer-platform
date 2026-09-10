"use client";

import { Activity, ChevronDown } from "lucide-react";
import * as React from "react";

import { Card, CardContent, CardDescription, CardTitle, CardToolbar } from "@/components/ui/card";
import { Meter } from "@/components/charts/progress-ring";
import type { HealthScore } from "@/lib/domain/forecast";
import { cn } from "@/lib/utils";

const GRADE_COPY = {
  good: { label: "Healthy", tone: "good" as const },
  warning: { label: "Watch", tone: "warning" as const },
  serious: { label: "At risk", tone: "serious" as const },
  critical: { label: "Critical", tone: "critical" as const },
};

/**
 * A single project health number that can always explain itself.
 *
 * A score with no breakdown is an assertion the reader has to take on trust,
 * and the first question anyone asks a number like this is "why?". The factor
 * list answers it in the same card, so the score is auditable rather than
 * oracular.
 */
export function HealthScoreCard({
  health,
  className,
}: {
  health: HealthScore;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const { label, tone } = GRADE_COPY[health.grade];

  const ring = {
    good: "text-good",
    warning: "text-warning",
    serious: "text-serious",
    critical: "text-critical",
  }[tone];

  const chip = {
    good: "bg-good-subtle text-good-ink",
    warning: "bg-warning-subtle text-warning-ink",
    serious: "bg-serious-subtle text-serious-ink",
    critical: "bg-critical-subtle text-critical-ink",
  }[tone];

  return (
    <Card className={className}>
      <CardToolbar>
        <div>
          <CardTitle>Project health</CardTitle>
          <CardDescription>Schedule, cost, quality and weather, weighted</CardDescription>
        </div>
        <Activity className="text-ink-3 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      </CardToolbar>

      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-baseline gap-1">
            <span className={cn("text-[40px] leading-none font-semibold tracking-[-0.03em]", ring)}>
              {health.score}
            </span>
            <span className="text-ink-3 text-sm font-medium">/ 100</span>
          </div>
          <span
            className={cn("ui-chip px-2 py-0.5 text-[11px] font-semibold", chip)}
            /* Grade is stated in words, never colour alone. */
          >
            {label}
          </span>
        </div>

        <Meter
          value={health.score}
          tone={tone === "serious" ? "warning" : tone}
          label="Health score"
        />

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="text-ink-2 hover:text-ink flex items-center gap-1 self-start text-[12px] font-medium transition-colors"
        >
          {open ? "Hide" : "Show"} what drives this
          <ChevronDown
            className={cn("size-3.5 transition-transform duration-200", open && "rotate-180")}
            aria-hidden="true"
          />
        </button>

        {open ? (
          <ul className="border-line flex flex-col gap-2.5 border-t pt-3">
            {health.factors.map((factor) => (
              <li key={factor.label} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-ink text-[12px] font-medium">{factor.label}</p>
                  <p className="text-ink-3 text-[11px] leading-snug">{factor.detail}</p>
                </div>
                <span
                  className={cn(
                    "tabular shrink-0 text-[12px] font-semibold",
                    factor.impact < -0.05 ? "text-critical-ink" : "text-good-ink",
                  )}
                >
                  {factor.impact < -0.05 ? `${factor.impact.toFixed(1)}` : "0.0"}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
