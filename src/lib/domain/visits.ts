/**
 * Site visit slots.
 *
 * Slots are defined in the *site's* wall-clock time -- "Tuesday 10:00" means
 * 10:00 at the house, whatever timezone the buyer's laptop is in -- and stored
 * as UTC instants. Converting a wall time in a named zone to UTC is done here
 * with Intl rather than a date library: it is thirty lines, it handles DST, and
 * it is the only timezone arithmetic in the app.
 *
 * Rules mirror how sites actually run visits: set sessions when the site
 * manager can escort, 48 hours' notice for the safety induction, and nothing
 * beyond three weeks because the programme is not firm that far out.
 */

import type { SiteVisit } from "@/types/database";

export interface VisitRules {
  /** ISO weekday (1 = Monday ... 7 = Sunday) to wall-clock start times. */
  sessions: Record<number, string[]>;
  durationMinutes: number;
  minNoticeHours: number;
  horizonDays: number;
}

export const DEFAULT_VISIT_RULES: VisitRules = {
  sessions: {
    2: ["10:00", "14:00"], // Tuesday
    4: ["10:00", "14:00"], // Thursday
    6: ["10:00"], // Saturday morning
  },
  durationMinutes: 60,
  minNoticeHours: 48,
  horizonDays: 21,
};

export const VISIT_PURPOSES = [
  "General look around",
  "Measure up for furniture",
  "Review selections on site",
  "Snagging walk",
  "Meet a trade",
] as const;

/** Minutes the zone is ahead of UTC at a given instant (negative west of UTC). */
export function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  const asIfUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return Math.round((asIfUtc - instant.getTime()) / 60_000);
}

/**
 * The UTC instant at which the clock in `timeZone` reads `date time`.
 *
 * Guess using the offset at the naive instant, then correct once: if the guess
 * lands on the other side of a DST change the offset differs, and the second
 * pass uses the right one.
 *
 * Wall times that do not exist -- the hour skipped when clocks go forward --
 * resolve to an adjacent valid instant rather than throwing. That is a
 * deliberate non-guarantee: visit sessions are mid-morning and mid-afternoon,
 * nowhere near the 02:00 transition, so no real slot can land there.
 */
export function zonedWallTimeToUtc(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const [hh, mm] = time.split(":").map(Number) as [number, number];

  const naive = Date.UTC(y, m - 1, d, hh, mm);
  const first = zoneOffsetMinutes(new Date(naive), timeZone);
  let utc = naive - first * 60_000;

  const second = zoneOffsetMinutes(new Date(utc), timeZone);
  if (second !== first) utc = naive - second * 60_000;

  return new Date(utc);
}

/** Today's calendar date as seen at the site. */
export function dateInZone(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

export interface VisitSlot {
  startsAt: string;
  date: string;
  time: string;
}

export function availableSlots(input: {
  asOf: Date;
  timeZone: string;
  existing: readonly Pick<SiteVisit, "starts_at" | "status">[];
  rules?: VisitRules;
}): VisitSlot[] {
  const rules = input.rules ?? DEFAULT_VISIT_RULES;
  const earliest = input.asOf.getTime() + rules.minNoticeHours * 3_600_000;

  const taken = new Set(
    input.existing
      .filter((v) => v.status === "requested" || v.status === "confirmed")
      .map((v) => new Date(v.starts_at).getTime()),
  );

  const startDate = dateInZone(input.asOf, input.timeZone);
  const [y, m, d] = startDate.split("-").map(Number) as [number, number, number];
  const slots: VisitSlot[] = [];

  for (let offset = 0; offset <= rules.horizonDays; offset += 1) {
    // A calendar date's weekday does not depend on timezone, so it is safe to
    // step and read weekdays in UTC here.
    const day = new Date(Date.UTC(y, m - 1, d + offset));
    const date = day.toISOString().slice(0, 10);
    const isoWeekday = ((day.getUTCDay() + 6) % 7) + 1;

    for (const time of rules.sessions[isoWeekday] ?? []) {
      const instant = zonedWallTimeToUtc(date, time, input.timeZone);
      if (instant.getTime() < earliest) continue;
      if (taken.has(instant.getTime())) continue;
      slots.push({ startsAt: instant.toISOString(), date, time });
    }
  }

  return slots;
}

/** Format an instant in the site's zone, so every viewer sees site time. */
export function formatInZone(
  iso: string,
  timeZone: string,
  style: "date" | "time" | "full" = "full",
): string {
  const options: Intl.DateTimeFormatOptions =
    style === "date"
      ? { weekday: "long", day: "numeric", month: "long" }
      : style === "time"
        ? { hour: "numeric", minute: "2-digit" }
        : { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" };
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone }).format(new Date(iso));
}
