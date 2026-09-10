/**
 * Critical Path Method scheduling.
 *
 * Given milestones and their dependencies, this computes early/late start and
 * finish for every task, the total float, and which tasks are critical. It is
 * the single implementation of CPM in the codebase: the `milestones.is_critical`
 * column is written from this result rather than being recomputed in SQL, so
 * there is one algorithm to test and one place for it to be wrong.
 *
 * Units are whole calendar days measured from the project's earliest planned
 * start. Construction schedules often reckon in working days; that is a
 * calendar concern, and the `Calendar` parameter is where it would be injected
 * without touching the traversal below.
 *
 * Duration is inclusive of both endpoints: a task planned 1 Mar - 1 Mar takes
 * one day, not zero.
 */

import { daysBetween, parseDate, toDateString } from "@/lib/format";
import type { DependencyType, Milestone, MilestoneDependency } from "@/types/database";

export interface ScheduledTask {
  id: string;
  name: string;
  phaseId: string | null;
  /** Day index from the schedule origin, inclusive. */
  earlyStart: number;
  earlyFinish: number;
  lateStart: number;
  lateFinish: number;
  /** Days this task can slip without moving the project end date. */
  totalFloat: number;
  /** Days it can slip without moving any successor's early start. */
  freeFloat: number;
  duration: number;
  isCritical: boolean;
  /** As-planned dates, echoed back for convenience. */
  plannedStart: string;
  plannedEnd: string;
  progressPercent: number;
  status: Milestone["status"];
}

export interface ScheduleResult {
  /** `YYYY-MM-DD` of day index 0. */
  origin: string;
  tasks: Map<string, ScheduledTask>;
  ordered: ScheduledTask[];
  /** Ids along the longest zero-float chain, in execution order. */
  criticalPath: string[];
  /** Total project duration in days. */
  projectDuration: number;
  projectFinish: string;
  /** Dependency edges that had to be dropped to break a cycle. */
  brokenEdges: MilestoneDependency[];
}

/** Inclusive duration in days between two `YYYY-MM-DD` strings. */
export function durationOf(start: string, end: string): number {
  return Math.max(1, daysBetween(start, end) + 1);
}

/**
 * Topologically order task ids. Any edge that would close a cycle is reported
 * rather than thrown: a user-editable dependency graph will sometimes contain
 * a loop, and a Gantt chart that renders with one edge dropped is far more
 * useful than a page that refuses to render at all.
 */
function topologicalOrder(
  ids: string[],
  edges: MilestoneDependency[],
): { order: string[]; broken: MilestoneDependency[] } {
  const indegree = new Map<string, number>(ids.map((id) => [id, 0]));
  const outgoing = new Map<string, MilestoneDependency[]>(ids.map((id) => [id, []]));

  const usable: MilestoneDependency[] = [];
  for (const edge of edges) {
    if (!indegree.has(edge.predecessor_id) || !indegree.has(edge.successor_id)) continue;
    usable.push(edge);
    outgoing.get(edge.predecessor_id)!.push(edge);
    indegree.set(edge.successor_id, indegree.get(edge.successor_id)! + 1);
  }

  const queue = ids.filter((id) => indegree.get(id) === 0);
  const order: string[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const edge of outgoing.get(id) ?? []) {
      const next = indegree.get(edge.successor_id)! - 1;
      indegree.set(edge.successor_id, next);
      if (next === 0) queue.push(edge.successor_id);
    }
  }

  if (order.length === ids.length) return { order, broken: [] };

  // Whatever is left sits in (or downstream of) a cycle. Append the stragglers
  // in their given order and report the edges among them as broken.
  const placed = new Set(order);
  const stranded = ids.filter((id) => !placed.has(id));
  const broken = usable.filter((e) => !placed.has(e.predecessor_id) && !placed.has(e.successor_id));
  return { order: [...order, ...stranded], broken };
}

/** Early-pass constraint: the earliest a successor may start / finish. */
function forwardConstraint(
  type: DependencyType,
  predecessor: ScheduledTask,
  lag: number,
  successorDuration: number,
): { start: number } {
  switch (type) {
    case "FS":
      return { start: predecessor.earlyFinish + 1 + lag };
    case "SS":
      return { start: predecessor.earlyStart + lag };
    case "FF":
      // successor finishes no earlier than predecessor's finish + lag
      return { start: predecessor.earlyFinish + lag - successorDuration + 1 };
    case "SF":
      return { start: predecessor.earlyStart + lag - successorDuration + 1 };
  }
}

/** Late-pass constraint: the latest a predecessor may start / finish. */
function backwardConstraint(
  type: DependencyType,
  successor: ScheduledTask,
  lag: number,
  predecessorDuration: number,
): { finish: number } {
  switch (type) {
    case "FS":
      return { finish: successor.lateStart - 1 - lag };
    case "SS":
      return { finish: successor.lateStart - lag + predecessorDuration - 1 };
    case "FF":
      return { finish: successor.lateFinish - lag };
    case "SF":
      return { finish: successor.lateFinish - lag + predecessorDuration - 1 };
  }
}

export function computeSchedule(
  milestones: readonly Milestone[],
  dependencies: readonly MilestoneDependency[],
): ScheduleResult {
  if (milestones.length === 0) {
    return {
      origin: toDateString(new Date()),
      tasks: new Map(),
      ordered: [],
      criticalPath: [],
      projectDuration: 0,
      projectFinish: toDateString(new Date()),
      brokenEdges: [],
    };
  }

  const origin = milestones
    .map((m) => m.planned_start)
    .reduce((earliest, d) => (d < earliest ? d : earliest));

  const tasks = new Map<string, ScheduledTask>();
  for (const m of milestones) {
    const duration = durationOf(m.planned_start, m.planned_end);
    const earlyStart = daysBetween(origin, m.planned_start);
    tasks.set(m.id, {
      id: m.id,
      name: m.name,
      phaseId: m.phase_id,
      earlyStart,
      earlyFinish: earlyStart + duration - 1,
      lateStart: 0,
      lateFinish: 0,
      totalFloat: 0,
      freeFloat: 0,
      duration,
      isCritical: false,
      plannedStart: m.planned_start,
      plannedEnd: m.planned_end,
      progressPercent: m.progress_percent,
      status: m.status,
    });
  }

  const ids = milestones.map((m) => m.id);
  const edges = dependencies.filter(
    (d) => tasks.has(d.predecessor_id) && tasks.has(d.successor_id),
  );
  const { order, broken } = topologicalOrder(ids, edges);
  const live = edges.filter((e) => !broken.includes(e));

  const incoming = new Map<string, MilestoneDependency[]>(ids.map((id) => [id, []]));
  const outgoing = new Map<string, MilestoneDependency[]>(ids.map((id) => [id, []]));
  for (const edge of live) {
    incoming.get(edge.successor_id)!.push(edge);
    outgoing.get(edge.predecessor_id)!.push(edge);
  }

  // ---- Forward pass: earliest each task can start, honouring predecessors ----
  for (const id of order) {
    const task = tasks.get(id)!;
    let earliest = task.earlyStart; // its own planned start is a floor
    for (const edge of incoming.get(id)!) {
      const pred = tasks.get(edge.predecessor_id)!;
      const { start } = forwardConstraint(edge.type, pred, edge.lag_days, task.duration);
      if (start > earliest) earliest = start;
    }
    task.earlyStart = earliest;
    task.earlyFinish = earliest + task.duration - 1;
  }

  const projectFinishDay = Math.max(...[...tasks.values()].map((t) => t.earlyFinish));

  // ---- Backward pass: latest each task can finish without moving the end ----
  for (let i = order.length - 1; i >= 0; i -= 1) {
    const task = tasks.get(order[i]!)!;
    const successors = outgoing.get(task.id)!;

    let latestFinish = successors.length === 0 ? projectFinishDay : Number.POSITIVE_INFINITY;
    for (const edge of successors) {
      const succ = tasks.get(edge.successor_id)!;
      const { finish } = backwardConstraint(edge.type, succ, edge.lag_days, task.duration);
      if (finish < latestFinish) latestFinish = finish;
    }

    task.lateFinish = latestFinish;
    task.lateStart = latestFinish - task.duration + 1;
    task.totalFloat = task.lateStart - task.earlyStart;
    task.isCritical = task.totalFloat <= 0;
  }

  // ---- Free float: slack before the *nearest successor* is disturbed ----
  for (const task of tasks.values()) {
    const successors = outgoing.get(task.id)!;
    if (successors.length === 0) {
      task.freeFloat = projectFinishDay - task.earlyFinish;
      continue;
    }
    let slack = Number.POSITIVE_INFINITY;
    for (const edge of successors) {
      const succ = tasks.get(edge.successor_id)!;
      const gap =
        edge.type === "SS" || edge.type === "SF"
          ? succ.earlyStart - task.earlyStart - edge.lag_days
          : succ.earlyStart - task.earlyFinish - 1 - edge.lag_days;
      if (gap < slack) slack = gap;
    }
    task.freeFloat = Math.max(0, slack);
  }

  const ordered = order.map((id) => tasks.get(id)!);
  const criticalPath = ordered.filter((t) => t.isCritical).map((t) => t.id);

  return {
    origin,
    tasks,
    ordered,
    criticalPath,
    projectDuration: projectFinishDay + 1,
    projectFinish: dayToDate(origin, projectFinishDay),
    brokenEdges: broken,
  };
}

/** Convert a day index back to a `YYYY-MM-DD` date string. */
export function dayToDate(origin: string, day: number): string {
  const date = parseDate(origin);
  date.setUTCDate(date.getUTCDate() + day);
  return toDateString(date);
}

/**
 * How far a milestone has slipped against plan, in days.
 *
 * Positive means late. A finished milestone is judged on its actual finish; an
 * unfinished one is judged against `asOf`, so a task that simply has not
 * started yet still accrues visible slippage once its planned end has passed.
 */
export function slippageDays(milestone: Milestone, asOf: Date): number {
  if (milestone.status === "completed" && milestone.actual_end) {
    return daysBetween(milestone.planned_end, milestone.actual_end);
  }
  if (milestone.status === "cancelled") return 0;
  const today = toDateString(asOf);
  const overdue = daysBetween(milestone.planned_end, today);
  return overdue > 0 ? overdue : 0;
}

/**
 * Where a milestone *should* be today if work tracked its planned window
 * linearly. Compared against actual progress, this is the per-task equivalent
 * of the S-curve's planned line.
 */
export function expectedProgress(milestone: Milestone, asOf: Date): number {
  const today = toDateString(asOf);
  if (today < milestone.planned_start) return 0;
  if (today > milestone.planned_end) return 100;
  const total = durationOf(milestone.planned_start, milestone.planned_end);
  const elapsed = daysBetween(milestone.planned_start, today) + 1;
  return Math.round((elapsed / total) * 100);
}
