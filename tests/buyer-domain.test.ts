import { describe, expect, it } from "vitest";

import { explainDelay } from "@/lib/domain/delay";
import { composeDigest, digestToText } from "@/lib/domain/digest";
import type { CompletionForecast } from "@/lib/domain/forecast";
import { buildMovePlan, MOVE_TEMPLATE } from "@/lib/domain/move-in";
import { computeSchedule } from "@/lib/domain/schedule";
import type { SelectionView } from "@/lib/domain/selections";
import { changesSince } from "@/lib/domain/since";
import { addDays } from "@/lib/format";
import type {
  ChangeOrder,
  Discussion,
  DiscussionMessage,
  Issue,
  Milestone,
  MoveTask,
  ProgressSnapshot,
  Update,
  WeatherLogEntry,
} from "@/types/database";

const ASOF = new Date("2026-09-10T12:00:00.000Z");

/* ---------------------------------------------------------------- fixtures */

function milestone(id: string, overrides: Partial<Milestone> = {}): Milestone {
  return {
    id,
    project_id: "p1",
    phase_id: null,
    name: id,
    description: null,
    sequence: 1,
    weight: 1,
    planned_start: "2026-08-01",
    planned_end: "2026-08-20",
    actual_start: null,
    actual_end: null,
    progress_percent: 0,
    status: "not_started",
    is_critical: false,
    payment_percent: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function update(id: string, publishedAt: string, overrides: Partial<Update> = {}): Update {
  return {
    id,
    project_id: "p1",
    milestone_id: null,
    author_id: "builder",
    title: id,
    body: "",
    status: "in_progress",
    progress_delta: null,
    crew_size: null,
    hours_worked: null,
    weather: null,
    temperature_c: null,
    is_published: true,
    published_at: publishedAt,
    created_at: publishedAt,
    updated_at: publishedAt,
    ...overrides,
  };
}

function issue(id: string, overrides: Partial<Issue> = {}): Issue {
  return {
    id,
    project_id: "p1",
    milestone_id: null,
    title: id,
    description: null,
    location: null,
    severity: "medium",
    status: "open",
    reported_by: null,
    assigned_to: null,
    due_date: null,
    resolved_at: null,
    room: null,
    photo_paths: [],
    raised_by_buyer: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function forecast(slipDays: number | null): CompletionForecast {
  return {
    projectedDate: slipDays === null ? null : addDays("2027-03-06", slipDays),
    earliestDate: null,
    latestDate: null,
    velocityPerDay: 0.3,
    slipDays,
    rSquared: 0.95,
    sampleSize: 30,
    confidence: "high",
  };
}

function selectionView(
  id: string,
  urgency: SelectionView["urgency"],
  daysLeft: number | null,
  m: Milestone | null = null,
): SelectionView {
  return {
    category: {
      id,
      project_id: "p1",
      milestone_id: m?.id ?? null,
      name: id,
      room: null,
      description: null,
      sequence: 1,
      decision_deadline: daysLeft === null ? null : addDays("2026-09-10", daysLeft),
      buffer_days: 7,
      status: urgency === "chosen" ? "chosen" : urgency === "locked" ? "locked" : "open",
      chosen_option_id: null,
      chosen_by: null,
      chosen_at: null,
      notes: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    options: [],
    standard: null,
    chosen: null,
    milestone: m,
    deadline: daysLeft === null ? null : addDays("2026-09-10", daysLeft),
    deadlineDerived: false,
    daysLeft,
    urgency,
    priceDelta: 0,
    lateOptionIds: new Set(),
    consequence: "",
  };
}

const EMPTY = {
  milestones: [] as Milestone[],
  documents: [],
  payments: [],
  issues: [] as Issue[],
  selections: [] as SelectionView[],
  discussions: [] as Discussion[],
  messages: [] as DiscussionMessage[],
  visits: [],
};

/* ------------------------------------------------------------ since tests */

describe("changesSince", () => {
  it("includes updates published after the last visit and nothing before", () => {
    const summary = changesSince({
      ...EMPTY,
      since: "2026-09-05T00:00:00.000Z",
      asOf: ASOF,
      slug: "k",
      viewerId: "buyer",
      updates: [
        update("new", "2026-09-08T10:00:00.000Z"),
        update("old", "2026-09-01T10:00:00.000Z"),
      ],
    });
    expect(summary.items.map((i) => i.id)).toEqual(["new"]);
    expect(summary.isFirstVisit).toBe(false);
  });

  it("falls back to the last week on a first visit", () => {
    const summary = changesSince({
      ...EMPTY,
      since: null,
      asOf: ASOF,
      slug: "k",
      viewerId: "buyer",
      updates: [
        update("recent", "2026-09-06T10:00:00.000Z"),
        update("ancient", "2026-06-01T10:00:00.000Z"),
      ],
    });
    expect(summary.isFirstVisit).toBe(true);
    expect(summary.items.map((i) => i.id)).toEqual(["recent"]);
  });

  it("does not report your own messages as news", () => {
    const thread: Discussion = {
      id: "t1",
      project_id: "p1",
      subject_kind: "general",
      subject_id: null,
      subject_label: null,
      title: "Parking",
      status: "open",
      created_by: "buyer",
      last_message_at: "2026-09-09T00:00:00.000Z",
      created_at: "2026-09-01T00:00:00.000Z",
      updated_at: "2026-09-09T00:00:00.000Z",
    };
    const message = (id: string, author: string, at: string): DiscussionMessage => ({
      id,
      discussion_id: "t1",
      project_id: "p1",
      author_id: author,
      body: id,
      created_at: at,
    });

    const summary = changesSince({
      ...EMPTY,
      since: "2026-09-05T00:00:00.000Z",
      asOf: ASOF,
      slug: "k",
      viewerId: "buyer",
      updates: [],
      discussions: [thread],
      messages: [
        message("mine", "buyer", "2026-09-09T00:00:00.000Z"),
        message("theirs-early", "builder", "2026-09-06T00:00:00.000Z"),
        message("theirs-late", "builder", "2026-09-08T00:00:00.000Z"),
      ],
    });

    // One entry per thread, the latest reply from someone else.
    expect(summary.items).toHaveLength(1);
    expect(summary.items[0]!.id).toBe("theirs-late");
  });

  it("reports a decision only when it has newly become urgent", () => {
    const summary = changesSince({
      ...EMPTY,
      since: "2026-09-01T00:00:00.000Z",
      asOf: ASOF,
      slug: "k",
      viewerId: "buyer",
      updates: [],
      selections: [
        // 5 days left now, 14 at the last visit: newly urgent.
        selectionView("new-urgent", "urgent", 5),
        // Overdue now, and was already inside the window last time.
        selectionView("old-news", "overdue", -10),
      ],
    });
    expect(summary.items.map((i) => i.id)).toEqual(["new-urgent"]);
  });

  it("sorts newest first and counts by kind", () => {
    const summary = changesSince({
      ...EMPTY,
      since: "2026-09-01T00:00:00.000Z",
      asOf: ASOF,
      slug: "k",
      viewerId: "buyer",
      updates: [update("a", "2026-09-03T00:00:00.000Z"), update("b", "2026-09-07T00:00:00.000Z")],
      issues: [issue("snag", { created_at: "2026-09-05T00:00:00.000Z", raised_by_buyer: true })],
    });
    expect(summary.items.map((i) => i.id)).toEqual(["b", "snag", "a"]);
    expect(summary.counts.update).toBe(2);
    expect(summary.counts.issue).toBe(1);
    expect(summary.items[1]!.title).toContain("Your snag");
  });
});

/* ------------------------------------------------------------ delay tests */

describe("explainDelay", () => {
  const roof = milestone("roof", { planned_start: "2026-07-01", planned_end: "2026-07-20" });
  const windows = milestone("windows", {
    name: "Windows",
    planned_start: "2026-07-21",
    planned_end: "2026-08-10",
    status: "blocked",
  });
  const paint = milestone("paint", { planned_start: "2026-07-21", planned_end: "2026-07-25" });
  const schedule = computeSchedule(
    [roof, windows, paint],
    [
      { predecessor_id: "roof", successor_id: "windows", type: "FS", lag_days: 0 },
      { predecessor_id: "roof", successor_id: "paint", type: "FS", lag_days: 0 },
    ],
  );

  const weather: WeatherLogEntry[] = ["2026-04-01", "2026-04-02", "2026-04-03"].map((d, i) => ({
    id: `w${i}`,
    project_id: "p1",
    observed_on: d,
    condition: "Heavy rain",
    temp_c: 10,
    precipitation_mm: 20,
    wind_kph: 10,
    work_impact: i === 2 ? "partial" : "full",
    hours_lost: 8,
    created_at: "2026-01-01T00:00:00.000Z",
  }));

  const changeOrder: ChangeOrder = {
    id: "co",
    project_id: "p1",
    number: "CO-002",
    title: "Kitchen upgrade",
    description: null,
    cost_delta: 14500,
    schedule_delta_days: 6,
    status: "approved",
    requested_by: null,
    decided_by: null,
    decided_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };

  const baseInput = {
    project: { target_completion_date: "2027-03-06", start_date: "2026-01-20", name: "Kestrel" },
    schedule,
    milestones: [roof, windows, paint],
    weather,
    changeOrders: [changeOrder],
    issues: [] as Issue[],
    selections: [] as SelectionView[],
    asOf: ASOF,
    slug: "k",
  };

  it("stays quiet within the noise threshold", () => {
    const result = explainDelay({ ...baseInput, forecast: forecast(2) });
    expect(result.isSlipping).toBe(false);
    expect(result.reasons).toHaveLength(0);
  });

  it("says so when the build is ahead", () => {
    const result = explainDelay({ ...baseInput, forecast: forecast(-12) });
    expect(result.headline).toContain("12 days ahead");
  });

  it("gathers weather, change orders and blocked critical work", () => {
    const result = explainDelay({ ...baseInput, forecast: forecast(28) });
    expect(result.isSlipping).toBe(true);

    const kinds = result.reasons.map((r) => r.kind);
    expect(kinds).toContain("weather");
    expect(kinds).toContain("change_order");
    expect(kinds).toContain("blocked");

    const weatherReason = result.reasons.find((r) => r.kind === "weather")!;
    // Two full days and one partial.
    expect(weatherReason.detail).toContain("2.5 days");

    const blocked = result.reasons.find((r) => r.kind === "blocked")!;
    expect(blocked.critical).toBe(true);
  });

  it("puts critical-path factors first", () => {
    const result = explainDelay({ ...baseInput, forecast: forecast(28) });
    const firstNonCritical = result.reasons.findIndex((r) => !r.critical);
    const lastCritical = result.reasons.map((r) => r.critical).lastIndexOf(true);
    if (firstNonCritical !== -1) expect(lastCritical).toBeLessThan(firstNonCritical);
  });

  it("links a blocked milestone to the issue that blocks it", () => {
    const result = explainDelay({
      ...baseInput,
      forecast: forecast(28),
      issues: [
        issue("Dormer units short-delivered", { milestone_id: "windows", severity: "high" }),
      ],
    });
    const blocked = result.reasons.find((r) => r.kind === "blocked")!;
    expect(blocked.detail).toContain("Dormer units short-delivered");
    // And the issue is not listed a second time on its own.
    expect(result.reasons.filter((r) => r.kind === "issue")).toHaveLength(0);
  });

  it("always carries the caveat", () => {
    expect(explainDelay({ ...baseInput, forecast: forecast(28) }).caveat).toContain("trend");
  });
});

/* ---------------------------------------------------------- move-in tests */

describe("buildMovePlan", () => {
  it("dates every task relative to the anchor", () => {
    const plan = buildMovePlan({ anchorDate: "2026-12-01", asOf: ASOF, records: [] });
    const removals = plan.tasks.find((t) => t.key === "book-removals")!;
    expect(removals.dueDate).toBe("2026-10-20"); // 42 days before
    expect(plan.total).toBe(MOVE_TEMPLATE.length);
  });

  it("moves every date when the anchor moves -- the point of anchoring to the forecast", () => {
    const early = buildMovePlan({ anchorDate: "2026-12-01", asOf: ASOF, records: [] });
    const late = buildMovePlan({ anchorDate: "2026-12-29", asOf: ASOF, records: [] });
    for (const task of early.tasks) {
      const moved = late.tasks.find((t) => t.key === task.key)!;
      expect(moved.dueDate).toBe(addDays(task.dueDate, 28));
    }
  });

  it("classifies tasks as done, overdue, due soon or upcoming", () => {
    const records: MoveTask[] = [
      {
        id: "r1",
        project_id: "p1",
        user_id: "buyer",
        template_key: "school-places",
        title: null,
        category: null,
        days_before: null,
        done_at: "2026-09-01T00:00:00.000Z",
        created_at: "2026-09-01T00:00:00.000Z",
      },
    ];
    // Anchor 50 days out: 60-day tasks are overdue, 45-day tasks are due soon.
    const plan = buildMovePlan({ anchorDate: addDays("2026-09-10", 50), asOf: ASOF, records });

    expect(plan.tasks.find((t) => t.key === "school-places")!.state).toBe("done");
    expect(plan.tasks.find((t) => t.key === "notice-current-home")!.state).toBe("overdue");
    expect(plan.tasks.find((t) => t.key === "mortgage-drawdown")!.state).toBe("due-soon");
    expect(plan.tasks.find((t) => t.key === "broadband")!.state).toBe("upcoming");
    expect(plan.done).toBe(1);
  });

  it("includes tasks the buyer added, and picks the earliest open task as next", () => {
    const plan = buildMovePlan({
      anchorDate: "2026-12-01",
      asOf: ASOF,
      records: [
        {
          id: "custom-1",
          project_id: "p1",
          user_id: "buyer",
          template_key: null,
          title: "Book the piano movers",
          category: "Moving",
          days_before: 100,
          done_at: null,
          created_at: "2026-09-01T00:00:00.000Z",
        },
      ],
    });
    expect(plan.tasks.some((t) => t.isCustom && t.title === "Book the piano movers")).toBe(true);
    expect(plan.next?.title).toBe("Book the piano movers");
  });

  it("groups tasks into windows in chronological order", () => {
    const plan = buildMovePlan({ anchorDate: "2026-12-01", asOf: ASOF, records: [] });
    expect(plan.windows.map((w) => w.label)).toEqual([
      "Two months or more before",
      "About a month before",
      "The last few weeks",
      "Handover day",
      "After you move in",
    ]);
  });
});

/* ----------------------------------------------------------- digest tests */

describe("composeDigest", () => {
  const snap = (day: string, actual: number): ProgressSnapshot => ({
    id: day,
    project_id: "p1",
    captured_on: day,
    planned_percent: actual + 3,
    actual_percent: actual,
    note: null,
    created_at: `${day}T00:00:00.000Z`,
  });

  const quiet = {
    isSlipping: false,
    slipDays: 0,
    targetDate: null,
    forecastDate: null,
    headline: "",
    reasons: [],
    caveat: "",
  };

  const base = {
    projectName: "Kestrel House",
    slug: "k",
    currency: "USD",
    asOf: ASOF,
    updates: [] as Update[],
    milestones: [] as Milestone[],
    payments: [],
    issues: [] as Issue[],
    selections: [] as SelectionView[],
    delay: quiet,
  };

  it("reports the week's progress as a before-and-after", () => {
    const digest = composeDigest({
      ...base,
      snapshots: [snap("2026-09-01", 52), snap("2026-09-03", 53.1), snap("2026-09-10", 55.4)],
    });
    expect(digest.progressBefore).toBe(53.1);
    expect(digest.progressNow).toBe(55.4);
    expect(digest.headline).toContain("from 53.1% to 55.4%");
  });

  it("says plainly when nothing moved", () => {
    const digest = composeDigest({
      ...base,
      snapshots: [snap("2026-09-03", 55.4), snap("2026-09-10", 55.4)],
    });
    expect(digest.headline).toContain("No measurable progress");
  });

  it("puts decisions that need action at the top", () => {
    const digest = composeDigest({
      ...base,
      snapshots: [snap("2026-09-10", 55)],
      updates: [update("u", "2026-09-08T10:00:00.000Z")],
      selections: [selectionView("Worktop", "urgent", 5)],
    });
    expect(digest.sections[0]!.title).toBe("Decisions you need to make");
    expect(digest.sections[0]!.actionRequired).toBe(true);
  });

  it("renders a plain-text body with absolute links", () => {
    const digest = composeDigest({
      ...base,
      snapshots: [snap("2026-09-10", 55)],
      selections: [selectionView("Worktop", "urgent", 5)],
    });
    const text = digestToText(digest, "https://kestrel.example");
    expect(text).toContain("DECISIONS YOU NEED TO MAKE (action needed)");
    expect(text).toContain("https://kestrel.example/projects/k/selections#Worktop");
  });
});
