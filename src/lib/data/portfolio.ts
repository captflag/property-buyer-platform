import "server-only";

import { cache } from "react";

import { projectSource, requestNow } from "@/lib/data/workspace";
import { rollUpBudget, summarisePayments } from "@/lib/domain/finance";
import { daysBetween } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { sumBy } from "@/lib/utils";
import type { ProjectRole, ProjectStatus } from "@/types/database";

/**
 * Every site the viewer can see, with the figures a builder scans first.
 *
 * One call to `portfolio_health()` in the database rather than a workspace
 * per project: a builder with forty sites needs forty rows of rollups, not
 * forty projects' worth of tables.
 */

export interface PortfolioSite {
  projectId: string;
  name: string;
  slug: string;
  city: string | null;
  currency: string;
  status: ProjectStatus;
  role: ProjectRole | null;
  targetCompletionDate: string | null;
  progress: number;
  planned: number;
  /** Actual minus planned, in points: negative is behind. */
  scheduleVariance: number;
  budgetTotal: number;
  /** Budget minus spent and committed: negative is over. */
  costVariance: number;
  openIssues: number;
  criticalIssues: number;
  overduePayments: number;
  daysRemaining: number | null;
}

interface PortfolioRow {
  project_id: string;
  name: string;
  slug: string;
  city: string | null;
  currency: string | null;
  status: ProjectStatus;
  role: ProjectRole | null;
  target_completion_date: string | null;
  progress_percent: number | string | null;
  planned_percent: number | string | null;
  schedule_variance: number | string | null;
  budget_total: number | string | null;
  cost_variance: number | string | null;
  open_issues: number | null;
  critical_issues: number | null;
  overdue_payments: number | null;
  days_remaining: number | null;
}

const num = (value: number | string | null | undefined) => Number(value ?? 0);

/** Sites needing attention first: critical issues, then overdue money, then the furthest behind. */
export function byAttention(a: PortfolioSite, b: PortfolioSite): number {
  return (
    b.criticalIssues - a.criticalIssues ||
    b.overduePayments - a.overduePayments ||
    a.scheduleVariance - b.scheduleVariance
  );
}

export const getPortfolio = cache(async (): Promise<PortfolioSite[]> => {
  const source = await projectSource();

  if (source.kind === "demo") {
    const w = source.data;
    const now = new Date(requestNow());
    const totalWeight = sumBy(w.milestones, (m) => m.weight);
    const progress =
      totalWeight > 0 ? sumBy(w.milestones, (m) => m.progress_percent * m.weight) / totalWeight : 0;
    const planned = w.snapshots[w.snapshots.length - 1]?.planned_percent ?? 0;
    const budget = rollUpBudget(w.budgetCategories, w.costEntries);
    const open = w.issues.filter(
      (i) => i.status === "open" || i.status === "acknowledged" || i.status === "in_progress",
    );
    return [
      {
        projectId: w.project.id,
        name: w.project.name,
        slug: w.project.slug,
        city: w.project.city,
        currency: w.project.currency,
        status: w.project.status,
        role: "builder",
        targetCompletionDate: w.project.target_completion_date,
        progress,
        planned,
        scheduleVariance: progress - planned,
        budgetTotal: budget.budgeted,
        costVariance: budget.remaining,
        openIssues: open.length,
        criticalIssues: open.filter((i) => i.severity === "critical").length,
        overduePayments: summarisePayments(w.payments, now).overdueCount,
        daysRemaining: w.project.target_completion_date
          ? daysBetween(requestNow().slice(0, 10), w.project.target_completion_date)
          : null,
      },
    ];
  }

  const supabase = await createClient();
  if (source.kind === "empty" || !supabase) return [];

  const { data } = await supabase.rpc("portfolio_health");
  return ((data ?? []) as PortfolioRow[])
    .map((row) => ({
      projectId: row.project_id,
      name: row.name,
      slug: row.slug,
      city: row.city,
      currency: row.currency ?? "GBP",
      status: row.status,
      role: row.role,
      targetCompletionDate: row.target_completion_date,
      progress: num(row.progress_percent),
      planned: num(row.planned_percent),
      scheduleVariance: num(row.schedule_variance),
      budgetTotal: num(row.budget_total),
      costVariance: num(row.cost_variance),
      openIssues: row.open_issues ?? 0,
      criticalIssues: row.critical_issues ?? 0,
      overduePayments: row.overdue_payments ?? 0,
      daysRemaining: row.days_remaining,
    }))
    .sort(byAttention);
});
