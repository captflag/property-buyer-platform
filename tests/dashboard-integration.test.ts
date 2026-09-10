import { describe, expect, it } from "vitest";

import { buildDemoDataset } from "@/lib/demo/dataset";
import { contractPosition, rollUpBudget, summarisePayments } from "@/lib/domain/finance";
import { earnedValue, forecastCompletion, scoreHealth } from "@/lib/domain/forecast";
import { computeSchedule } from "@/lib/domain/schedule";
import { sumBy } from "@/lib/utils";

/**
 * End-to-end check of the read path.
 *
 * The unit tests above prove each function in isolation. This one runs the
 * exact sequence the dashboard runs -- demo dataset in, every headline figure
 * out -- and asserts the result is a coherent picture of a real project.
 *
 * It is the test that would catch "the pipeline runs but reports 0% complete
 * and a NaN budget", which no isolated unit test can see.
 */

const REFERENCE = new Date("2026-09-09T12:00:00.000Z");

function dashboardFigures() {
  const w = buildDemoDataset(REFERENCE);

  const totalWeight = sumBy(w.milestones, (m) => m.weight);
  const progress = sumBy(w.milestones, (m) => m.progress_percent * m.weight) / totalWeight;

  const latest = w.snapshots[w.snapshots.length - 1]!;
  const planned = latest.planned_percent;

  const schedule = computeSchedule(w.milestones, w.dependencies);
  const budget = rollUpBudget(w.budgetCategories, w.costEntries);
  const contract = contractPosition(w.project, w.changeOrders);
  const payments = summarisePayments(w.payments, REFERENCE);
  const forecast = forecastCompletion(w.snapshots, w.project.target_completion_date, {
    asOf: REFERENCE,
  });

  const openIssues = w.issues.filter(
    (i) => i.status === "open" || i.status === "acknowledged" || i.status === "in_progress",
  );

  const health = scoreHealth({
    scheduleVariance: progress - planned,
    costVariance: budget.remaining,
    budgetTotal: budget.budgeted,
    openIssues,
    weather: w.weather,
    asOf: REFERENCE,
  });

  const evm = earnedValue(budget.budgeted, planned, progress, budget.actual);

  return { w, progress, planned, schedule, budget, contract, payments, forecast, health, evm };
}

describe("dashboard pipeline", () => {
  it("produces finite numbers for every headline figure", () => {
    const f = dashboardFigures();

    const numbers: Record<string, number | null> = {
      progress: f.progress,
      planned: f.planned,
      budgeted: f.budget.budgeted,
      actual: f.budget.actual,
      committed: f.budget.committed,
      remaining: f.budget.remaining,
      utilisation: f.budget.utilisation,
      contractRevised: f.contract.revised,
      paymentsTotal: f.payments.total,
      paymentsPaid: f.payments.paid,
      health: f.health.score,
      spi: f.evm.schedulePerformanceIndex,
      cpi: f.evm.costPerformanceIndex,
      eac: f.evm.estimateAtCompletion,
    };

    for (const [name, value] of Object.entries(numbers)) {
      expect(value, `${name} should be a finite number`).not.toBeNull();
      expect(Number.isFinite(value as number), `${name} = ${value}`).toBe(true);
    }
  });

  it("reports a build that is underway and modestly behind plan", () => {
    const f = dashboardFigures();

    expect(f.progress).toBeGreaterThan(40);
    expect(f.progress).toBeLessThan(85);

    // The seeded narrative is "a few points behind", not "catastrophically
    // behind". A wide gap here means the planned curve has drifted away from
    // the milestone plan again, which is a real bug and not a data preference:
    // it makes the chart contradict the Gantt beside it.
    const variance = f.progress - f.planned;
    expect(variance).toBeLessThan(0);
    expect(variance).toBeGreaterThan(-8);
  });

  it("keeps the last progress reading equal to the milestone rollup", () => {
    const f = dashboardFigures();
    const latest = f.w.snapshots[f.w.snapshots.length - 1]!;

    // If these diverge, the headline number and the chart disagree on the
    // same page.
    expect(latest.actual_percent).toBeCloseTo(f.progress, 1);
  });

  it("finds a critical path that is a genuine subset, not every milestone", () => {
    const f = dashboardFigures();

    expect(f.schedule.criticalPath.length).toBeGreaterThan(0);
    expect(f.schedule.brokenEdges).toHaveLength(0);

    // A chain where everything is critical is the classic symptom of blindly
    // linking every milestone finish-to-start, and it makes the whole feature
    // meaningless. Fewer than half should be critical.
    expect(f.schedule.criticalPath.length).toBeLessThan(f.w.milestones.length / 2);

    for (const id of f.schedule.criticalPath) {
      expect(f.schedule.tasks.get(id)!.totalFloat).toBeLessThanOrEqual(0);
    }
  });

  it("produces a real spread of float across the schedule", () => {
    const f = dashboardFigures();
    const floats = [...f.schedule.tasks.values()].map((t) => t.totalFloat);

    expect(Math.min(...floats)).toBe(0);
    expect(Math.max(...floats)).toBeGreaterThan(10);
  });

  it("keeps every milestone inside the computed project window", () => {
    const f = dashboardFigures();

    for (const task of f.schedule.tasks.values()) {
      expect(task.earlyStart).toBeGreaterThanOrEqual(0);
      expect(task.earlyFinish).toBeLessThan(f.schedule.projectDuration);
      expect(task.duration).toBeGreaterThan(0);
    }
  });

  it("balances the payment schedule against the contract value", () => {
    const f = dashboardFigures();

    // The seven stages are defined as percentages summing to 100.
    const percentages = f.w.payments.reduce((t, p) => t + (p.percent_of_contract ?? 0), 0);
    expect(percentages).toBe(100);
    expect(f.payments.total).toBeCloseTo(f.w.project.contract_value, -1);
    expect(f.payments.paid).toBeLessThan(f.payments.total);
  });

  it("surfaces at least one over-budget category, which the UI has to flag", () => {
    const f = dashboardFigures();
    expect(f.budget.overBudgetCount).toBeGreaterThan(0);
  });

  it("grades health as imperfect but not alarming, and explains every factor", () => {
    const f = dashboardFigures();

    // A build a few points behind with three open issues should read as
    // "watch", not "critical" -- an over-alarming default trains people to
    // ignore the indicator.
    expect(f.health.score).toBeGreaterThan(60);
    expect(f.health.score).toBeLessThan(95);
    expect(f.health.factors).toHaveLength(4);
    for (const factor of f.health.factors) {
      expect(Number.isFinite(factor.impact)).toBe(true);
      expect(factor.detail).not.toBe("");
    }
  });

  it("projects a plausible completion date, slipping but not absurdly", () => {
    const f = dashboardFigures();

    expect(f.forecast.projectedDate).not.toBeNull();
    expect(f.forecast.projectedDate! >= "2026-09-09").toBe(true);
    expect(f.forecast.earliestDate! <= f.forecast.projectedDate!).toBe(true);
    expect(f.forecast.latestDate! >= f.forecast.projectedDate!).toBe(true);

    // Behind plan, so the forecast should land after the contract date -- but
    // by weeks, not years. A wild number here means the curve and the target
    // have come apart.
    expect(f.forecast.slipDays).toBeGreaterThan(0);
    expect(f.forecast.slipDays).toBeLessThan(120);
  });

  it("gives every update an author and every media item a parent update", () => {
    const f = dashboardFigures();

    const profileIds = new Set(f.w.profiles.map((p) => p.id));
    const updateIds = new Set(f.w.updates.map((u) => u.id));

    for (const update of f.w.updates) {
      expect(profileIds.has(update.author_id)).toBe(true);
    }
    for (const media of f.w.media) {
      expect(updateIds.has(media.update_id)).toBe(true);
    }
  });

  it("keeps every milestone attached to a real phase", () => {
    const f = dashboardFigures();
    const phaseIds = new Set(f.w.phases.map((p) => p.id));

    for (const milestone of f.w.milestones) {
      expect(milestone.phase_id).not.toBeNull();
      expect(phaseIds.has(milestone.phase_id!)).toBe(true);
    }
  });

  it("only uses palette slots that exist", () => {
    const f = dashboardFigures();

    for (const phase of f.w.phases) {
      expect(phase.colour_slot).toBeGreaterThanOrEqual(1);
      expect(phase.colour_slot).toBeLessThanOrEqual(8);
    }
    for (const category of f.w.budgetCategories) {
      expect(category.colour_slot).toBeGreaterThanOrEqual(1);
      expect(category.colour_slot).toBeLessThanOrEqual(8);
    }
  });
});
