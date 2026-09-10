import { describe, expect, it } from "vitest";

import {
  deriveDeadline,
  formatPriceDelta,
  summariseSelections,
  urgencyFor,
  viewSelections,
} from "@/lib/domain/selections";
import type { Milestone, SelectionCategory, SelectionOption } from "@/types/database";

const ASOF = new Date("2026-09-10T12:00:00.000Z");

function milestone(id: string, start: string, end: string): Milestone {
  return {
    id,
    project_id: "p1",
    phase_id: null,
    name: id === "kitchen" ? "Kitchen fit" : id,
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
  };
}

function category(id: string, overrides: Partial<SelectionCategory> = {}): SelectionCategory {
  return {
    id,
    project_id: "p1",
    milestone_id: "kitchen",
    name: id,
    room: "Kitchen",
    description: null,
    sequence: 1,
    decision_deadline: null,
    buffer_days: 7,
    status: "open",
    chosen_option_id: null,
    chosen_by: null,
    chosen_at: null,
    notes: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function option(
  id: string,
  categoryId: string,
  overrides: Partial<SelectionOption> = {},
): SelectionOption {
  return {
    id,
    category_id: categoryId,
    project_id: "p1",
    name: id,
    description: null,
    supplier: null,
    finish: null,
    price_delta: 0,
    lead_time_days: 14,
    is_standard: false,
    image_path: null,
    swatch: null,
    sequence: 1,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("deriveDeadline", () => {
  it("uses an explicit deadline when one is set", () => {
    const result = deriveDeadline(
      { decision_deadline: "2026-10-01", buffer_days: 7 },
      [{ lead_time_days: 30 }],
      { planned_start: "2026-12-01" },
    );
    expect(result).toEqual({ date: "2026-10-01", derived: false });
  });

  it("derives from milestone start, the longest lead time and the buffer", () => {
    // 1 Dec, minus the 28-day lead of the slowest option, minus 7 days' buffer.
    const result = deriveDeadline(
      { decision_deadline: null, buffer_days: 7 },
      [{ lead_time_days: 10 }, { lead_time_days: 28 }],
      { planned_start: "2026-12-01" },
    );
    expect(result).toEqual({ date: "2026-10-27", derived: true });
  });

  it("moves with the programme: a later milestone gives a later deadline", () => {
    const early = deriveDeadline(
      { decision_deadline: null, buffer_days: 7 },
      [{ lead_time_days: 14 }],
      {
        planned_start: "2026-12-01",
      },
    );
    const slipped = deriveDeadline(
      { decision_deadline: null, buffer_days: 7 },
      [{ lead_time_days: 14 }],
      {
        planned_start: "2026-12-15",
      },
    );
    expect(slipped.date! > early.date!).toBe(true);
  });

  it("has no deadline without a linked milestone", () => {
    expect(deriveDeadline({ decision_deadline: null, buffer_days: 7 }, [], null)).toEqual({
      date: null,
      derived: false,
    });
  });
});

describe("urgencyFor", () => {
  it.each([
    [-1, "overdue"],
    [0, "urgent"],
    [7, "urgent"],
    [8, "soon"],
    [21, "soon"],
    [22, "later"],
    [null, "later"],
  ] as const)("%s days left on an open decision is %s", (days, expected) => {
    expect(urgencyFor("open", days)).toBe(expected);
  });

  it("treats a chosen selection as chosen regardless of the deadline", () => {
    expect(urgencyFor("chosen", -30)).toBe("chosen");
  });

  it("treats confirmed and locked selections as locked", () => {
    expect(urgencyFor("confirmed", 5)).toBe("locked");
    expect(urgencyFor("locked", 5)).toBe("locked");
  });
});

describe("viewSelections", () => {
  const kitchen = milestone("kitchen", "2026-10-10", "2026-11-05");

  it("flags options that can no longer arrive before the work starts", () => {
    // Work starts in 30 days. A 45-day lead time cannot make it; 14 can.
    const cat = category("worktop");
    const views = viewSelections(
      [cat],
      [
        option("laminate", "worktop", { is_standard: true, lead_time_days: 14 }),
        option("quartz", "worktop", { lead_time_days: 45, price_delta: 4200 }),
      ],
      [kitchen],
      ASOF,
    );

    expect(views[0]!.lateOptionIds.has("quartz")).toBe(true);
    expect(views[0]!.lateOptionIds.has("laminate")).toBe(false);
  });

  it("explains a late choice in days, not just as a warning", () => {
    const cat = category("worktop", { status: "chosen", chosen_option_id: "quartz" });
    const [view] = viewSelections(
      [cat],
      [
        option("laminate", "worktop", { is_standard: true }),
        option("quartz", "worktop", { name: "Quartz", lead_time_days: 45 }),
      ],
      [kitchen],
      ASOF,
    );

    // Ordered today it arrives 25 Oct; work starts 10 Oct -> 15 days late.
    expect(view!.consequence).toContain("15 days");
    expect(view!.consequence).toContain("kitchen fit");
  });

  it("states what happens if an open deadline passes", () => {
    const [view] = viewSelections(
      [category("tiles", { decision_deadline: "2026-09-20" })],
      [option("white", "tiles", { name: "White ceramic", is_standard: true })],
      [kitchen],
      ASOF,
    );
    expect(view!.consequence).toContain("the standard white ceramic");
    expect(view!.consequence).toContain("change order");
  });

  it("sorts overdue decisions first, then by deadline", () => {
    const views = viewSelections(
      [
        category("later", { decision_deadline: "2026-12-01", sequence: 1 }),
        category("overdue", { decision_deadline: "2026-09-01", sequence: 2 }),
        category("urgent", { decision_deadline: "2026-09-14", sequence: 3 }),
        category("done", { status: "chosen", sequence: 4 }),
      ],
      [],
      [],
      ASOF,
    );
    expect(views.map((v) => v.category.id)).toEqual(["overdue", "urgent", "later", "done"]);
  });

  it("reports no late options once a selection is locked", () => {
    const [view] = viewSelections(
      [category("worktop", { status: "locked", chosen_option_id: "quartz" })],
      [option("quartz", "worktop", { lead_time_days: 90 })],
      [kitchen],
      ASOF,
    );
    expect(view!.lateOptionIds.size).toBe(0);
    expect(view!.urgency).toBe("locked");
  });
});

describe("summariseSelections", () => {
  it("sums the price impact of every choice, credits included", () => {
    const views = viewSelections(
      [
        category("a", { status: "chosen", chosen_option_id: "a2" }),
        category("b", { status: "chosen", chosen_option_id: "b2" }),
        category("c", { decision_deadline: "2026-09-30" }),
      ],
      [
        option("a2", "a", { price_delta: 4200 }),
        option("b2", "b", { price_delta: -600 }),
        option("c1", "c", { price_delta: 1500 }),
      ],
      [],
      ASOF,
    );

    const summary = summariseSelections(views);
    // Only chosen options count; c is still open.
    expect(summary.budgetImpact).toBe(3600);
    expect(summary.decided).toBe(2);
    expect(summary.open).toBe(1);
    expect(summary.nextDeadline?.category.id).toBe("c");
  });
});

describe("formatPriceDelta", () => {
  it("formats upgrades, credits and the standard option", () => {
    expect(formatPriceDelta(4200)).toBe("+$4,200");
    expect(formatPriceDelta(-600)).toBe("−$600");
    expect(formatPriceDelta(0)).toBe("Included");
  });
});
