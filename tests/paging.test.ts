import { describe, expect, it } from "vitest";

import {
  decodeCursor,
  demoWindow,
  encodeCursor,
  isCursor,
  keysetFilter,
  type Page,
} from "@/lib/data/paging";
import { digestWindowStart } from "@/lib/domain/digest";
import { windowStart } from "@/lib/domain/since";

/**
 * Keyset paging.
 *
 * The failure worth testing is the silent one: a page boundary that falls
 * between two rows with the same timestamp and quietly drops one of them, or
 * a cursor from the browser that smuggles a filter into the query.
 */

interface Row {
  id: string;
  at: string;
}

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

// 45 rows in pairs that share a timestamp, so an odd page size ends
// half-way through a pair.
const ROWS: Row[] = Array.from({ length: 45 }, (_, i) => ({
  id: uuid(i),
  at: `2026-01-${String(1 + Math.floor(i / 2)).padStart(2, "0")}T09:00:00.000Z`,
}));
const at = (row: Row) => row.at;

function readAll(limit: number) {
  const seen: Row[] = [];
  let before: string | null = null;
  let pages = 0;
  do {
    const page: Page<Row> = demoWindow(ROWS, at, { limit, before });
    seen.push(...page.items);
    before = page.nextCursor;
    pages += 1;
  } while (before && pages < 100);
  return { seen, pages };
}

describe("demoWindow", () => {
  it("reads every row exactly once, even when pages end inside a run of equal timestamps", () => {
    const { seen, pages } = readAll(7);

    expect(pages).toBe(7);
    expect(seen).toHaveLength(45);
    expect(new Set(seen.map((r) => r.id)).size).toBe(45);

    const newestFirst = [...ROWS].sort(
      (a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id),
    );
    expect(seen.map((r) => r.id)).toEqual(newestFirst.map((r) => r.id));
  });

  it("gives the last page no cursor, including a page that is exactly full", () => {
    expect(demoWindow(ROWS, at, { limit: 45 }).nextCursor).toBeNull();
    expect(demoWindow(ROWS, at, { limit: 44 }).nextCursor).not.toBeNull();
  });

  it("keeps only rows strictly after `since`", () => {
    const page = demoWindow(ROWS, at, { limit: 100, since: "2026-01-22T09:00:00.000Z" });
    expect(page.items.map((r) => r.id)).toEqual([uuid(44)]);
  });

  it("starts from the top when the cursor is not one it issued", () => {
    const page = demoWindow(ROWS, at, { limit: 3, before: "garbage" });
    expect(page.items.map((r) => r.id)).toEqual([uuid(44), uuid(43), uuid(42)]);
  });
});

describe("cursors", () => {
  it("round-trips a database timestamp and id, in URL-safe characters", () => {
    const cursor = encodeCursor("2026-09-10T08:12:33.123456+00:00", uuid(3));
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCursor(cursor)).toEqual({
      at: "2026-09-10T08:12:33.123456+00:00",
      id: uuid(3),
    });
  });

  it.each([
    ["empty", ""],
    ["not base64", "not a cursor!"],
    ["the wrong shape", btoa(JSON.stringify(["2026-01-01T00:00:00Z"]))],
    ["a filter in the id", encodeCursor("2026-01-01T00:00:00Z", "x),id.gt.0")],
    ["a filter in the timestamp", encodeCursor('2026-01-01",and(id.gt.0', uuid(1))],
    ["a relative date", encodeCursor("yesterday", uuid(1))],
    ["an oversized value", "A".repeat(500)],
  ])("rejects %s", (_label, value) => {
    expect(isCursor(value)).toBe(false);
  });

  it("builds a strictly-older filter with the id as tie-breaker", () => {
    expect(keysetFilter("published_at", { at: "2026-01-01T00:00:00.000Z", id: uuid(1) })).toBe(
      `published_at.lt."2026-01-01T00:00:00.000Z",` +
        `and(published_at.eq."2026-01-01T00:00:00.000Z",id.lt.${uuid(1)})`,
    );
  });
});

describe("feed windows", () => {
  const asOf = new Date("2026-09-10T12:00:00.000Z");

  it("opens the since-you-last-looked window at the last-seen mark, or a week back", () => {
    expect(windowStart("2026-09-01T08:00:00.000Z", asOf)).toBe("2026-09-01T08:00:00.000Z");
    expect(windowStart(null, asOf)).toBe("2026-09-03T12:00:00.000Z");
  });

  it("fetches the digest's week with a day to spare", () => {
    // The digest covers dates after 2026-09-03; the fetch starts the day before.
    expect(digestWindowStart(asOf)).toBe("2026-09-02T00:00:00.000Z");
  });
});
