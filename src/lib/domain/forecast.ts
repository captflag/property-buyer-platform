/**
 * Schedule intelligence: earned value, completion forecasting, health scoring.
 *
 * The forecast is a least-squares fit over recent progress snapshots. That is a
 * deliberately modest model, and the UI says so: it extrapolates the recent
 * rate of work and nothing else. It does not know about a crew leaving next
 * week or a permit that is about to clear. Presenting it with a confidence
 * band, and labelling it a projection rather than a date, is the honest way to
 * show it -- a single confident-looking date would be a lie.
 */

import { addDays, daysBetween, toDateString } from "@/lib/format";
import { clamp } from "@/lib/utils";
import type { Issue, ProgressSnapshot, WeatherLogEntry } from "@/types/database";

export interface EarnedValue {
  /** Planned Value: budget for the work scheduled by now. */
  plannedValue: number;
  /** Earned Value: budget for the work actually done. */
  earnedValue: number;
  /** Actual Cost of the work done. */
  actualCost: number;
  /** EV/PV. Below 1 means behind schedule. */
  schedulePerformanceIndex: number | null;
  /** EV/AC. Below 1 means over cost. */
  costPerformanceIndex: number | null;
  /** Estimate At Completion, using the current cost performance. */
  estimateAtCompletion: number | null;
  /** Budget At Completion minus EAC. Negative means a projected overrun. */
  varianceAtCompletion: number | null;
}

export function earnedValue(
  budgetAtCompletion: number,
  plannedPercent: number,
  actualPercent: number,
  actualCost: number,
): EarnedValue {
  const pv = (plannedPercent / 100) * budgetAtCompletion;
  const ev = (actualPercent / 100) * budgetAtCompletion;

  const spi = pv > 0 ? ev / pv : null;
  const cpi = actualCost > 0 ? ev / actualCost : null;
  const eac = cpi && cpi > 0 ? budgetAtCompletion / cpi : null;

  return {
    plannedValue: pv,
    earnedValue: ev,
    actualCost,
    schedulePerformanceIndex: spi,
    costPerformanceIndex: cpi,
    estimateAtCompletion: eac,
    varianceAtCompletion: eac === null ? null : budgetAtCompletion - eac,
  };
}

export interface CompletionForecast {
  /** Central projection. Null when there is not enough history to fit a line. */
  projectedDate: string | null;
  /** Optimistic / pessimistic bounds from the fit's residual spread. */
  earliestDate: string | null;
  latestDate: string | null;
  /** Percentage points of progress per day, from the fit. */
  velocityPerDay: number;
  /** Days later than the target date. Negative means early. */
  slipDays: number | null;
  /** How well the line fits, 0-1. Low r² means treat the date with suspicion. */
  rSquared: number;
  /** Snapshots the fit was built from. */
  sampleSize: number;
  confidence: "high" | "medium" | "low" | "insufficient";
}

/**
 * Project a completion date by fitting actual progress against time.
 *
 * Only the trailing `window` snapshots are used: a build that was stalled for
 * a month and has since recovered should be judged on the recovery, not on the
 * average of the two.
 */
export function forecastCompletion(
  snapshots: readonly ProgressSnapshot[],
  targetDate: string | null,
  options: { window?: number; asOf?: Date } = {},
): CompletionForecast {
  const { window = 45, asOf = new Date() } = options;

  const ordered = snapshots
    .slice()
    .sort((a, b) => (a.captured_on < b.captured_on ? -1 : 1))
    .slice(-window);

  const empty: CompletionForecast = {
    projectedDate: null,
    earliestDate: null,
    latestDate: null,
    velocityPerDay: 0,
    slipDays: null,
    rSquared: 0,
    sampleSize: ordered.length,
    confidence: "insufficient",
  };

  if (ordered.length < 4) return empty;

  const origin = ordered[0]!.captured_on;
  const points = ordered.map((s) => ({
    x: daysBetween(origin, s.captured_on),
    y: s.actual_percent,
  }));

  const n = points.length;
  const meanX = points.reduce((t, p) => t + p.x, 0) / n;
  const meanY = points.reduce((t, p) => t + p.y, 0) / n;

  let sxx = 0;
  let sxy = 0;
  for (const p of points) {
    sxx += (p.x - meanX) ** 2;
    sxy += (p.x - meanX) * (p.y - meanY);
  }

  // A flat or single-day span gives no slope to work with.
  if (sxx === 0) return empty;

  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;

  // Work that has stopped cannot be extrapolated to a finish date.
  if (slope <= 0.001) {
    return { ...empty, velocityPerDay: slope, confidence: "insufficient" };
  }

  let ssRes = 0;
  let ssTot = 0;
  for (const p of points) {
    const predicted = intercept + slope * p.x;
    ssRes += (p.y - predicted) ** 2;
    ssTot += (p.y - meanY) ** 2;
  }
  const rSquared = ssTot === 0 ? 1 : clamp(1 - ssRes / ssTot, 0, 1);
  const residualSd = Math.sqrt(ssRes / Math.max(1, n - 2));

  const dayReaching100 = (100 - intercept) / slope;
  // A fit through noisy readings can put the crossing behind us. Work that is
  // not finished cannot have finished yesterday, so the projection is floored
  // at today.
  const rawProjection = addDays(origin, Math.ceil(dayReaching100));
  const today = toDateString(asOf);
  const projectedDate = rawProjection < today ? today : rawProjection;

  // Turn the residual spread into a date band: how many days of work does one
  // standard deviation of progress error represent?
  const bandDays = Math.max(1, Math.round((residualSd * 1.96) / slope));

  const confidence: CompletionForecast["confidence"] =
    n >= 20 && rSquared >= 0.9 ? "high" : n >= 10 && rSquared >= 0.75 ? "medium" : "low";

  const latestActual = ordered[ordered.length - 1]!;
  const alreadyDone = latestActual.actual_percent >= 100;

  return {
    projectedDate: alreadyDone ? latestActual.captured_on : projectedDate,
    earliestDate: addDays(projectedDate, -bandDays),
    latestDate: addDays(projectedDate, bandDays),
    velocityPerDay: slope,
    slipDays: targetDate ? daysBetween(targetDate, projectedDate) : null,
    rSquared,
    sampleSize: n,
    confidence,
  };
}

export type HealthGrade = "good" | "warning" | "serious" | "critical";

export interface HealthScore {
  /** 0-100, higher is healthier. */
  score: number;
  grade: HealthGrade;
  factors: HealthFactor[];
}

export interface HealthFactor {
  label: string;
  /** Points contributed, signed. */
  impact: number;
  detail: string;
}

/**
 * A single project health number, assembled from four signals so the UI can
 * always explain the score rather than asserting it. The weights are stated
 * here rather than buried: schedule 40, cost 30, quality 20, weather 10.
 */
export function scoreHealth(input: {
  scheduleVariance: number;
  costVariance: number;
  budgetTotal: number;
  openIssues: readonly Issue[];
  weather: readonly WeatherLogEntry[];
  asOf?: Date;
}): HealthScore {
  const factors: HealthFactor[] = [];

  // Schedule: 40 points, lost at 2 points per point of negative variance.
  const scheduleLoss = clamp(Math.max(0, -input.scheduleVariance) * 2, 0, 40);
  factors.push({
    label: "Schedule",
    impact: -scheduleLoss,
    detail:
      input.scheduleVariance >= 0
        ? `Ahead of plan by ${input.scheduleVariance.toFixed(1)} points`
        : `Behind plan by ${Math.abs(input.scheduleVariance).toFixed(1)} points`,
  });

  // Cost: 30 points, lost in proportion to the overrun against total budget.
  const overrunRatio =
    input.budgetTotal > 0 ? Math.max(0, -input.costVariance) / input.budgetTotal : 0;
  const costLoss = clamp(overrunRatio * 150, 0, 30);
  factors.push({
    label: "Cost",
    impact: -costLoss,
    detail:
      input.costVariance >= 0
        ? "Within budget"
        : `Over budget by ${(overrunRatio * 100).toFixed(1)}%`,
  });

  // Quality: 20 points, weighted by issue severity.
  const severityWeight = { critical: 8, high: 4, medium: 2, low: 1 } as const;
  const issueLoad = input.openIssues.reduce(
    (total, issue) => total + severityWeight[issue.severity],
    0,
  );
  const qualityLoss = clamp(issueLoad * 1.5, 0, 20);
  factors.push({
    label: "Quality",
    impact: -qualityLoss,
    detail:
      input.openIssues.length === 0
        ? "No open issues"
        : `${input.openIssues.length} open issue${input.openIssues.length === 1 ? "" : "s"}`,
  });

  // Weather: 10 points, from days lost in the last 30.
  const asOf = input.asOf ?? new Date();
  const cutoff = addDays(toDateString(asOf), -30);
  const recentLost = input.weather
    .filter((w) => w.observed_on >= cutoff && w.work_impact !== "none")
    .reduce((total, w) => total + (w.work_impact === "full" ? 1 : 0.5), 0);
  const weatherLoss = clamp(recentLost * 1.2, 0, 10);
  factors.push({
    label: "Weather",
    impact: -weatherLoss,
    detail:
      recentLost === 0
        ? "No weather disruption in 30 days"
        : `${recentLost} day${recentLost === 1 ? "" : "s"} lost in 30 days`,
  });

  const score = Math.round(
    clamp(100 - scheduleLoss - costLoss - qualityLoss - weatherLoss, 0, 100),
  );

  const grade: HealthGrade =
    score >= 85 ? "good" : score >= 70 ? "warning" : score >= 50 ? "serious" : "critical";

  return { score, grade, factors };
}

/** Days of work lost to weather, bucketed by condition, for the weather widget. */
export function weatherImpactBreakdown(
  entries: readonly WeatherLogEntry[],
): Array<{ condition: string; days: number; hoursLost: number }> {
  const buckets = new Map<string, { days: number; hoursLost: number }>();
  for (const entry of entries) {
    if (entry.work_impact === "none") continue;
    const bucket = buckets.get(entry.condition) ?? { days: 0, hoursLost: 0 };
    bucket.days += entry.work_impact === "full" ? 1 : 0.5;
    bucket.hoursLost += entry.hours_lost;
    buckets.set(entry.condition, bucket);
  }
  return [...buckets.entries()]
    .map(([condition, v]) => ({ condition, ...v }))
    .sort((a, b) => b.hoursLost - a.hoursLost);
}
