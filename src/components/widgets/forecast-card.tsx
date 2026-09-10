import { CalendarClock, TriangleAlert } from "lucide-react";
import * as React from "react";

import { Card, CardContent, CardDescription, CardTitle, CardToolbar } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Hint } from "@/components/ui/overlay";
import type { CompletionForecast } from "@/lib/domain/forecast";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const CONFIDENCE_COPY = {
  high: {
    label: "High confidence",
    tone: "good" as const,
    detail: "Progress has been steady and predictable.",
  },
  medium: {
    label: "Medium confidence",
    tone: "warning" as const,
    detail: "Progress has been uneven; treat the date as indicative.",
  },
  low: {
    label: "Low confidence",
    tone: "serious" as const,
    detail: "Progress has varied a lot. The range matters more than the date.",
  },
  insufficient: {
    label: "Not enough data",
    tone: "neutral" as const,
    detail: "There is not enough progress history to project a date.",
  },
};

/**
 * Projected completion, presented as a range rather than a promise.
 *
 * The model is a least-squares fit over recent progress and nothing more. It
 * is shown with its confidence, its window, and a plain sentence saying what
 * it does and does not account for -- because a single bold date here would be
 * read as a commitment, and this is not one.
 */
export function ForecastCard({
  forecast,
  targetDate,
  className,
}: {
  forecast: CompletionForecast;
  targetDate: string | null;
  className?: string;
}) {
  const confidence = CONFIDENCE_COPY[forecast.confidence];
  const slipping = forecast.slipDays != null && forecast.slipDays > 0;

  return (
    <Card className={className}>
      <CardToolbar>
        <div>
          <CardTitle>Completion forecast</CardTitle>
          <CardDescription>Projected from the recent rate of progress</CardDescription>
        </div>
        <CalendarClock
          className="text-ink-3 size-4 shrink-0"
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </CardToolbar>

      <CardContent className="flex flex-col gap-4">
        {forecast.projectedDate ? (
          <>
            <div>
              <p className="text-ink text-[24px] leading-tight font-semibold tracking-[-0.02em]">
                {formatDate(forecast.projectedDate, "medium")}
              </p>
              <p className="text-ink-3 mt-0.5 text-[12px]">
                Likely between {formatDate(forecast.earliestDate, "short")} and{" "}
                {formatDate(forecast.latestDate, "short")}
              </p>
            </div>

            <ForecastBand forecast={forecast} targetDate={targetDate} />

            <div className="flex flex-wrap items-center gap-2">
              <Hint content={confidence.detail}>
                <span>
                  <Badge
                    tone={confidence.tone}
                    icon={forecast.confidence === "high" ? undefined : TriangleAlert}
                  >
                    {confidence.label}
                  </Badge>
                </span>
              </Hint>
              {forecast.slipDays != null ? (
                <Badge tone={slipping ? "critical" : "good"}>
                  {slipping
                    ? `${forecast.slipDays} days later than target`
                    : forecast.slipDays === 0
                      ? "On target"
                      : `${Math.abs(forecast.slipDays)} days earlier than target`}
                </Badge>
              ) : null}
            </div>

            <p className="text-ink-3 border-line border-t pt-3 text-[11px] leading-relaxed">
              This projects the last {forecast.sampleSize} progress readings forward at{" "}
              {forecast.velocityPerDay.toFixed(2)} points per day. It does not know about upcoming
              crew changes, pending approvals or material lead times — treat it as a trend, not a
              commitment.
            </p>
          </>
        ) : (
          <p className="text-ink-3 text-sm leading-relaxed">
            {confidence.detail} A projection appears once there are at least four progress readings
            showing forward movement.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** The projected window against the target date, on one axis. */
function ForecastBand({
  forecast,
  targetDate,
}: {
  forecast: CompletionForecast;
  targetDate: string | null;
}) {
  if (!forecast.earliestDate || !forecast.latestDate || !forecast.projectedDate) return null;

  const dates = [forecast.earliestDate, forecast.latestDate, forecast.projectedDate];
  if (targetDate) dates.push(targetDate);

  const times = dates.map((d) => new Date(d).getTime());
  const min = Math.min(...times);
  const max = Math.max(...times);
  const span = max - min || 1;
  const pct = (d: string) => ((new Date(d).getTime() - min) / span) * 100;

  const left = pct(forecast.earliestDate);
  const right = pct(forecast.latestDate);

  return (
    <div className="pt-1 pb-5">
      <div className="relative h-2">
        <div className="bg-surface-3 absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full" />
        <div
          className="bg-brand-subtle absolute top-1/2 h-2 -translate-y-1/2 rounded-full"
          style={{ left: `${left}%`, width: `${Math.max(2, right - left)}%` }}
        />
        <span
          className="bg-brand absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: `${pct(forecast.projectedDate)}%` }}
          aria-hidden="true"
        />
        {targetDate ? (
          <span
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pct(targetDate)}%` }}
          >
            <span className="bg-ink-2 block h-4 w-0.5 rounded-full" aria-hidden="true" />
            <span className="text-ink-3 absolute top-4 left-1/2 -translate-x-1/2 text-[10px] font-medium whitespace-nowrap">
              Target
            </span>
          </span>
        ) : null}
      </div>
      <p className="sr-only">
        Projected completion {formatDate(forecast.projectedDate)}, within a window from{" "}
        {formatDate(forecast.earliestDate)} to {formatDate(forecast.latestDate)}
        {targetDate ? `, against a target of ${formatDate(targetDate)}` : ""}.
      </p>
    </div>
  );
}

/** Compact inline variant for dense dashboards. */
export function ForecastInline({
  forecast,
  className,
}: {
  forecast: CompletionForecast;
  className?: string;
}) {
  if (!forecast.projectedDate) {
    return <span className={cn("text-ink-3 text-sm", className)}>Not enough data</span>;
  }
  return (
    <span className={cn("text-ink text-sm font-medium", className)}>
      {formatDate(forecast.projectedDate, "medium")}
    </span>
  );
}
