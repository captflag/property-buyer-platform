import { CalendarRange, Zap } from "lucide-react";
import type { Metadata } from "next";

import { GanttChart } from "@/components/charts/gantt-chart";
import { PageHeader } from "@/components/layout/app-shell";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardTitle, CardToolbar } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { StatGrid, StatTile } from "@/components/widgets/stat-tile";
import { getWorkspace } from "@/lib/data/workspace";
import { computeSchedule, expectedProgress, slippageDays } from "@/lib/domain/schedule";
import { formatDate } from "@/lib/format";
import { seriesColour } from "@/lib/palette";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Timeline" };

export default async function TimelinePage({ params }: PageProps<"/projects/[slug]/timeline">) {
  const { slug } = await params;
  const w = await getWorkspace(slug, ["phases", "milestones", "dependencies"]);
  const now = new Date(w.now);
  const today = w.now.slice(0, 10);

  const schedule = computeSchedule(w.milestones, w.dependencies);

  const critical = w.milestones.filter((m) => schedule.tasks.get(m.id)?.isCritical);
  const slipping = w.milestones
    .map((m) => ({ milestone: m, slip: slippageDays(m, now) }))
    .filter((entry) => entry.slip > 0 && entry.milestone.status !== "completed")
    .sort((a, b) => b.slip - a.slip);

  const behind = w.milestones.filter((m) => {
    if (m.status === "completed" || m.status === "cancelled") return false;
    return m.progress_percent < expectedProgress(m, now) - 8;
  });

  const completed = w.milestones.filter((m) => m.status === "completed").length;

  return (
    <>
      <PageHeader
        title="Timeline"
        scene="windowsDusk"
        description="Every milestone, its planned window, and how much of it can slip before your completion date moves."
      />

      <div className="flex flex-col gap-6">
        <StatGrid>
          <StatTile
            label="Milestones complete"
            value={`${completed}`}
            unit={`/ ${w.milestones.length}`}
            icon={CalendarRange}
            footer={`${w.phases.length} phases in the programme`}
          />
          <StatTile
            label="On the critical path"
            value={`${critical.length}`}
            icon={Zap}
            hint="Milestones with no float. A day lost on any of these is a day lost on the whole project."
            footer="Any delay here moves completion"
          />
          <StatTile
            label="Running behind"
            value={`${behind.length}`}
            tone={behind.length > 0 ? "warning" : "default"}
            hint="Milestones whose progress is more than 8 points below where the plan expects them today."
            footer={
              behind.length === 0 ? "All open work is on pace" : "More than 8 points off pace"
            }
          />
          <StatTile
            label="Worst slippage"
            value={slipping[0] ? `${slipping[0].slip}` : "0"}
            unit="days"
            tone={slipping[0] && slipping[0].slip > 10 ? "critical" : "default"}
            footer={slipping[0] ? slipping[0].milestone.name : "Nothing past its planned finish"}
          />
        </StatGrid>

        {schedule.brokenEdges.length > 0 ? (
          <Alert tone="warning" title="Circular dependency detected">
            {schedule.brokenEdges.length} dependency link
            {schedule.brokenEdges.length === 1 ? "" : "s"} had to be ignored to draw this schedule,
            because following {schedule.brokenEdges.length === 1 ? "it" : "them"} would loop back on
            itself. The rest of the chart is accurate; the affected links need correcting.
          </Alert>
        ) : null}

        <Card>
          <CardToolbar>
            <div>
              <CardTitle as="h2">Programme</CardTitle>
              <CardDescription>
                Bars show each milestone&apos;s planned window; the solid fill is progress to date.
                Critical milestones are marked — they have no spare time in the schedule.
              </CardDescription>
            </div>
          </CardToolbar>
          <CardContent>
            <GanttChart
              milestones={w.milestones}
              dependencies={w.dependencies}
              phases={w.phases}
              today={today}
            />
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardToolbar>
              <div>
                <CardTitle as="h2">Needs attention</CardTitle>
                <CardDescription>
                  Open milestones that are past their planned finish or behind pace
                </CardDescription>
              </div>
            </CardToolbar>
            <CardContent>
              {slipping.length === 0 && behind.length === 0 ? (
                <p className="text-ink-3 text-sm">
                  Nothing is overdue and every open milestone is tracking to plan.
                </p>
              ) : (
                <ul className="divide-line divide-y">
                  {[...new Set([...slipping.map((s) => s.milestone), ...behind])]
                    .slice(0, 6)
                    .map((milestone) => {
                      const task = schedule.tasks.get(milestone.id);
                      const slip = slippageDays(milestone, now);
                      const expected = expectedProgress(milestone, now);

                      return (
                        <li key={milestone.id} className="flex flex-col gap-1.5 py-3 first:pt-0">
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-ink flex items-center gap-1.5 text-[13px] font-medium">
                              {task?.isCritical ? (
                                <Zap
                                  className="text-accent size-3.5 shrink-0"
                                  strokeWidth={2.5}
                                  aria-label="On the critical path"
                                />
                              ) : null}
                              {milestone.name}
                            </span>
                            <StatusBadge kind="work" value={milestone.status} />
                          </div>

                          <p className="text-ink-3 text-[12px]">
                            {slip > 0
                              ? `${slip} day${slip === 1 ? "" : "s"} past its planned finish of ${formatDate(milestone.planned_end, "medium")}.`
                              : `At ${milestone.progress_percent}% against an expected ${expected}% by today.`}
                            {task && !task.isCritical
                              ? ` ${task.totalFloat} day${task.totalFloat === 1 ? "" : "s"} of float absorbs some of this.`
                              : " No float — this pushes the completion date."}
                          </p>
                        </li>
                      );
                    })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardToolbar>
              <div>
                <CardTitle as="h2">Critical path</CardTitle>
                <CardDescription>
                  The chain that determines your completion date, in order
                </CardDescription>
              </div>
            </CardToolbar>
            <CardContent>
              <ol className="flex flex-col gap-2">
                {critical.slice(0, 10).map((milestone, index) => {
                  const phase = w.phases.find((p) => p.id === milestone.phase_id);
                  return (
                    <li key={milestone.id} className="flex items-center gap-2.5">
                      <span
                        aria-hidden="true"
                        className="tabular text-ink-3 w-4 shrink-0 text-right text-[11px]"
                      >
                        {index + 1}
                      </span>
                      <span
                        aria-hidden="true"
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: seriesColour(phase?.colour_slot ?? 1) }}
                      />
                      <span
                        className={cn(
                          "flex-1 truncate text-[13px]",
                          milestone.status === "completed"
                            ? "text-ink-3 line-through"
                            : "text-ink-2",
                        )}
                      >
                        {milestone.name}
                      </span>
                      <span className="tabular text-ink-3 shrink-0 text-[11px]">
                        {formatDate(milestone.planned_end, "short")}
                      </span>
                    </li>
                  );
                })}
              </ol>
              {critical.length > 10 ? (
                <p className="text-ink-3 mt-3 text-[11px]">
                  and {critical.length - 10} more further out.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
