"use client";

import { Zap } from "lucide-react";
import * as React from "react";

import { ChartFrame } from "@/components/charts/chart-frame";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/overlay";
import { addDays, daysBetween, formatDate, parseDate, toDateString } from "@/lib/format";
import { computeSchedule, type ScheduledTask } from "@/lib/domain/schedule";
import { useElementWidth, useMediaQuery } from "@/lib/hooks";
import { seriesColour } from "@/lib/palette";
import { cn, clamp } from "@/lib/utils";
import type { Milestone, MilestoneDependency, Phase } from "@/types/database";

/**
 * Gantt chart with critical path, dependency links and a planned-vs-actual
 * baseline.
 *
 * Layout is HTML rather than SVG on purpose: task names need to wrap, be
 * selectable and stay in the tab order, and the bars need to be real focusable
 * elements so the whole schedule is reachable by keyboard.
 *
 * The dependency arrows are the one part that must be SVG, and they are drawn
 * in *pixels* from a measured container rather than percentages -- a
 * percentage-based viewBox scales non-uniformly and turns every stroke into a
 * wedge. Until the container reports a width, the arrow layer renders nothing
 * rather than guessing.
 *
 * Criticality is signalled three ways -- a bolt icon, the word "Critical" in
 * the tooltip, and a heavier bar treatment -- because it is the most important
 * read on this chart and has to survive colourblindness, greyscale printing and
 * forced-colours mode.
 */

const ROW_H = 26;
const PHASE_H = 30;
const LABEL_W = 180;
const LABEL_W_COMPACT = 116;

type Zoom = "project" | "quarter" | "month";

const ZOOMS: Array<{ value: Zoom; label: string; days: number | null }> = [
  { value: "project", label: "Whole build", days: null },
  { value: "quarter", label: "3 months", days: 90 },
  { value: "month", label: "1 month", days: 30 },
];

interface Row {
  kind: "phase" | "task";
  key: string;
  y: number;
  phase: Phase | null;
  milestone?: Milestone;
  task?: ScheduledTask;
}

export function GanttChart({
  milestones,
  dependencies,
  phases,
  today,
  className,
}: {
  milestones: Milestone[];
  dependencies: MilestoneDependency[];
  phases: Phase[];
  today: string;
  className?: string;
}) {
  const [zoom, setZoom] = React.useState<Zoom>("project");
  const [showLinks, setShowLinks] = React.useState(true);
  const compact = useMediaQuery("(max-width: 640px)");
  const { ref: trackRef, width: trackWidth } = useElementWidth<HTMLDivElement>();

  const schedule = React.useMemo(
    () => computeSchedule(milestones, dependencies),
    [milestones, dependencies],
  );

  // ---- Plotted window ------------------------------------------------------
  const { windowStart, windowEnd, totalDays } = React.useMemo(() => {
    if (milestones.length === 0) {
      return { windowStart: today, windowEnd: addDays(today, 30), totalDays: 30 };
    }

    const span = ZOOMS.find((z) => z.value === zoom)?.days ?? null;
    if (span) {
      // Centre the window on today, which is what someone zooming in wants to
      // look at. Clamped to the project so the view never runs off into empty
      // calendar.
      const projectStart = milestones.map((m) => m.planned_start).reduce((a, b) => (a < b ? a : b));
      const projectEnd = milestones.map((m) => m.planned_end).reduce((a, b) => (a > b ? a : b));
      let start = addDays(today, -Math.round(span / 3));
      if (start < projectStart) start = projectStart;
      let end = addDays(start, span);
      if (end > projectEnd) {
        end = projectEnd;
        start = addDays(end, -span) < projectStart ? projectStart : addDays(end, -span);
      }
      return {
        windowStart: start,
        windowEnd: end,
        totalDays: Math.max(1, daysBetween(start, end)),
      };
    }

    const start = addDays(
      milestones.map((m) => m.planned_start).reduce((a, b) => (a < b ? a : b)),
      -4,
    );
    const end = addDays(
      milestones.map((m) => m.planned_end).reduce((a, b) => (a > b ? a : b)),
      4,
    );
    return { windowStart: start, windowEnd: end, totalDays: Math.max(1, daysBetween(start, end)) };
  }, [milestones, today, zoom]);

  const pct = React.useCallback(
    (date: string) => clamp((daysBetween(windowStart, date) / totalDays) * 100, 0, 100),
    [windowStart, totalDays],
  );

  // ---- Row layout ----------------------------------------------------------
  const { rows, contentHeight, taskRows } = React.useMemo(() => {
    const out: Row[] = [];
    let y = 0;

    const phaseList = phases.length > 0 ? phases : [null];

    for (const phase of phaseList) {
      const inPhase = milestones.filter((m) => (phase ? m.phase_id === phase.id : !m.phase_id));
      if (inPhase.length === 0) continue;

      out.push({ kind: "phase", key: `phase-${phase?.id ?? "none"}`, y, phase });
      y += PHASE_H;

      for (const milestone of inPhase) {
        const task = schedule.tasks.get(milestone.id);
        if (!task) continue;
        out.push({ kind: "task", key: milestone.id, y, phase, milestone, task });
        y += ROW_H;
      }
    }

    const byId = new Map(
      out.filter((r) => r.kind === "task").map((r) => [r.milestone!.id, r] as const),
    );
    return { rows: out, contentHeight: y, taskRows: byId };
  }, [phases, milestones, schedule]);

  // ---- Dependency arrows ---------------------------------------------------
  const arrows = React.useMemo(() => {
    if (!showLinks || trackWidth === 0) return [];

    const toPx = (date: string) => (pct(date) / 100) * trackWidth;

    return dependencies.flatMap((dep) => {
      const from = taskRows.get(dep.predecessor_id);
      const to = taskRows.get(dep.successor_id);
      if (!from || !to) return [];

      // Only finish-to-start links are drawn. The others describe overlaps
      // rather than handovers, and an elbow between two overlapping bars is
      // more confusing than no line at all.
      if (dep.type !== "FS") return [];

      const x1 = toPx(from.milestone!.planned_end);
      const y1 = from.y + ROW_H / 2;
      const x2 = toPx(to.milestone!.planned_start);
      const y2 = to.y + ROW_H / 2;

      // Skip links that would be shorter than the arrowhead.
      if (Math.abs(x2 - x1) < 2 && Math.abs(y2 - y1) < 2) return [];

      const critical = from.task!.isCritical && to.task!.isCritical;
      return [{ id: `${dep.predecessor_id}-${dep.successor_id}`, x1, y1, x2, y2, critical }];
    });
  }, [dependencies, taskRows, pct, trackWidth, showLinks]);

  const todayPct = pct(today);
  const todayVisible = today >= windowStart && today <= windowEnd;
  const months = useMonthTicks(windowStart, windowEnd);
  const labelWidth = compact ? LABEL_W_COMPACT : LABEL_W;
  const criticalCount = schedule.criticalPath.length;

  return (
    <ChartFrame
      description={`Project schedule with ${milestones.length} milestones across ${phases.length} phases. ${criticalCount} sit on the critical path, meaning any delay to them moves the completion date.`}
      className={className}
      table={<GanttTable rows={rows} today={today} />}
      action={
        <div className="flex items-center gap-1">
          {ZOOMS.map((option) => (
            <Button
              key={option.value}
              variant={zoom === option.value ? "subtle" : "ghost"}
              size="sm"
              onClick={() => setZoom(option.value)}
              aria-pressed={zoom === option.value}
              className="text-[11px]"
            >
              {option.label}
            </Button>
          ))}
          <Button
            variant={showLinks ? "subtle" : "ghost"}
            size="sm"
            onClick={() => setShowLinks((v) => !v)}
            aria-pressed={showLinks}
            className="text-[11px]"
          >
            Links
          </Button>
        </div>
      }
    >
      <div className="scrollbar-thin overflow-x-auto">
        <div style={{ minWidth: compact ? 560 : 720 }}>
          {/* Month scale */}
          <div
            className="border-line-strong relative mb-1 h-6 border-b"
            style={{ marginLeft: labelWidth }}
          >
            {months.map((m) => (
              <span
                key={m.date}
                className="ui-label text-ink-3 absolute top-0 text-[9px]"
                style={{ left: `${pct(m.date)}%` }}
              >
                {m.label}
              </span>
            ))}
          </div>

          <div className="relative" style={{ height: contentHeight }}>
            {/* Gridlines + today, behind everything */}
            <div
              className="pointer-events-none absolute inset-y-0 right-0"
              style={{ left: labelWidth }}
            >
              {months.map((m) => (
                <span
                  key={m.date}
                  className="bg-grid absolute inset-y-0 w-px"
                  style={{ left: `${pct(m.date)}%` }}
                />
              ))}
              {todayVisible ? (
                <span
                  className="bg-critical absolute inset-y-0 w-px"
                  style={{ left: `${todayPct}%` }}
                >
                  <span className="bg-critical absolute -top-1 -left-[3px] size-[7px] rounded-full" />
                </span>
              ) : null}
            </div>

            {/* Dependency arrows, over the gridlines but under the bars */}
            <div
              ref={trackRef}
              className="pointer-events-none absolute inset-y-0 right-0"
              style={{ left: labelWidth }}
            >
              {arrows.length > 0 ? (
                <svg
                  width={trackWidth}
                  height={contentHeight}
                  className="absolute inset-0 overflow-visible"
                  aria-hidden="true"
                >
                  <defs>
                    <marker
                      id="gantt-arrow"
                      viewBox="0 0 6 6"
                      refX="5"
                      refY="3"
                      markerWidth="5"
                      markerHeight="5"
                      orient="auto"
                    >
                      <path d="M0 0 L6 3 L0 6 z" fill="var(--ink-3)" />
                    </marker>
                    <marker
                      id="gantt-arrow-critical"
                      viewBox="0 0 6 6"
                      refX="5"
                      refY="3"
                      markerWidth="5"
                      markerHeight="5"
                      orient="auto"
                    >
                      <path d="M0 0 L6 3 L0 6 z" fill="var(--accent)" />
                    </marker>
                  </defs>

                  {arrows.map((arrow) => (
                    <path
                      key={arrow.id}
                      d={elbow(arrow.x1, arrow.y1, arrow.x2, arrow.y2)}
                      fill="none"
                      stroke={arrow.critical ? "var(--accent)" : "var(--ink-3)"}
                      strokeWidth={arrow.critical ? 1.4 : 1}
                      strokeOpacity={arrow.critical ? 0.9 : 0.45}
                      markerEnd={`url(#${arrow.critical ? "gantt-arrow-critical" : "gantt-arrow"})`}
                    />
                  ))}
                </svg>
              ) : null}
            </div>

            {/* Rows */}
            {rows.map((row) =>
              row.kind === "phase" ? (
                <div
                  key={row.key}
                  className="absolute inset-x-0 flex items-center gap-2"
                  style={{ top: row.y, height: PHASE_H }}
                >
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0"
                    style={{ backgroundColor: seriesColour(row.phase?.colour_slot ?? 1) }}
                  />
                  <h4 className="ui-label text-ink text-[10px]">
                    {row.phase?.name ?? "Unassigned"}
                  </h4>
                </div>
              ) : (
                <GanttRow
                  key={row.key}
                  row={row}
                  labelWidth={labelWidth}
                  colour={seriesColour(row.phase?.colour_slot ?? 1)}
                  pct={pct}
                  today={today}
                />
              ),
            )}
          </div>

          <Legend />
        </div>
      </div>
    </ChartFrame>
  );
}

/** Elbow connector: out of the predecessor, across, into the successor. */
function elbow(x1: number, y1: number, x2: number, y2: number): string {
  const stub = 8;
  // Where the successor starts before the predecessor ends, route around
  // rather than drawing a line that doubles back through both bars.
  if (x2 >= x1 + stub * 2) {
    const mid = x1 + stub;
    return `M${x1},${y1} H${mid} V${y2} H${x2 - 2}`;
  }
  const drop = y2 > y1 ? ROW_H / 2 + 3 : -(ROW_H / 2 + 3);
  return `M${x1},${y1} H${x1 + stub} V${y1 + drop} H${x2 - stub} V${y2} H${x2 - 2}`;
}

function GanttRow({
  row,
  labelWidth,
  colour,
  pct,
  today,
}: {
  row: Row;
  labelWidth: number;
  colour: string;
  pct: (date: string) => number;
  today: string;
}) {
  const milestone = row.milestone!;
  const task = row.task!;

  const left = pct(milestone.planned_start);
  const width = Math.max(0.6, pct(milestone.planned_end) - left);

  const isOverdue =
    milestone.status !== "completed" &&
    milestone.status !== "cancelled" &&
    milestone.planned_end < today;

  // A baseline bar is only meaningful once there are real dates to compare
  // against, and only worth drawing when they actually differ from plan.
  const hasBaseline =
    milestone.actual_start !== null &&
    milestone.actual_end !== null &&
    (milestone.actual_start !== milestone.planned_start ||
      milestone.actual_end !== milestone.planned_end);

  const actualLeft = hasBaseline ? pct(milestone.actual_start!) : 0;
  const actualWidth = hasBaseline ? Math.max(0.6, pct(milestone.actual_end!) - actualLeft) : 0;
  const slipped = hasBaseline && milestone.actual_end! > milestone.planned_end;

  return (
    <div
      className="group absolute inset-x-0 flex items-center"
      style={{ top: row.y, height: ROW_H }}
    >
      <div className="flex shrink-0 items-center gap-1.5 pr-3" style={{ width: labelWidth }}>
        {task.isCritical ? (
          <Zap
            className="text-accent size-3 shrink-0"
            strokeWidth={2.5}
            aria-label="On the critical path"
          />
        ) : (
          <span className="size-3 shrink-0" aria-hidden="true" />
        )}
        <span className="text-ink-2 group-hover:text-ink truncate text-[12px] transition-colors">
          {milestone.name}
        </span>
      </div>

      <div className="relative h-full flex-1">
        <Hint
          content={
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold">{milestone.name}</span>
              <span>
                Planned {formatDate(milestone.planned_start, "short")} –{" "}
                {formatDate(milestone.planned_end, "short")} · {task.duration} days
              </span>
              {hasBaseline ? (
                <span>
                  Actual {formatDate(milestone.actual_start, "short")} –{" "}
                  {formatDate(milestone.actual_end, "short")}
                  {slipped
                    ? ` · ${daysBetween(milestone.planned_end, milestone.actual_end!)} days late`
                    : " · on or ahead of plan"}
                </span>
              ) : null}
              <span>{milestone.progress_percent}% complete</span>
              <span>
                {task.isCritical
                  ? "Critical — no float"
                  : `${task.totalFloat} day${task.totalFloat === 1 ? "" : "s"} of float`}
              </span>
              {isOverdue ? <span>Past its planned finish</span> : null}
            </div>
          }
        >
          <button
            type="button"
            className={cn(
              "absolute top-1/2 -translate-y-1/2 text-left",
              hasBaseline ? "-mt-1.5 h-2.5" : "h-4",
              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-1",
              "transition-[filter] duration-150 hover:brightness-110",
              task.isCritical && "ring-accent/70 ring-1",
            )}
            style={{
              left: `${left}%`,
              width: `${width}%`,
              backgroundColor: `color-mix(in oklab, ${colour} 22%, transparent)`,
            }}
          >
            <span
              className="chart-mark absolute inset-y-0 left-0"
              style={{
                width: `${clamp(milestone.progress_percent, 0, 100)}%`,
                backgroundColor: colour,
              }}
            />
            {isOverdue ? (
              <span
                aria-hidden="true"
                className="bg-critical absolute -top-0.5 -right-0.5 size-1.5 rounded-full"
              />
            ) : null}
            <span className="sr-only">
              {milestone.name}: {milestone.progress_percent}% complete,
              {task.isCritical ? " on the critical path," : ` ${task.totalFloat} days of float,`}
              planned {formatDate(milestone.planned_start)} to {formatDate(milestone.planned_end)}
              {hasBaseline
                ? `, actually ran ${formatDate(milestone.actual_start)} to ${formatDate(milestone.actual_end)}`
                : ""}
            </span>
          </button>
        </Hint>

        {/* Baseline: what actually happened, beneath what was planned. */}
        {hasBaseline ? (
          <span
            aria-hidden="true"
            className="absolute top-1/2 mt-1 h-1.5"
            style={{
              left: `${actualLeft}%`,
              width: `${actualWidth}%`,
              backgroundColor: slipped ? "var(--critical)" : "var(--good)",
              opacity: 0.75,
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="text-ink-3 mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
      <span className="flex items-center gap-1.5">
        <Zap className="text-accent size-3" strokeWidth={2.5} aria-hidden="true" />
        On the critical path
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="bg-critical h-3 w-px" />
        Today
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="border-line-strong h-2.5 w-4 border" />
        Planned window
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="bg-good h-1.5 w-4" />
        Actual, on plan
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="bg-critical h-1.5 w-4" />
        Actual, late
      </span>
    </div>
  );
}

/** Month boundaries inside the plotted window. */
function useMonthTicks(start: string, end: string) {
  return React.useMemo(() => {
    const ticks: Array<{ date: string; label: string }> = [];
    const cursor = parseDate(start);
    cursor.setUTCDate(1);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);

    const limit = parseDate(end);
    while (cursor <= limit) {
      const date = toDateString(cursor);
      ticks.push({
        date,
        label: new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(cursor),
      });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return ticks;
  }, [start, end]);
}

function GanttTable({ rows, today }: { rows: Row[]; today: string }) {
  return (
    <table className="w-full text-[13px]">
      <caption className="sr-only">
        Milestone schedule with planned dates, actual dates, progress and float
      </caption>
      <thead className="text-ink-3 border-line-strong sticky top-0 border-b text-left">
        <tr className="bg-surface">
          <th scope="col" className="ui-label py-2 pr-3 text-[10px]">
            Milestone
          </th>
          <th scope="col" className="ui-label py-2 pr-3 text-[10px]">
            Planned
          </th>
          <th scope="col" className="ui-label py-2 pr-3 text-[10px]">
            Actual
          </th>
          <th scope="col" className="ui-label py-2 pr-3 text-right text-[10px]">
            Progress
          </th>
          <th scope="col" className="ui-label py-2 text-right text-[10px]">
            Float
          </th>
        </tr>
      </thead>
      <tbody className="divide-line divide-y">
        {rows.map((row) =>
          row.kind === "phase" ? (
            <tr key={row.key} className="bg-surface-2">
              <th
                scope="colgroup"
                colSpan={5}
                className="ui-label text-ink py-1.5 text-left text-[10px]"
              >
                {row.phase?.name ?? "Unassigned"}
              </th>
            </tr>
          ) : (
            <tr key={row.key}>
              <td className="py-1.5 pr-3">
                {row.milestone!.name}
                {row.task!.isCritical ? (
                  <span className="text-accent-subtle-ink ml-1.5 text-[11px] font-medium">
                    Critical
                  </span>
                ) : null}
              </td>
              <td className="text-ink-2 tabular py-1.5 pr-3">
                {formatDate(row.milestone!.planned_start, "short")} –{" "}
                <span
                  className={cn(
                    row.milestone!.status !== "completed" && row.milestone!.planned_end < today
                      ? "text-critical-ink font-medium"
                      : undefined,
                  )}
                >
                  {formatDate(row.milestone!.planned_end, "short")}
                </span>
              </td>
              <td className="text-ink-2 tabular py-1.5 pr-3">
                {row.milestone!.actual_start
                  ? `${formatDate(row.milestone!.actual_start, "short")} – ${
                      row.milestone!.actual_end
                        ? formatDate(row.milestone!.actual_end, "short")
                        : "ongoing"
                    }`
                  : "—"}
              </td>
              <td className="tabular py-1.5 pr-3 text-right">{row.milestone!.progress_percent}%</td>
              <td className="tabular text-ink-2 py-1.5 text-right">
                {row.task!.isCritical ? "—" : `${row.task!.totalFloat}d`}
              </td>
            </tr>
          ),
        )}
      </tbody>
    </table>
  );
}
