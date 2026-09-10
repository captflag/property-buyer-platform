import { describe, expect, it } from "vitest";

import { getThreads, getUpdates, getUpdateStats } from "@/lib/data/feeds";
import { getWorkspace } from "@/lib/data/workspace";
import { buildDemoDataset } from "@/lib/demo/dataset";
import type { Update } from "@/types/database";

/**
 * The read path, run against the demo dataset -- the same code the pages
 * call, with no database configured.
 */

const demo = buildDemoDataset(new Date());

describe("getWorkspace", () => {
  it("returns the project and exactly the tables asked for", async () => {
    const w = await getWorkspace(undefined, ["milestones", "payments"]);

    expect(w.isDemo).toBe(true);
    expect(Object.keys(w).sort()).toEqual([
      "isDemo",
      "milestones",
      "now",
      "organization",
      "payments",
      "project",
    ]);
    expect(w.milestones).toHaveLength(demo.milestones.length);
  });
});

describe("feeds", () => {
  it("pages through every update exactly once, with media for exactly those updates", async () => {
    const seen: Update[] = [];
    let before: string | null = null;
    do {
      const page: Awaited<ReturnType<typeof getUpdates>> = await getUpdates(undefined, {
        limit: 4,
        before,
        media: true,
      });
      const ids = new Set(page.updates.map((u) => u.id));
      expect(page.media.every((m) => ids.has(m.update_id))).toBe(true);
      seen.push(...page.updates);
      before = page.nextCursor;
    } while (before);

    expect(seen).toHaveLength(demo.updates.length);
    expect(new Set(seen.map((u) => u.id)).size).toBe(demo.updates.length);
    expect(seen.map((u) => u.published_at)).toEqual(
      [...seen.map((u) => u.published_at)].sort().reverse(),
    );
  });

  it("returns threads with their own messages and no others", async () => {
    const page = await getThreads(undefined, { limit: 2 });
    const ids = new Set(page.discussions.map((d) => d.id));

    expect(page.discussions.length).toBeLessThanOrEqual(2);
    expect(page.messages.every((m) => ids.has(m.discussion_id))).toBe(true);
  });

  it("counts a window without loading it", async () => {
    const all = await getUpdateStats(undefined, "2000-01-01T00:00:00.000Z");
    expect(all.count).toBe(demo.updates.length);
    expect(all.photos).toBe(demo.media.filter((m) => m.kind === "image").length);
  });
});
