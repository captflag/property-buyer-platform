import { describe, expect, it } from "vitest";

import {
  addDays,
  daysBetween,
  formatCurrency,
  formatFileSize,
  formatPoints,
  formatRelative,
  humanise,
  parseDate,
} from "@/lib/format";
import { buildDemoDataset } from "@/lib/demo/dataset";

describe("parseDate", () => {
  it("reads a plain date as UTC midnight, not local", () => {
    // The bug this guards against: `new Date("2026-03-15T00:00:00")` is local,
    // which shifts the calendar day for anyone west of Greenwich.
    const date = parseDate("2026-03-15");
    expect(date.getUTCFullYear()).toBe(2026);
    expect(date.getUTCMonth()).toBe(2);
    expect(date.getUTCDate()).toBe(15);
    expect(date.toISOString()).toBe("2026-03-15T00:00:00.000Z");
  });
});

describe("daysBetween / addDays", () => {
  it("counts forward days as positive", () => {
    expect(daysBetween("2026-03-01", "2026-03-11")).toBe(10);
  });

  it("counts backward days as negative", () => {
    expect(daysBetween("2026-03-11", "2026-03-01")).toBe(-10);
  });

  it("crosses a month boundary correctly", () => {
    expect(addDays("2026-01-30", 3)).toBe("2026-02-02");
  });

  it("crosses a leap day correctly", () => {
    expect(addDays("2028-02-28", 2)).toBe("2028-03-01");
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2);
  });

  it("round-trips with daysBetween", () => {
    expect(daysBetween("2026-01-01", addDays("2026-01-01", 137))).toBe(137);
  });
});

describe("formatCurrency", () => {
  it("renders whole currency units without decimals", () => {
    expect(formatCurrency(685_000, "USD")).toBe("$685,000");
  });

  it("compacts large values", () => {
    expect(formatCurrency(685_000, "USD", { compact: true })).toBe("$685K");
  });
});

describe("formatPoints", () => {
  it("signs a positive delta", () => {
    expect(formatPoints(4.15)).toBe("+4.2 pts");
  });

  it("uses a real minus sign for negatives", () => {
    expect(formatPoints(-4.15)).toBe("−4.2 pts");
  });

  it("leaves zero unsigned", () => {
    expect(formatPoints(0)).toBe("0.0 pts");
  });
});

describe("formatFileSize", () => {
  it("handles zero", () => {
    expect(formatFileSize(0)).toBe("0 B");
  });

  it("drops decimals for bytes", () => {
    expect(formatFileSize(900)).toBe("900 B");
  });

  it("keeps one decimal below ten units", () => {
    expect(formatFileSize(2_411_000)).toBe("2.3 MB");
  });

  it("drops the decimal at ten units and above", () => {
    expect(formatFileSize(18_204_000)).toBe("17 MB");
  });
});

describe("formatRelative", () => {
  it("takes `now` as a parameter so server and client agree", () => {
    const now = new Date("2026-03-15T12:00:00.000Z");
    expect(formatRelative("2026-03-14T12:00:00.000Z", now)).toBe("yesterday");
    expect(formatRelative("2026-03-15T09:00:00.000Z", now)).toBe("3 hours ago");
  });
});

describe("humanise", () => {
  it("turns an enum value into readable text", () => {
    expect(humanise("in_progress")).toBe("In progress");
    expect(humanise("under_review")).toBe("Under review");
  });
});

describe("demo dataset", () => {
  const reference = new Date("2026-09-09T12:00:00.000Z");

  it("is deterministic for a given reference date", () => {
    const a = buildDemoDataset(reference);
    const b = buildDemoDataset(reference);

    // Byte-identical output matters: a dataset that reshuffles on every render
    // would make every chart flicker and every test flaky.
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("produces a coherent, fully populated project", () => {
    const data = buildDemoDataset(reference);

    expect(data.milestones.length).toBeGreaterThan(20);
    expect(data.phases).toHaveLength(6);
    expect(data.updates.length).toBeGreaterThan(10);
    expect(data.snapshots.length).toBeGreaterThan(30);
    expect(data.payments.length).toBeGreaterThan(5);
  });

  it("gives phase weights that sum to 100", () => {
    const data = buildDemoDataset(reference);
    const total = data.phases.reduce((sum, phase) => sum + phase.weight, 0);
    expect(total).toBe(100);
  });

  it("keeps every dependency pointing at a real milestone", () => {
    const data = buildDemoDataset(reference);
    const ids = new Set(data.milestones.map((m) => m.id));

    for (const dependency of data.dependencies) {
      expect(ids.has(dependency.predecessor_id)).toBe(true);
      expect(ids.has(dependency.successor_id)).toBe(true);
    }
  });

  it("tells a project that is behind plan, which is what the UI has to surface", () => {
    const data = buildDemoDataset(reference);
    const latest = data.snapshots[data.snapshots.length - 1]!;
    expect(latest.actual_percent).toBeLessThan(latest.planned_percent);
  });

  it("never marks a milestone critical in the seed data", () => {
    // Criticality is derived by computeSchedule(), never asserted by the seed.
    const data = buildDemoDataset(reference);
    expect(data.milestones.every((m) => m.is_critical === false)).toBe(true);
  });
});
