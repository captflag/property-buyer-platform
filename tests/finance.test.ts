import { describe, expect, it } from "vitest";

import {
  contractPosition,
  costPerformanceIndex,
  rollUpBudget,
  summariseDraws,
  summarisePayments,
} from "@/lib/domain/finance";
import type {
  BudgetCategory,
  ChangeOrder,
  CostEntry,
  DrawRequest,
  Payment,
  Project,
} from "@/types/database";

function category(id: string, budgeted: number, sequence = 0): BudgetCategory {
  return {
    id,
    project_id: "p1",
    name: id,
    code: null,
    budgeted_amount: budgeted,
    sequence,
    colour_slot: 1,
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

function cost(categoryId: string, amount: number, kind: CostEntry["kind"]): CostEntry {
  return {
    id: `${categoryId}-${kind}-${amount}`,
    project_id: "p1",
    category_id: categoryId,
    milestone_id: null,
    description: "entry",
    amount,
    kind,
    incurred_on: "2026-02-01",
    vendor: null,
    created_by: null,
    created_at: "2026-02-01T00:00:00.000Z",
  };
}

function payment(
  id: string,
  amount: number,
  status: Payment["status"],
  dueDate: string | null,
): Payment {
  return {
    id,
    project_id: "p1",
    milestone_id: null,
    name: id,
    sequence: 0,
    amount,
    percent_of_contract: null,
    due_date: dueDate,
    status,
    paid_at: status === "paid" ? "2026-02-01T00:00:00.000Z" : null,
    invoice_number: null,
    method: null,
    reference: null,
    notes: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("rollUpBudget", () => {
  it("splits committed from actual spend per category", () => {
    const summary = rollUpBudget(
      [category("a", 1000), category("b", 500, 1)],
      [cost("a", 300, "actual"), cost("a", 200, "committed"), cost("b", 100, "actual")],
    );

    const a = summary.categories.find((c) => c.id === "a")!;
    expect(a.actual).toBe(300);
    expect(a.committed).toBe(200);
    expect(a.remaining).toBe(500);
    expect(a.isOverBudget).toBe(false);

    expect(summary.budgeted).toBe(1500);
    expect(summary.actual).toBe(400);
    expect(summary.committed).toBe(200);
    expect(summary.remaining).toBe(900);
  });

  it("counts committed spend towards going over budget", () => {
    // Actual alone is under; it is the placed orders that break the budget.
    const summary = rollUpBudget(
      [category("a", 1000)],
      [cost("a", 800, "actual"), cost("a", 400, "committed")],
    );

    const a = summary.categories[0]!;
    expect(a.isOverBudget).toBe(true);
    expect(a.remaining).toBe(-200);
    expect(summary.overBudgetCount).toBe(1);
  });

  it("ignores budget-kind entries, which describe the plan rather than spend", () => {
    const summary = rollUpBudget([category("a", 1000)], [cost("a", 900, "budget")]);
    expect(summary.actual).toBe(0);
    expect(summary.committed).toBe(0);
  });

  it("does not divide by zero for a category with no budget", () => {
    const summary = rollUpBudget([category("a", 0)], [cost("a", 100, "actual")]);
    expect(summary.categories[0]!.utilisation).toBe(0);
    expect(Number.isFinite(summary.utilisation)).toBe(true);
  });

  it("drops cost entries with no category rather than mis-attributing them", () => {
    const orphan: CostEntry = { ...cost("a", 500, "actual"), category_id: null };
    const summary = rollUpBudget([category("a", 1000)], [orphan]);
    expect(summary.actual).toBe(0);
  });
});

describe("contractPosition", () => {
  const project = { contract_value: 100_000 } as Project;

  function order(status: ChangeOrder["status"], cost: number, days = 0): ChangeOrder {
    return {
      id: `${status}-${cost}`,
      project_id: "p1",
      number: "CO",
      title: "change",
      description: null,
      cost_delta: cost,
      schedule_delta_days: days,
      status,
      requested_by: null,
      decided_by: null,
      decided_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
  }

  it("counts only approved changes in the revised contract value", () => {
    const position = contractPosition(project, [
      order("approved", 5_000, 3),
      order("proposed", 2_000),
      order("rejected", 9_000),
    ]);

    expect(position.approvedChanges).toBe(5_000);
    expect(position.pendingChanges).toBe(2_000);
    expect(position.revised).toBe(105_000);
    expect(position.scheduleImpactDays).toBe(3);
  });

  it("handles a credit change order", () => {
    const position = contractPosition(project, [order("approved", -1_500)]);
    expect(position.revised).toBe(98_500);
  });
});

describe("summarisePayments", () => {
  const asOf = new Date("2026-03-15T00:00:00.000Z");

  it("separates paid, outstanding and overdue", () => {
    const summary = summarisePayments(
      [
        payment("a", 1000, "paid", "2026-01-01"),
        payment("b", 2000, "invoiced", "2026-03-01"), // past due
        payment("c", 3000, "scheduled", "2026-04-01"),
      ],
      asOf,
    );

    expect(summary.total).toBe(6000);
    expect(summary.paid).toBe(1000);
    expect(summary.outstanding).toBe(5000);
    expect(summary.overdue).toBe(2000);
    expect(summary.overdueCount).toBe(1);
    expect(summary.nextDue?.id).toBe("c");
  });

  it("excludes waived payments from the schedule total", () => {
    const summary = summarisePayments(
      [payment("a", 1000, "paid", "2026-01-01"), payment("b", 500, "waived", "2026-02-01")],
      asOf,
    );
    expect(summary.total).toBe(1000);
    expect(summary.percentPaid).toBe(100);
  });

  it("does not treat a paid invoice with a past date as overdue", () => {
    const summary = summarisePayments([payment("a", 1000, "paid", "2026-01-01")], asOf);
    expect(summary.overdueCount).toBe(0);
  });

  it("returns a null next payment when everything is settled", () => {
    const summary = summarisePayments([payment("a", 1000, "paid", "2026-01-01")], asOf);
    expect(summary.nextDue).toBeNull();
  });

  it("picks the earliest upcoming payment, not the first in the array", () => {
    const summary = summarisePayments(
      [
        payment("late", 1000, "scheduled", "2026-06-01"),
        payment("soon", 2000, "scheduled", "2026-03-20"),
      ],
      asOf,
    );
    expect(summary.nextDue?.id).toBe("soon");
  });
});

describe("summariseDraws", () => {
  function draw(id: string, amount: number, status: DrawRequest["status"]): DrawRequest {
    return {
      id,
      project_id: "p1",
      milestone_id: null,
      payment_id: null,
      reference: id,
      amount,
      status,
      justification: null,
      requested_by: null,
      submitted_at: null,
      decided_at: null,
      decided_by: null,
      decision_note: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
  }

  it("buckets draws by status and counts those awaiting a decision", () => {
    const pipeline = summariseDraws([
      draw("a", 100, "draft"),
      draw("b", 200, "submitted"),
      draw("c", 300, "under_review"),
      draw("d", 400, "approved"),
      draw("e", 500, "paid"),
    ]);

    expect(pipeline.draft).toBe(100);
    expect(pipeline.awaitingDecision).toBe(500);
    expect(pipeline.awaitingCount).toBe(2);
    expect(pipeline.paid).toBe(500);
  });
});

describe("costPerformanceIndex", () => {
  it("is above 1 when the work done cost less than budgeted for it", () => {
    // 50% of a 1000 budget is 500 of value, delivered for 400.
    expect(costPerformanceIndex(50, 1000, 400)).toBeCloseTo(1.25);
  });

  it("is null rather than infinite when nothing has been spent", () => {
    expect(costPerformanceIndex(50, 1000, 0)).toBeNull();
  });
});
