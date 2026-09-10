import { describe, expect, it } from "vitest";

import { buildProjectContext, MAX_CONTEXT_CHARS, type AssistantWorkspace } from "@/lib/ai/context";
import { buildDemoDataset } from "@/lib/demo/dataset";

/**
 * The assistant's grounding has to stay the same size however large a
 * project grows: every row sent is paid for on every question. These tests
 * grow the demo house forty-fold and check the ceiling holds, and that what
 * a buyer asks about most survives the cut.
 */

const REFERENCE = new Date("2026-09-09T12:00:00.000Z");

function workspace(copies: number): AssistantWorkspace {
  const d = buildDemoDataset(REFERENCE);
  // The first copy keeps its ids, so dependencies and selections still resolve.
  const many = <T extends { id: string }>(rows: T[]): T[] =>
    Array.from({ length: copies }, (_, copy) =>
      rows.map((row) => (copy === 0 ? row : { ...row, id: `${row.id}-${copy}` })),
    ).flat();

  return {
    organization: d.organization,
    project: d.project,
    isDemo: true,
    now: REFERENCE.toISOString(),
    milestones: many(d.milestones),
    dependencies: d.dependencies,
    phases: d.phases,
    snapshots: d.snapshots,
    budgetCategories: d.budgetCategories,
    costEntries: many(d.costEntries),
    changeOrders: many(d.changeOrders),
    payments: d.payments,
    issues: many(d.issues),
    inspections: many(d.inspections),
    weather: d.weather,
    selectionCategories: d.selectionCategories,
    selectionOptions: d.selectionOptions,
    siteVisits: d.siteVisits,
    documents: many(d.documents),
    updates: d.updates.slice(0, 8),
  };
}

describe("buildProjectContext", () => {
  it("describes a typical house in full", () => {
    const w = workspace(1);
    const { context } = buildProjectContext(w);

    expect(context.length).toBeLessThan(MAX_CONTEXT_CHARS);
    expect(context).not.toContain("the Timeline page lists every one");
    for (const milestone of w.milestones) expect(context).toContain(milestone.name);
  });

  it("stays under the ceiling for a project forty times the size", () => {
    const { context } = buildProjectContext(workspace(40));

    expect(context.length).toBeLessThanOrEqual(MAX_CONTEXT_CHARS);
    expect(context).toContain("the Timeline page lists every one");
  });

  it("keeps what a buyer asks about when it has to cut", () => {
    const { context } = buildProjectContext(workspace(40));
    const milestones = context.slice(context.indexOf("## Milestones"), context.indexOf("## Money"));

    // Money and the forecast come before every list, so no cut reaches them.
    expect(context).toContain("Next payment due");
    expect(context).toContain("Forecast completion");
    // Work under way is listed ahead of work already finished.
    const firstActive = milestones.indexOf("status=in_progress");
    const firstFinished = milestones.indexOf("status=completed");
    expect(firstActive).toBeGreaterThan(-1);
    if (firstFinished > -1) expect(firstActive).toBeLessThan(firstFinished);
  });
});
