import { describe, expect, it } from "vitest";

import { earnedValue, forecastCompletion, scoreHealth } from "@/lib/domain/forecast";
import { addDays } from "@/lib/format";
import type { Issue, ProgressSnapshot, WeatherLogEntry } from "@/types/database";

function snapshots(
  values: Array<{ day: number; planned: number; actual: number }>,
  origin = "2026-01-01",
): ProgressSnapshot[] {
  return values.map(({ day, planned, actual }) => ({
    id: `s${day}`,
    project_id: "p1",
    captured_on: addDays(origin, day),
    planned_percent: planned,
    actual_percent: actual,
    note: null,
    created_at: "2026-01-01T00:00:00.000Z",
  }));
}

describe("earnedValue", () => {
  it("computes SPI, CPI and EAC from the standard definitions", () => {
    // Budget 1000, plan says 50%, actual is 40%, spent 500.
    const evm = earnedValue(1000, 50, 40, 500);

    expect(evm.plannedValue).toBe(500);
    expect(evm.earnedValue).toBe(400);
    expect(evm.schedulePerformanceIndex).toBeCloseTo(0.8);
    expect(evm.costPerformanceIndex).toBeCloseTo(0.8);
    expect(evm.estimateAtCompletion).toBeCloseTo(1250);
    expect(evm.varianceAtCompletion).toBeCloseTo(-250);
  });

  it("returns nulls rather than dividing by zero at the start of a project", () => {
    const evm = earnedValue(1000, 0, 0, 0);
    expect(evm.schedulePerformanceIndex).toBeNull();
    expect(evm.costPerformanceIndex).toBeNull();
    expect(evm.estimateAtCompletion).toBeNull();
    expect(evm.varianceAtCompletion).toBeNull();
  });
});

describe("forecastCompletion", () => {
  // Pinned so the tests do not depend on the wall clock. The forecast floors
  // its projection at `asOf` -- unfinished work cannot have finished in the
  // past -- so a fixed reference date is what makes these assertions stable.
  const ASOF = { asOf: new Date("2026-01-01T00:00:00.000Z") };

  it("declines to project from too few readings", () => {
    const forecast = forecastCompletion(
      snapshots([
        { day: 0, planned: 0, actual: 0 },
        { day: 7, planned: 5, actual: 5 },
      ]),
      "2026-06-01",
    );
    expect(forecast.confidence).toBe("insufficient");
    expect(forecast.projectedDate).toBeNull();
  });

  it("projects a clean linear trend to the day it reaches 100", () => {
    // Exactly 1 point per day from 0: should hit 100 on day 100.
    const readings = Array.from({ length: 30 }, (_, i) => ({
      day: i,
      planned: i,
      actual: i,
    }));

    const forecast = forecastCompletion(snapshots(readings), null, { window: 60, ...ASOF });

    expect(forecast.velocityPerDay).toBeCloseTo(1, 5);
    expect(forecast.rSquared).toBeCloseTo(1, 5);
    expect(forecast.projectedDate).toBe(addDays("2026-01-01", 100));
    expect(forecast.confidence).toBe("high");
  });

  it("reports slip against a target date", () => {
    const readings = Array.from({ length: 30 }, (_, i) => ({ day: i, planned: i, actual: i }));
    // Target is day 90, projection lands on day 100 -> 10 days late.
    const forecast = forecastCompletion(snapshots(readings), addDays("2026-01-01", 90), {
      window: 60,
      ...ASOF,
    });
    expect(forecast.slipDays).toBe(10);
  });

  it("refuses to extrapolate stalled work", () => {
    const readings = Array.from({ length: 20 }, (_, i) => ({ day: i, planned: i, actual: 40 }));
    const forecast = forecastCompletion(snapshots(readings), "2026-06-01");

    expect(forecast.projectedDate).toBeNull();
    expect(forecast.confidence).toBe("insufficient");
  });

  it("lowers confidence when progress is erratic", () => {
    // Same average slope, but noisy -- r-squared should drop out of "high".
    const readings = Array.from({ length: 14 }, (_, i) => ({
      day: i,
      planned: i,
      actual: i + (i % 2 === 0 ? 9 : -9),
    }));
    const forecast = forecastCompletion(snapshots(readings), null, ASOF);

    expect(forecast.rSquared).toBeLessThan(0.9);
    expect(["low", "medium"]).toContain(forecast.confidence);
  });

  it("produces a band that brackets the central projection", () => {
    const readings = Array.from({ length: 20 }, (_, i) => ({
      day: i,
      planned: i,
      actual: i + (i % 3) * 0.6,
    }));
    const forecast = forecastCompletion(snapshots(readings), null, ASOF);

    // ISO dates sort lexicographically, so plain string comparison is a
    // correct chronological test here.
    expect(forecast.earliestDate! < forecast.projectedDate!).toBe(true);
    expect(forecast.latestDate! > forecast.projectedDate!).toBe(true);
  });

  it("never projects a completion date in the past", () => {
    // A slow fit over old readings puts the mathematical crossing behind us.
    // Work that is not finished cannot have finished last spring, so the
    // projection is floored at the reference date.
    const readings = Array.from({ length: 20 }, (_, i) => ({
      day: i,
      planned: i * 5,
      actual: i * 5,
    }));

    const forecast = forecastCompletion(snapshots(readings), null, {
      asOf: new Date("2027-06-01T00:00:00.000Z"),
    });

    expect(forecast.projectedDate).toBe("2027-06-01");
  });

  it("only considers the trailing window, so a recovery is not dragged down by a stall", () => {
    // 30 flat days, then 20 days of real movement.
    const stalled = Array.from({ length: 30 }, (_, i) => ({ day: i, planned: i, actual: 10 }));
    const recovering = Array.from({ length: 20 }, (_, i) => ({
      day: 30 + i,
      planned: 30 + i,
      actual: 10 + i * 2,
    }));

    const windowed = forecastCompletion(snapshots([...stalled, ...recovering]), null, {
      window: 20,
      ...ASOF,
    });

    expect(windowed.velocityPerDay).toBeCloseTo(2, 1);
    expect(windowed.projectedDate).not.toBeNull();
  });
});

describe("scoreHealth", () => {
  const noIssues: Issue[] = [];
  const noWeather: WeatherLogEntry[] = [];

  function issue(severity: Issue["severity"]): Issue {
    return {
      id: `i-${severity}`,
      project_id: "p1",
      milestone_id: null,
      title: "issue",
      description: null,
      location: null,
      severity,
      status: "open",
      reported_by: null,
      assigned_to: null,
      due_date: null,
      resolved_at: null,
      room: null,
      photo_paths: [],
      raised_by_buyer: false,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
  }

  it("scores a clean project at 100 and grades it good", () => {
    const health = scoreHealth({
      scheduleVariance: 0,
      costVariance: 1000,
      budgetTotal: 10_000,
      openIssues: noIssues,
      weather: noWeather,
    });

    expect(health.score).toBe(100);
    expect(health.grade).toBe("good");
  });

  it("deducts for being behind schedule", () => {
    const health = scoreHealth({
      scheduleVariance: -10,
      costVariance: 0,
      budgetTotal: 10_000,
      openIssues: noIssues,
      weather: noWeather,
    });

    // 10 points behind x 2 = 20 points lost.
    expect(health.score).toBe(80);
    expect(health.factors.find((f) => f.label === "Schedule")!.impact).toBe(-20);
  });

  it("weights critical issues far above low ones", () => {
    const withCritical = scoreHealth({
      scheduleVariance: 0,
      costVariance: 0,
      budgetTotal: 10_000,
      openIssues: [issue("critical")],
      weather: noWeather,
    });
    const withLow = scoreHealth({
      scheduleVariance: 0,
      costVariance: 0,
      budgetTotal: 10_000,
      openIssues: [issue("low")],
      weather: noWeather,
    });

    expect(withCritical.score).toBeLessThan(withLow.score);
  });

  it("caps each factor so one bad signal cannot sink the whole score", () => {
    const health = scoreHealth({
      scheduleVariance: -500,
      costVariance: 0,
      budgetTotal: 10_000,
      openIssues: noIssues,
      weather: noWeather,
    });

    // Schedule is capped at 40 points, so 60 survives.
    expect(health.score).toBe(60);
  });

  it("never falls below zero even when everything is wrong", () => {
    const health = scoreHealth({
      scheduleVariance: -500,
      costVariance: -100_000,
      budgetTotal: 10_000,
      openIssues: Array.from({ length: 30 }, () => issue("critical")),
      weather: Array.from({ length: 30 }, (_, i) => ({
        id: `w${i}`,
        project_id: "p1",
        observed_on: addDays(new Date().toISOString().slice(0, 10), -i),
        condition: "Storm",
        temp_c: 5,
        precipitation_mm: 40,
        wind_kph: 60,
        work_impact: "full" as const,
        hours_lost: 8,
        created_at: "2026-01-01T00:00:00.000Z",
      })),
    });

    expect(health.score).toBe(0);
    expect(health.grade).toBe("critical");
  });

  it("always explains itself with one factor per signal", () => {
    const health = scoreHealth({
      scheduleVariance: -3,
      costVariance: 0,
      budgetTotal: 10_000,
      openIssues: noIssues,
      weather: noWeather,
    });

    expect(health.factors.map((f) => f.label)).toEqual(["Schedule", "Cost", "Quality", "Weather"]);
    for (const factor of health.factors) {
      expect(factor.detail.length).toBeGreaterThan(0);
    }
  });
});
