import { describe, expect, it } from "vitest";

import { buildIcs, escapeText, foldLine } from "@/lib/calendar";

/**
 * iCalendar is unforgiving in ways that only show up in someone else's
 * calendar client, so these tests check the format rules directly rather than
 * the rough shape of the output.
 */

const NOW = new Date("2026-09-10T12:00:00.000Z");
const encoder = new TextEncoder();

describe("escapeText", () => {
  it("escapes the characters RFC 5545 reserves", () => {
    expect(escapeText("a;b,c\\d")).toBe("a\\;b\\,c\\\\d");
  });

  it("turns newlines into the literal \\n sequence", () => {
    expect(escapeText("line one\nline two\r\nline three")).toBe("line one\\nline two\\nline three");
  });
});

describe("foldLine", () => {
  it("leaves short lines alone", () => {
    expect(foldLine("SUMMARY:Short")).toBe("SUMMARY:Short");
  });

  it("keeps every physical line within 75 octets", () => {
    const folded = foldLine(`DESCRIPTION:${"x".repeat(300)}`);
    for (const physical of folded.split("\r\n")) {
      expect(encoder.encode(physical).length).toBeLessThanOrEqual(75);
    }
  });

  it("folds by bytes, so multi-byte text is never split mid-character", () => {
    // Each "é" is two bytes; folding by characters would overrun 75 octets.
    const line = `SUMMARY:${"é".repeat(80)}`;
    const folded = foldLine(line);
    for (const physical of folded.split("\r\n")) {
      expect(encoder.encode(physical).length).toBeLessThanOrEqual(75);
      // A split codepoint would decode to the replacement character.
      expect(physical).not.toContain("�");
    }
  });

  it("round-trips: unfolding restores the original line", () => {
    const line = `DESCRIPTION:${"Kestrel House — Café Müller ".repeat(8)}`;
    expect(foldLine(line).replace(/\r\n /g, "")).toBe(line);
  });
});

describe("buildIcs", () => {
  const ics = buildIcs(
    [
      {
        uid: "payment-1",
        title: "Payment due: Weather-tight; $102,750",
        description: "Stage payment.\nInvoice INV-0058",
        start: "2026-09-30",
        allDay: true,
      },
      {
        uid: "visit-1",
        title: "Site visit",
        start: "2026-09-15T15:00:00.000Z",
        allDay: false,
        durationMinutes: 60,
        location: "17 Kestrel Rise, Austin",
      },
    ],
    { name: "Kestrel House", now: NOW },
  );

  it("uses CRLF line endings throughout and ends with one", () => {
    expect(ics.endsWith("\r\n")).toBe(true);
    // No bare LF anywhere.
    expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("wraps everything in a single VCALENDAR", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });

  it("gives all-day events an exclusive end date on the following day", () => {
    expect(ics).toContain("DTSTART;VALUE=DATE:20260930");
    expect(ics).toContain("DTEND;VALUE=DATE:20261001");
  });

  it("handles an all-day event on the last day of a year", () => {
    const yearEnd = buildIcs([{ uid: "x", title: "Y", start: "2026-12-31", allDay: true }], {
      name: "t",
      now: NOW,
    });
    expect(yearEnd).toContain("DTEND;VALUE=DATE:20270101");
  });

  it("writes timed events in UTC with the requested duration", () => {
    expect(ics).toContain("DTSTART:20260915T150000Z");
    expect(ics).toContain("DTEND:20260915T160000Z");
  });

  it("escapes text values", () => {
    expect(ics).toContain("SUMMARY:Payment due: Weather-tight\\; $102\\,750");
    expect(ics).toContain("DESCRIPTION:Stage payment.\\nInvoice INV-0058");
  });

  it("uses stable, domain-qualified UIDs so re-imports update rather than duplicate", () => {
    expect(ics).toContain("UID:payment-1@kestrel.app");
    const again = buildIcs(
      [{ uid: "payment-1", title: "Changed title", start: "2026-10-01", allDay: true }],
      { name: "Kestrel House", now: NOW },
    );
    expect(again).toContain("UID:payment-1@kestrel.app");
  });

  it("stamps every event", () => {
    expect(ics.match(/DTSTAMP:20260910T120000Z/g)).toHaveLength(2);
  });
});
