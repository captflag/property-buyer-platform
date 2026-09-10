import { Check, Circle, Loader2, OctagonAlert } from "lucide-react";
import * as React from "react";

import { seriesColour } from "@/lib/palette";
import { Card, CardContent, CardDescription, CardTitle, CardToolbar } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { formatDate } from "@/lib/format";
import { expectedProgress } from "@/lib/domain/schedule";
import { cn } from "@/lib/utils";
import type { Milestone, Phase } from "@/types/database";

/**
 * The build as a sequence of phases.
 *
 * This is the buyer's mental model of their house -- "we're past framing, we're
 * into services" -- so it leads with phases rather than the 24 individual
 * milestones, and expands to those only where work is actually happening.
 */
export function MilestoneTracker({
  phases,
  milestones,
  now,
  className,
}: {
  phases: Phase[];
  milestones: Milestone[];
  now: Date;
  className?: string;
}) {
  const byPhase = new Map<string, Milestone[]>();
  for (const m of milestones) {
    if (!m.phase_id) continue;
    const list = byPhase.get(m.phase_id) ?? [];
    list.push(m);
    byPhase.set(m.phase_id, list);
  }

  return (
    <Card className={className}>
      <CardToolbar>
        <div>
          <CardTitle>Build phases</CardTitle>
          <CardDescription>Where your home is in the programme</CardDescription>
        </div>
      </CardToolbar>

      <CardContent>
        <ol className="relative flex flex-col">
          {phases.map((phase, index) => {
            const phaseMilestones = byPhase.get(phase.id) ?? [];
            const totalWeight = phaseMilestones.reduce((t, m) => t + m.weight, 0);
            const progress =
              totalWeight > 0
                ? phaseMilestones.reduce((t, m) => t + m.progress_percent * m.weight, 0) /
                  totalWeight
                : 0;

            const isLast = index === phases.length - 1;
            const active = phase.status === "in_progress";

            return (
              <li key={phase.id} className="relative flex gap-3 pb-5 last:pb-0">
                {/* Connector */}
                {!isLast ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute top-6 left-[11px] w-0.5",
                      "h-[calc(100%-16px)]",
                      phase.status === "completed" ? "bg-good" : "bg-line",
                    )}
                  />
                ) : null}

                <PhaseMarker status={phase.status} colour={seriesColour(phase.colour_slot)} />

                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <h4
                      className={cn(
                        "text-[13px] font-semibold",
                        phase.status === "not_started" ? "text-ink-3" : "text-ink",
                      )}
                    >
                      {phase.name}
                    </h4>
                    <span className="tabular text-ink-3 text-[11px]">
                      {phase.status === "completed"
                        ? `Completed ${formatDate(phase.actual_end ?? phase.planned_end, "short")}`
                        : phase.status === "in_progress"
                          ? `${Math.round(progress)}% · due ${formatDate(phase.planned_end, "short")}`
                          : `From ${formatDate(phase.planned_start, "short")}`}
                    </span>
                  </div>

                  {active ? (
                    <>
                      <Progress
                        value={progress}
                        label={`${phase.name} progress`}
                        size="sm"
                        className="mt-2"
                      />
                      <ul className="mt-2.5 flex flex-col gap-1.5">
                        {phaseMilestones
                          .filter((m) => m.status !== "not_started" || m.progress_percent > 0)
                          .slice(0, 4)
                          .map((m) => {
                            const expected = expectedProgress(m, now);
                            const behind = m.progress_percent < expected - 8;
                            return (
                              <li
                                key={m.id}
                                className="flex items-center justify-between gap-3 text-[12px]"
                              >
                                <span className="text-ink-2 flex min-w-0 items-center gap-1.5">
                                  {m.status === "blocked" ? (
                                    <OctagonAlert
                                      className="text-critical size-3 shrink-0"
                                      aria-label="Blocked"
                                    />
                                  ) : (
                                    <Circle
                                      className="text-ink-3 size-2 shrink-0 fill-current"
                                      aria-hidden="true"
                                    />
                                  )}
                                  <span className="truncate">{m.name}</span>
                                </span>
                                <span
                                  className={cn(
                                    "tabular shrink-0 font-medium",
                                    behind ? "text-serious-ink" : "text-ink-3",
                                  )}
                                >
                                  {m.progress_percent}%
                                </span>
                              </li>
                            );
                          })}
                      </ul>
                    </>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

function PhaseMarker({ status, colour }: { status: Phase["status"]; colour: string }) {
  const base = "relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full";

  if (status === "completed") {
    return (
      <span className={cn(base, "bg-good text-white")}>
        <Check className="size-3.5" strokeWidth={3} aria-label="Completed" />
      </span>
    );
  }

  if (status === "in_progress") {
    return (
      <span className={cn(base, "text-white")} style={{ backgroundColor: colour }}>
        <Loader2 className="size-3.5 animate-spin" strokeWidth={2.5} aria-label="In progress" />
      </span>
    );
  }

  if (status === "blocked") {
    return (
      <span className={cn(base, "bg-critical text-white")}>
        <OctagonAlert className="size-3.5" strokeWidth={2.5} aria-label="Blocked" />
      </span>
    );
  }

  return (
    <span className={cn(base, "bg-surface border-line-strong border-2")}>
      <span className="sr-only">Not started</span>
    </span>
  );
}
