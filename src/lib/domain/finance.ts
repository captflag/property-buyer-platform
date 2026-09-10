/**
 * Financial rollups.
 *
 * All arithmetic here is in whole currency units held as `number`. That is safe
 * for the magnitudes a single residential build reaches (well under 2^53 cents)
 * but it is *not* safe to extend this to portfolio-wide aggregation without
 * moving to integer minor units -- noted here because it is exactly the kind of
 * thing that silently breaks later.
 */

import { sumBy } from "@/lib/utils";
import type {
  BudgetCategory,
  ChangeOrder,
  CostEntry,
  DrawRequest,
  Payment,
  Project,
} from "@/types/database";

export interface CategoryRollup {
  id: string;
  name: string;
  colourSlot: number;
  budgeted: number;
  committed: number;
  actual: number;
  /** budgeted - (committed + actual). Negative means over budget. */
  remaining: number;
  /** Share of budget consumed, 0-100+, uncapped so overruns stay visible. */
  utilisation: number;
  isOverBudget: boolean;
}

export interface BudgetSummary {
  categories: CategoryRollup[];
  budgeted: number;
  committed: number;
  actual: number;
  remaining: number;
  utilisation: number;
  overBudgetCount: number;
}

export function rollUpBudget(
  categories: readonly BudgetCategory[],
  costs: readonly CostEntry[],
): BudgetSummary {
  const byCategory = new Map<string, { committed: number; actual: number }>();
  for (const cost of costs) {
    if (!cost.category_id) continue;
    const bucket = byCategory.get(cost.category_id) ?? { committed: 0, actual: 0 };
    if (cost.kind === "committed") bucket.committed += cost.amount;
    else if (cost.kind === "actual") bucket.actual += cost.amount;
    byCategory.set(cost.category_id, bucket);
  }

  const rollups: CategoryRollup[] = categories
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .map((category) => {
      const spend = byCategory.get(category.id) ?? { committed: 0, actual: 0 };
      const consumed = spend.committed + spend.actual;
      const remaining = category.budgeted_amount - consumed;
      return {
        id: category.id,
        name: category.name,
        colourSlot: category.colour_slot,
        budgeted: category.budgeted_amount,
        committed: spend.committed,
        actual: spend.actual,
        remaining,
        utilisation: category.budgeted_amount > 0 ? (consumed / category.budgeted_amount) * 100 : 0,
        isOverBudget: remaining < 0,
      };
    });

  const budgeted = sumBy(rollups, (r) => r.budgeted);
  const committed = sumBy(rollups, (r) => r.committed);
  const actual = sumBy(rollups, (r) => r.actual);

  return {
    categories: rollups,
    budgeted,
    committed,
    actual,
    remaining: budgeted - (committed + actual),
    utilisation: budgeted > 0 ? ((committed + actual) / budgeted) * 100 : 0,
    overBudgetCount: rollups.filter((r) => r.isOverBudget).length,
  };
}

export interface ContractPosition {
  original: number;
  approvedChanges: number;
  pendingChanges: number;
  revised: number;
  scheduleImpactDays: number;
}

/**
 * The contract value a buyer actually owes: the original plus approved change
 * orders. Proposed-but-undecided changes are reported separately so the buyer
 * can see what is hanging over them without it being presented as committed.
 */
export function contractPosition(
  project: Project,
  changeOrders: readonly ChangeOrder[],
): ContractPosition {
  const approved = changeOrders.filter((c) => c.status === "approved");
  const pending = changeOrders.filter((c) => c.status === "proposed");

  const approvedChanges = sumBy(approved, (c) => c.cost_delta);

  return {
    original: project.contract_value,
    approvedChanges,
    pendingChanges: sumBy(pending, (c) => c.cost_delta),
    revised: project.contract_value + approvedChanges,
    scheduleImpactDays: sumBy(approved, (c) => c.schedule_delta_days),
  };
}

export interface PaymentSummary {
  total: number;
  paid: number;
  outstanding: number;
  overdue: number;
  overdueCount: number;
  nextDue: Payment | null;
  percentPaid: number;
}

export function summarisePayments(payments: readonly Payment[], asOf: Date): PaymentSummary {
  const today = asOf.toISOString().slice(0, 10);
  const billable = payments.filter((p) => p.status !== "waived");

  const paid = sumBy(
    billable.filter((p) => p.status === "paid"),
    (p) => p.amount,
  );
  const overdueRows = billable.filter(
    (p) => p.status !== "paid" && p.due_date !== null && p.due_date < today,
  );

  const upcoming = billable
    .filter((p) => p.status !== "paid" && p.due_date !== null && p.due_date >= today)
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));

  const total = sumBy(billable, (p) => p.amount);

  return {
    total,
    paid,
    outstanding: total - paid,
    overdue: sumBy(overdueRows, (p) => p.amount),
    overdueCount: overdueRows.length,
    nextDue: upcoming[0] ?? null,
    percentPaid: total > 0 ? (paid / total) * 100 : 0,
  };
}

export interface DrawPipeline {
  draft: number;
  awaitingDecision: number;
  approved: number;
  rejected: number;
  paid: number;
  awaitingCount: number;
}

export function summariseDraws(draws: readonly DrawRequest[]): DrawPipeline {
  const totalWhere = (...statuses: DrawRequest["status"][]) =>
    sumBy(
      draws.filter((d) => statuses.includes(d.status)),
      (d) => d.amount,
    );

  return {
    draft: totalWhere("draft"),
    awaitingDecision: totalWhere("submitted", "under_review"),
    approved: totalWhere("approved"),
    rejected: totalWhere("rejected"),
    paid: totalWhere("paid"),
    awaitingCount: draws.filter((d) => d.status === "submitted" || d.status === "under_review")
      .length,
  };
}

/**
 * Cost Performance Index: value earned per unit spent.
 *
 * CPI > 1 means the work completed so far cost less than budgeted for it.
 * Returns null when nothing has been spent, because the ratio is undefined
 * rather than infinitely good.
 */
export function costPerformanceIndex(
  progressPercent: number,
  budgetTotal: number,
  actualSpend: number,
): number | null {
  if (actualSpend <= 0) return null;
  const earnedValue = (progressPercent / 100) * budgetTotal;
  return earnedValue / actualSpend;
}
