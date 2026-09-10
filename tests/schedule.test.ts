import { describe, expect, it } from "vitest";

import { computeSchedule, durationOf, expectedProgress, slippageDays } from "@/lib/domain/schedule";
import type { Milestone, MilestoneDependency } from "@/types/database";

/**
 * CPM is the piece of this codebase most worth testing: it is pure, it is easy
 * to get subtly wrong, and the whole timeline page and half the dashboard are
 * downstream of it. The cases below are hand-computed rather than snapshotted,
 * so a regression shows up as a wrong number rather than an updated fixture.
 */

function milestone(
  id: string,
  start: string,
  end: string,
  overrides: Partial<Milestone> = {},
): Milestone {
  return {
    id,
    project_id: "p1",
    phase_id: null,
    name: id,
    description: null,
    sequence: 1,
    weight: 1,
    planned_start: start,
    planned_end: end,
    actual_start: null,
    actual_end: null,
    progress_percent: 0,
    status: "not_started",
    is_critical: false,
    payment_percent: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function link(
  predecessor: string,
  successor: string,
  type: MilestoneDependency["type"] = "FS",
  lag = 0,
): MilestoneDependency {
  return { predecessor_id: predecessor, successor_id: successor, type, lag_days: lag };
}

describe("durationOf", () => {
  it("counts both endpoints, so a single-day task is one day", () => {
    expect(durationOf("2026-03-01", "2026-03-01")).toBe(1);
  });

  it("counts calendar days inclusively", () => {
    expect(durationOf("2026-03-01", "2026-03-10")).toBe(10);
  });

  it("never returns zero or negative for inverted input", () => {
    expect(durationOf("2026-03-10", "2026-03-01")).toBe(1);
  });
});

describe("computeSchedule", () => {
  it("returns an empty result for no milestones rather than throwing", () => {
    const result = computeSchedule([], []);
    expect(result.ordered).toHaveLength(0);
    expect(result.criticalPath).toHaveLength(0);
    expect(result.projectDuration).toBe(0);
  });

  it("puts a simple finish-to-start chain entirely on the critical path", () => {
    const milestones = [
      milestone("a", "2026-01-01", "2026-01-10"),
      milestone("b", "2026-01-11", "2026-01-20"),
      milestone("c", "2026-01-21", "2026-01-30"),
    ];
    const result = computeSchedule(milestones, [link("a", "b"), link("b", "c")]);

    expect(result.criticalPath).toEqual(["a", "b", "c"]);
    for (const task of result.tasks.values()) {
      expect(task.totalFloat).toBe(0);
    }
    // 3 x 10 days, back to back.
    expect(result.projectDuration).toBe(30);
  });

  it("gives float to a task on a shorter parallel branch", () => {
    // a -> b -> d  (long branch: 10 + 20 days)
    // a -> c -> d  (short branch: 10 + 5 days, so c has 15 days of float)
    const milestones = [
      milestone("a", "2026-01-01", "2026-01-10"),
      milestone("b", "2026-01-11", "2026-01-30"),
      milestone("c", "2026-01-11", "2026-01-15"),
      milestone("d", "2026-01-31", "2026-02-09"),
    ];
    const result = computeSchedule(milestones, [
      link("a", "b"),
      link("a", "c"),
      link("b", "d"),
      link("c", "d"),
    ]);

    expect(result.tasks.get("a")!.totalFloat).toBe(0);
    expect(result.tasks.get("b")!.totalFloat).toBe(0);
    expect(result.tasks.get("d")!.totalFloat).toBe(0);
    expect(result.tasks.get("c")!.totalFloat).toBe(15);
    expect(result.tasks.get("c")!.isCritical).toBe(false);
    expect(result.criticalPath).toEqual(["a", "b", "d"]);
  });

  it("pushes a successor out when a predecessor's finish demands it", () => {
    // b is planned to start immediately, but a does not finish until day 20.
    const milestones = [
      milestone("a", "2026-01-01", "2026-01-20"),
      milestone("b", "2026-01-01", "2026-01-05"),
    ];
    const result = computeSchedule(milestones, [link("a", "b")]);

    // a occupies days 0..19, so b cannot start before day 20.
    expect(result.tasks.get("b")!.earlyStart).toBe(20);
    expect(result.tasks.get("b")!.earlyFinish).toBe(24);
  });

  it("honours finish-to-start lag", () => {
    const milestones = [
      milestone("a", "2026-01-01", "2026-01-10"),
      milestone("b", "2026-01-11", "2026-01-20"),
    ];
    const result = computeSchedule(milestones, [link("a", "b", "FS", 5)]);

    // a finishes on day index 9; +1 to start the next day, +5 lag = day 15.
    expect(result.tasks.get("b")!.earlyStart).toBe(15);
  });

  it("lets a start-to-start link overlap two tasks", () => {
    const milestones = [
      milestone("a", "2026-01-01", "2026-01-20"),
      milestone("b", "2026-01-01", "2026-01-15"),
    ];
    const result = computeSchedule(milestones, [link("a", "b", "SS", 5)]);

    // b starts 5 days after a starts, not after a finishes.
    expect(result.tasks.get("b")!.earlyStart).toBe(5);
  });

  it("aligns finishes under a finish-to-finish link", () => {
    const milestones = [
      milestone("a", "2026-01-01", "2026-01-20"),
      milestone("b", "2026-01-01", "2026-01-10"),
    ];
    const result = computeSchedule(milestones, [link("a", "b", "FF", 0)]);

    // b must finish no earlier than a: both end on day index 19.
    expect(result.tasks.get("b")!.earlyFinish).toBe(19);
    expect(result.tasks.get("a")!.earlyFinish).toBe(19);
  });

  it("drops the offending edges instead of hanging on a cycle", () => {
    const milestones = [
      milestone("a", "2026-01-01", "2026-01-10"),
      milestone("b", "2026-01-11", "2026-01-20"),
    ];
    const result = computeSchedule(milestones, [link("a", "b"), link("b", "a")]);

    // Every task still appears, and the cycle is reported rather than thrown.
    expect(result.ordered).toHaveLength(2);
    expect(result.brokenEdges.length).toBeGreaterThan(0);
  });

  it("ignores dependencies that reference unknown milestones", () => {
    const milestones = [milestone("a", "2026-01-01", "2026-01-10")];
    const result = computeSchedule(milestones, [link("a", "ghost"), link("ghost", "a")]);

    expect(result.ordered).toHaveLength(1);
    expect(result.tasks.get("a")!.isCritical).toBe(true);
  });

  it("reports free float against the nearest successor, not the project end", () => {
    // c can slip 15 days before d moves, but only because d is the constraint.
    const milestones = [
      milestone("a", "2026-01-01", "2026-01-10"),
      milestone("b", "2026-01-11", "2026-01-30"),
      milestone("c", "2026-01-11", "2026-01-15"),
      milestone("d", "2026-01-31", "2026-02-09"),
    ];
    const result = computeSchedule(milestones, [
      link("a", "b"),
      link("a", "c"),
      link("b", "d"),
      link("c", "d"),
    ]);

    expect(result.tasks.get("c")!.freeFloat).toBe(15);
    expect(result.tasks.get("b")!.freeFloat).toBe(0);
  });
});

describe("slippageDays", () => {
  const asOf = new Date("2026-03-20T12:00:00.000Z");

  it("is zero for work finished on time", () => {
    const m = milestone("a", "2026-03-01", "2026-03-10", {
      status: "completed",
      actual_end: "2026-03-10",
    });
    expect(slippageDays(m, asOf)).toBe(0);
  });

  it("measures a completed milestone against its actual finish", () => {
    const m = milestone("a", "2026-03-01", "2026-03-10", {
      status: "completed",
      actual_end: "2026-03-14",
    });
    expect(slippageDays(m, asOf)).toBe(4);
  });

  it("accrues against today for work that is still open", () => {
    const m = milestone("a", "2026-03-01", "2026-03-10", { status: "in_progress" });
    expect(slippageDays(m, asOf)).toBe(10);
  });

  it("does not report negative slippage for work finishing early", () => {
    const m = milestone("a", "2026-03-01", "2026-03-30", { status: "in_progress" });
    expect(slippageDays(m, asOf)).toBe(0);
  });

  it("ignores cancelled work", () => {
    const m = milestone("a", "2026-01-01", "2026-01-10", { status: "cancelled" });
    expect(slippageDays(m, asOf)).toBe(0);
  });
});

describe("expectedProgress", () => {
  const m = milestone("a", "2026-03-01", "2026-03-10");

  it("is zero before the planned start", () => {
    expect(expectedProgress(m, new Date("2026-02-20T00:00:00.000Z"))).toBe(0);
  });

  it("is 100 after the planned end", () => {
    expect(expectedProgress(m, new Date("2026-03-20T00:00:00.000Z"))).toBe(100);
  });

  it("interpolates linearly across the window", () => {
    // Day 5 of a 10-day window (inclusive of both ends) is 50%.
    expect(expectedProgress(m, new Date("2026-03-05T00:00:00.000Z"))).toBe(50);
  });
});
