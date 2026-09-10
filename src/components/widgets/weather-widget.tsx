import { Cloud, CloudDrizzle, CloudRain, Sun, CloudSun, Zap, type LucideIcon } from "lucide-react";
import * as React from "react";

import { Card, CardContent, CardDescription, CardTitle, CardToolbar } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { weatherImpactBreakdown } from "@/lib/domain/forecast";
import { cn } from "@/lib/utils";
import type { WeatherLogEntry } from "@/types/database";

const CONDITION_ICON: Record<string, LucideIcon> = {
  Clear: Sun,
  "Partly cloudy": CloudSun,
  Overcast: Cloud,
  "Light rain": CloudDrizzle,
  "Heavy rain": CloudRain,
  Storm: Zap,
};

/**
 * Weather and its effect on the programme.
 *
 * Weather is the single most common cause of construction delay and the one
 * buyers are most likely to accept -- provided they can see it. Showing days
 * lost alongside the forecast turns "we're running late" into "we lost four
 * days to rain in April", which is a very different conversation.
 */
export function WeatherWidget({
  entries,
  className,
}: {
  entries: WeatherLogEntry[];
  className?: string;
}) {
  const recent = entries.slice(0, 7);
  const last30 = entries.slice(0, 30);

  const daysLost = last30.reduce(
    (total, e) => total + (e.work_impact === "full" ? 1 : e.work_impact === "partial" ? 0.5 : 0),
    0,
  );
  const hoursLost = last30.reduce((total, e) => total + e.hours_lost, 0);
  const breakdown = weatherImpactBreakdown(last30);

  if (recent.length === 0) {
    return null;
  }

  return (
    <Card className={className}>
      <CardToolbar>
        <div>
          <CardTitle>Weather impact</CardTitle>
          <CardDescription>Working days lost in the last 30 days</CardDescription>
        </div>
      </CardToolbar>

      <CardContent className="flex flex-col gap-4">
        <div className="flex items-end gap-4">
          <div>
            <p className="text-ink text-[26px] leading-none font-semibold tracking-[-0.02em]">
              {daysLost % 1 === 0 ? daysLost : daysLost.toFixed(1)}
              <span className="text-ink-3 ml-1 text-sm font-medium">
                {daysLost === 1 ? "day" : "days"}
              </span>
            </p>
            <p className="text-ink-3 mt-1 text-[11px]">{hoursLost.toFixed(0)} crew hours lost</p>
          </div>
        </div>

        {/* Last seven days, most recent first */}
        <div>
          <p className="text-ink-3 mb-2 text-[11px] font-medium tracking-wide uppercase">
            Last seven days
          </p>
          <ul className="flex gap-1.5">
            {recent
              .slice()
              .reverse()
              .map((entry) => {
                const Icon = CONDITION_ICON[entry.condition] ?? Cloud;
                const impacted = entry.work_impact !== "none";
                return (
                  <li
                    key={entry.id}
                    className={cn(
                      "flex flex-1 flex-col items-center gap-1 rounded-[var(--radius-card)] py-2",
                      impacted ? "bg-serious-subtle" : "bg-surface-2",
                    )}
                    title={`${formatDate(entry.observed_on, "short")}: ${entry.condition}${
                      impacted ? `, ${entry.work_impact} work stoppage` : ""
                    }`}
                  >
                    <Icon
                      className={cn("size-4", impacted ? "text-serious-ink" : "text-ink-3")}
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <span className="tabular text-ink-3 text-[10px]">
                      {Math.round(entry.temp_c ?? 0)}°
                    </span>
                    <span className="sr-only">
                      {formatDate(entry.observed_on)}: {entry.condition}
                      {impacted ? `, ${entry.work_impact} work stoppage` : ", no impact"}
                    </span>
                  </li>
                );
              })}
          </ul>
        </div>

        {breakdown.length > 0 ? (
          <div className="border-line border-t pt-3">
            <p className="text-ink-3 mb-2 text-[11px] font-medium tracking-wide uppercase">
              What stopped work
            </p>
            <ul className="flex flex-col gap-1.5">
              {breakdown.slice(0, 3).map((row) => (
                <li key={row.condition} className="flex items-center justify-between text-[12px]">
                  <span className="text-ink-2">{row.condition}</span>
                  <span className="tabular text-ink font-medium">
                    {row.days % 1 === 0 ? row.days : row.days.toFixed(1)}{" "}
                    {row.days === 1 ? "day" : "days"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-ink-3 border-line border-t pt-3 text-[12px]">
            No weather stoppages in the last 30 days.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
