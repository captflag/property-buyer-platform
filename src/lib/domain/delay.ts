/**
 * Proactive delay explanation.
 *
 * When the projected completion date moves past the contract date, the buyer
 * should learn *why* from the platform, before they notice the number and have
 * to ask. Everything here is drawn from records the platform already holds:
 * the weather log, approved change orders, blocked and overdue work on the
 * critical path, and decisions that are holding work up.
 *
 * The caveat is part of the output, not a footnote: the forecast is a trend
 * line, so these factors explain the slip rather than account for it to the
 * day. Presenting them as if they summed exactly would be false precision.
 */

import { daysBetween } from "@/lib/format";
import type { CompletionForecast } from "@/lib/domain/forecast";
import type { ScheduleResult } from "@/lib/domain/schedule";
import { slippageDays } from "@/lib/domain/schedule";
import type { SelectionView } from "@/lib/domain/selections";
import type { ChangeOrder, Issue, Milestone, Project, WeatherLogEntry } from "@/types/database";

export type DelayReasonKind =
  "weather" | "change_order" | "blocked" | "overdue" | "issue" | "selection";

export interface DelayReason {
  kind: DelayReasonKind;
  label: string;
  detail: string;
  /** Days attributable, where the records support a number. */
  days: number | null;
  href: string;
  /** True when the factor sits on the critical path and so moves completion. */
  critical: boolean;
}

export interface DelayExplanation {
  isSlipping: boolean;
  slipDays: number | null;
  targetDate: string | null;
  forecastDate: string | null;
  headline: string;
  reasons: DelayReason[];
  caveat: string;
}

/** A few days either way is regression noise, not a delay worth announcing. */
export const SLIP_THRESHOLD_DAYS = 3;

export function explainDelay(input: {
  project: Pick<Project, "target_completion_date" | "start_date" | "name">;
  forecast: CompletionForecast;
  schedule: ScheduleResult;
  milestones: readonly Milestone[];
  weather: readonly WeatherLogEntry[];
  changeOrders: readonly ChangeOrder[];
  issues: readonly Issue[];
  selections: readonly SelectionView[];
  asOf: Date;
  slug: string;
}): DelayExplanation {
  const base = `/projects/${input.slug}`;
  const targetDate = input.project.target_completion_date;
  const forecastDate = input.forecast.projectedDate;
  const slipDays = input.forecast.slipDays;
  const isSlipping = slipDays !== null && slipDays > SLIP_THRESHOLD_DAYS;

  const caveat =
    "These are the factors on record. The forecast is a trend through recent progress, so they explain the slip rather than add up to it exactly.";

  if (!isSlipping || slipDays === null) {
    return {
      isSlipping: false,
      slipDays,
      targetDate,
      forecastDate,
      headline:
        slipDays !== null && slipDays < -SLIP_THRESHOLD_DAYS
          ? `The build is tracking ${Math.abs(slipDays)} days ahead of the contract date.`
          : "The build is tracking to the contract completion date.",
      reasons: [],
      caveat,
    };
  }

  const reasons: DelayReason[] = [];
  const isCritical = (id: string | null) =>
    id !== null && (input.schedule.tasks.get(id)?.isCritical ?? false);

  // ---- Weather -----------------------------------------------------------
  const start = input.project.start_date ?? "0000-01-01";
  const weatherDays = input.weather
    .filter((w) => w.observed_on >= start && w.work_impact !== "none")
    .reduce((total, w) => total + (w.work_impact === "full" ? 1 : 0.5), 0);
  if (weatherDays >= 1) {
    reasons.push({
      kind: "weather",
      label: "Weather",
      detail: `${formatDays(weatherDays)} of outside work lost to weather, from the site log.`,
      days: Math.round(weatherDays),
      href: `${base}/analytics`,
      critical: true,
    });
  }

  // ---- Approved change orders that extended the programme ---------------
  for (const order of input.changeOrders) {
    if (order.status === "approved" && order.schedule_delta_days > 0) {
      reasons.push({
        kind: "change_order",
        label: `${order.number}: ${order.title}`,
        detail: `An approved change that added ${formatDays(order.schedule_delta_days)} to the programme.`,
        days: order.schedule_delta_days,
        href: `${base}/finance`,
        critical: true,
      });
    }
  }

  // ---- Blocked work ------------------------------------------------------
  const explained = new Set<string>();
  for (const milestone of input.milestones) {
    if (milestone.status !== "blocked") continue;
    explained.add(milestone.id);
    const critical = isCritical(milestone.id);
    const linkedIssue = input.issues.find(
      (i) =>
        i.milestone_id === milestone.id &&
        (i.status === "open" || i.status === "acknowledged" || i.status === "in_progress"),
    );
    reasons.push({
      kind: "blocked",
      label: `${milestone.name} is blocked`,
      detail:
        (linkedIssue ? `${linkedIssue.title}. ` : "") +
        (critical
          ? "It is on the critical path, so the delay passes straight to the completion date."
          : "It has some float, which absorbs part of the delay."),
      days: null,
      href: `${base}/timeline`,
      critical,
    });
    if (linkedIssue) explained.add(linkedIssue.id);
  }

  // ---- Overdue critical work ----------------------------------------------
  for (const milestone of input.milestones) {
    if (explained.has(milestone.id) || !isCritical(milestone.id)) continue;
    const slip = slippageDays(milestone, input.asOf);
    if (slip <= 0 || milestone.status === "completed") continue;
    reasons.push({
      kind: "overdue",
      label: `${milestone.name} is running late`,
      detail: `${formatDays(slip)} past its planned finish, on the critical path.`,
      days: slip,
      href: `${base}/timeline`,
      critical: true,
    });
  }

  // ---- Serious issues on critical work -----------------------------------
  for (const issue of input.issues) {
    if (explained.has(issue.id)) continue;
    const open =
      issue.status === "open" || issue.status === "acknowledged" || issue.status === "in_progress";
    if (!open || (issue.severity !== "high" && issue.severity !== "critical")) continue;
    if (!isCritical(issue.milestone_id)) continue;
    reasons.push({
      kind: "issue",
      label: issue.title,
      detail: `A ${issue.severity}-severity issue on critical-path work.`,
      days: null,
      href: `${base}/quality`,
      critical: true,
    });
  }

  // ---- Decisions that are holding work up --------------------------------
  for (const view of input.selections) {
    if (view.urgency !== "overdue" || !view.milestone) continue;
    reasons.push({
      kind: "selection",
      label: `${view.category.name} not yet chosen`,
      detail: `The decision deadline passed ${formatDays(Math.abs(view.daysLeft ?? 0))} ago and ${view.milestone.name.toLowerCase()} needs it.`,
      days: null,
      href: `${base}/selections#${view.category.id}`,
      critical: isCritical(view.milestone.id),
    });
  }

  // Critical-path factors first, then the largest attributable, then the rest.
  reasons.sort((a, b) => Number(b.critical) - Number(a.critical) || (b.days ?? 0) - (a.days ?? 0));

  const lead = reasons[0];
  const headline =
    `Forecast completion is ${slipDays} days after the contract date of ${targetDate}.` +
    (lead
      ? ` The biggest factor on record: ${lead.label.charAt(0).toLowerCase()}${lead.label.slice(1)}.`
      : "");

  return { isSlipping, slipDays, targetDate, forecastDate, headline, reasons, caveat };
}

function formatDays(days: number): string {
  const rounded = Math.round(days * 2) / 2;
  const text = rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
  return `${text} day${rounded === 1 ? "" : "s"}`;
}

/** Whole days from the contract date to the forecast. Exposed for display. */
export function slipBetween(target: string | null, forecast: string | null): number | null {
  if (!target || !forecast) return null;
  return daysBetween(target, forecast);
}
