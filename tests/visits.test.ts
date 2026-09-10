import { describe, expect, it } from "vitest";

import {
  availableSlots,
  dateInZone,
  zonedWallTimeToUtc,
  zoneOffsetMinutes,
} from "@/lib/domain/visits";

/**
 * Timezone arithmetic is the one place in the app where "works on my
 * machine" is a real risk -- the developer's zone leaks into naive date code.
 * Every case below names its zone explicitly and asserts UTC, so the suite
 * gives the same answer wherever it runs.
 */

const CHICAGO = "America/Chicago";

describe("zoneOffsetMinutes", () => {
  it("reports standard time in winter", () => {
    expect(zoneOffsetMinutes(new Date("2026-01-15T16:00:00Z"), CHICAGO)).toBe(-360);
  });

  it("reports daylight time in summer", () => {
    expect(zoneOffsetMinutes(new Date("2026-07-15T15:00:00Z"), CHICAGO)).toBe(-300);
  });

  it("is zero for UTC", () => {
    expect(zoneOffsetMinutes(new Date("2026-07-15T15:00:00Z"), "UTC")).toBe(0);
  });
});

describe("zonedWallTimeToUtc", () => {
  it("converts a winter wall time (CST, UTC-6)", () => {
    expect(zonedWallTimeToUtc("2026-01-15", "10:00", CHICAGO).toISOString()).toBe(
      "2026-01-15T16:00:00.000Z",
    );
  });

  it("converts a summer wall time (CDT, UTC-5)", () => {
    expect(zonedWallTimeToUtc("2026-07-15", "10:00", CHICAGO).toISOString()).toBe(
      "2026-07-15T15:00:00.000Z",
    );
  });

  it("uses daylight time on the first days after clocks go forward", () => {
    // DST began 8 March 2026. Two days later, 10:00 is UTC-5.
    expect(zonedWallTimeToUtc("2026-03-10", "10:00", CHICAGO).toISOString()).toBe(
      "2026-03-10T15:00:00.000Z",
    );
  });

  it("uses standard time on the day before clocks go forward", () => {
    expect(zonedWallTimeToUtc("2026-03-07", "10:00", CHICAGO).toISOString()).toBe(
      "2026-03-07T16:00:00.000Z",
    );
  });

  it("works east of UTC too", () => {
    // Kolkata is UTC+5:30 all year.
    expect(zonedWallTimeToUtc("2026-07-15", "10:00", "Asia/Kolkata").toISOString()).toBe(
      "2026-07-15T04:30:00.000Z",
    );
  });
});

describe("dateInZone", () => {
  it("returns the site's calendar date, not UTC's", () => {
    // 03:00 UTC on the 15th is still the evening of the 14th in Chicago.
    expect(dateInZone(new Date("2026-01-15T03:00:00Z"), CHICAGO)).toBe("2026-01-14");
  });
});

describe("availableSlots", () => {
  // Monday 12 January 2026, 06:00 in Chicago.
  const asOf = new Date("2026-01-12T12:00:00Z");

  it("honours 48 hours' notice", () => {
    const slots = availableSlots({ asOf, timeZone: CHICAGO, existing: [] });
    const earliest = asOf.getTime() + 48 * 3_600_000;
    for (const slot of slots) {
      expect(new Date(slot.startsAt).getTime()).toBeGreaterThanOrEqual(earliest);
    }
    // Tuesday the 13th is inside the notice window; Thursday the 15th is first.
    expect(slots[0]).toEqual({
      startsAt: "2026-01-15T16:00:00.000Z",
      date: "2026-01-15",
      time: "10:00",
    });
  });

  it("offers only Tuesday, Thursday and Saturday sessions", () => {
    const slots = availableSlots({ asOf, timeZone: CHICAGO, existing: [] });
    const weekdays = new Set(slots.map((s) => new Date(`${s.date}T00:00:00Z`).getUTCDay()));
    expect([...weekdays].sort()).toEqual([2, 4, 6]);
  });

  it("generates the expected number of sessions over the horizon", () => {
    // 12 Jan -> 2 Feb: three each of Tue/Thu (two sessions) and Sat (one),
    // minus both Tuesday-13th sessions lost to the notice period.
    expect(availableSlots({ asOf, timeZone: CHICAGO, existing: [] })).toHaveLength(13);
  });

  it("removes slots that are already requested or confirmed", () => {
    const slots = availableSlots({
      asOf,
      timeZone: CHICAGO,
      existing: [{ starts_at: "2026-01-15T16:00:00.000Z", status: "confirmed" }],
    });
    expect(slots).toHaveLength(12);
    expect(slots.some((s) => s.startsAt === "2026-01-15T16:00:00.000Z")).toBe(false);
  });

  it("frees a slot again when a request is declined or cancelled", () => {
    const slots = availableSlots({
      asOf,
      timeZone: CHICAGO,
      existing: [
        { starts_at: "2026-01-15T16:00:00.000Z", status: "declined" },
        { starts_at: "2026-01-15T20:00:00.000Z", status: "cancelled" },
      ],
    });
    expect(slots).toHaveLength(13);
  });
});
