import "server-only";

import type { Workspace } from "@/lib/data/workspace";
import { rollUpBudget, contractPosition, summarisePayments } from "@/lib/domain/finance";
import { forecastCompletion, scoreHealth } from "@/lib/domain/forecast";
import { computeSchedule, expectedProgress, slippageDays } from "@/lib/domain/schedule";
import { formatPriceDelta, summariseSelections, viewSelections } from "@/lib/domain/selections";
import { formatInZone } from "@/lib/domain/visits";
import { formatCurrency, formatDate } from "@/lib/format";
import { sumBy } from "@/lib/utils";
import type { AiCitation, Milestone, Update } from "@/types/database";

/** The tables the assistant's grounding reads. */
export const ASSISTANT_TABLES = [
  "milestones",
  "dependencies",
  "phases",
  "snapshots",
  "budgetCategories",
  "costEntries",
  "changeOrders",
  "payments",
  "issues",
  "inspections",
  "weather",
  "selectionCategories",
  "selectionOptions",
  "siteVisits",
  "documents",
] as const;

/** How many recent updates the grounding quotes. */
export const ASSISTANT_RECENT_UPDATES = 8;

/** Everything the assistant is grounded in: the tables above plus the latest updates. */
export type AssistantWorkspace = Workspace<(typeof ASSISTANT_TABLES)[number]> & {
  updates: readonly Update[];
};

/**
 * Hard ceiling on the grounding, in characters -- roughly a quarter as many
 * tokens. Every list below is already capped; this is the backstop that keeps
 * the size of a model call, and so its cost and latency, flat however large a
 * project grows.
 */
export const MAX_CONTEXT_CHARS = 48_000;

/**
 * Lists longer than this are summarised: the rows a buyer is most likely to
 * ask about, then a count of the rest and where to find them. A typical house
 * fits under every cap, so its grounding is complete.
 */
const LIST_CAP = {
  milestones: 40,
  changeOrders: 25,
  issues: 30,
  inspections: 20,
  selections: 40,
  visits: 10,
  documents: 25,
} as const;

const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/**
 * Build the grounding context for the assistant.
 *
 * This is a compact, factual digest of the project rather than a dump of every
 * row. Two reasons: the model answers better from a structured summary than
 * from raw JSON, and every fact here is one the UI also displays, so the
 * assistant cannot contradict the dashboard sitting next to it.
 *
 * Anything the assistant is allowed to assert must appear in this string. That
 * is the whole mechanism preventing it from inventing a completion date.
 */
export function buildProjectContext(w: AssistantWorkspace): {
  context: string;
  citations: AiCitation[];
} {
  const now = new Date(w.now);
  const today = w.now.slice(0, 10);
  const currency = w.project.currency;
  const citations: AiCitation[] = [];

  const totalWeight = sumBy(w.milestones, (m) => m.weight);
  const progress =
    totalWeight > 0 ? sumBy(w.milestones, (m) => m.progress_percent * m.weight) / totalWeight : 0;

  const latest = w.snapshots[w.snapshots.length - 1];
  const planned = latest?.planned_percent ?? 0;

  const schedule = computeSchedule(w.milestones, w.dependencies);
  const budget = rollUpBudget(w.budgetCategories, w.costEntries);
  const contract = contractPosition(w.project, w.changeOrders);
  const payments = summarisePayments(w.payments, now);
  const forecast = forecastCompletion(w.snapshots, w.project.target_completion_date, { asOf: now });

  const openIssues = w.issues.filter(
    (i) => i.status === "open" || i.status === "acknowledged" || i.status === "in_progress",
  );

  const health = scoreHealth({
    scheduleVariance: progress - planned,
    costVariance: budget.remaining,
    budgetTotal: budget.budgeted,
    openIssues,
    weather: w.weather,
    asOf: now,
  });

  const lines: string[] = [];

  lines.push(`# Project: ${w.project.name}`);
  lines.push(`Today's date: ${today}`);
  lines.push(
    `Address: ${w.project.address_line1}, ${w.project.city}${w.project.state ? `, ${w.project.state}` : ""}`,
  );
  lines.push(
    `Builder: ${w.organization?.name ?? "unknown"}. Architect: ${w.project.architect_name ?? "unknown"}.`,
  );
  lines.push(`Site manager: ${w.project.site_manager_name ?? "unknown"}.`);
  lines.push(
    `Specification: ${w.project.unit_type ?? "home"}, ${w.project.bedrooms ?? "?"} bedrooms, ${w.project.bathrooms ?? "?"} bathrooms, ${w.project.floor_area_sqft ?? "?"} sq ft.`,
  );
  lines.push(`Status: ${w.project.status}. Started ${w.project.start_date}.`);
  citations.push({ kind: "project", id: w.project.id, label: w.project.name });

  lines.push("");
  lines.push("## Schedule");
  lines.push(
    `Weighted completion: ${progress.toFixed(1)}%. Plan expects ${planned.toFixed(1)}% by today.`,
  );
  lines.push(
    `Schedule variance: ${(progress - planned).toFixed(1)} percentage points (negative = behind).`,
  );
  lines.push(`Contract completion date: ${w.project.target_completion_date}.`);
  if (forecast.projectedDate) {
    lines.push(
      `Forecast completion: ${forecast.projectedDate} (range ${forecast.earliestDate} to ${forecast.latestDate}, ${forecast.confidence} confidence, r-squared ${forecast.rSquared.toFixed(2)}).`,
    );
    if (forecast.slipDays != null) {
      lines.push(
        `Forecast is ${Math.abs(forecast.slipDays)} days ${forecast.slipDays > 0 ? "later than" : "ahead of"} the contract date.`,
      );
    }
  } else {
    lines.push("Forecast completion: not enough progress history to project a date.");
  }
  lines.push(`Health score: ${health.score}/100 (${health.grade}).`);
  for (const factor of health.factors) {
    lines.push(`  - ${factor.label}: ${factor.detail} (${factor.impact.toFixed(1)} points)`);
  }

  lines.push("");
  lines.push("## Milestones");
  const completed = w.milestones.filter((m) => m.status === "completed").length;
  const underway = w.milestones.filter((m) => m.status === "in_progress").length;
  const blocked = w.milestones.filter((m) => m.status === "blocked").length;
  lines.push(
    `${completed} of ${w.milestones.length} completed; ${underway} in progress; ${blocked} blocked.`,
  );

  // Past the cap, order by what a buyer asks about: work in trouble or under
  // way, then what is next, then what is finished.
  const rank = (m: Milestone) => {
    if (m.status === "blocked") return 0;
    if (m.status === "in_progress") return 1;
    const finished = m.status === "completed" || m.status === "cancelled";
    if (!finished && slippageDays(m, now) > 0) return 2;
    if (!finished) return 3;
    return 4;
  };
  const milestones =
    w.milestones.length <= LIST_CAP.milestones
      ? w.milestones
      : [...w.milestones].sort(
          (a, b) =>
            rank(a) - rank(b) ||
            // Among finished work the most recent matters most; elsewhere, the soonest.
            (rank(a) === 4
              ? b.planned_end.localeCompare(a.planned_end)
              : a.planned_start.localeCompare(b.planned_start)),
        );
  for (const milestone of milestones.slice(0, LIST_CAP.milestones)) {
    const task = schedule.tasks.get(milestone.id);
    const slip = slippageDays(milestone, now);
    const phase = w.phases.find((p) => p.id === milestone.phase_id);
    const parts = [
      `${milestone.name} [${phase?.name ?? "unassigned"}]`,
      `status=${milestone.status}`,
      `progress=${milestone.progress_percent}%`,
      `planned=${milestone.planned_start}..${milestone.planned_end}`,
    ];
    if (task) {
      parts.push(task.isCritical ? "CRITICAL PATH (no float)" : `float=${task.totalFloat}d`);
    }
    if (milestone.status !== "completed" && milestone.status !== "not_started") {
      parts.push(`expected_today=${expectedProgress(milestone, now)}%`);
    }
    if (slip > 0) parts.push(`OVERDUE by ${slip}d`);
    lines.push(`- ${parts.join(", ")}`);
    if (milestone.status === "in_progress" || milestone.status === "blocked") {
      citations.push({ kind: "milestone", id: milestone.id, label: milestone.name });
    }
  }
  more(
    lines,
    milestones.length,
    LIST_CAP.milestones,
    "milestones, finished or further out",
    "Timeline",
  );

  lines.push("");
  lines.push("## Money");
  lines.push(
    `Original contract ${formatCurrency(contract.original, currency)}; approved changes ${formatCurrency(contract.approvedChanges, currency)}; revised contract ${formatCurrency(contract.revised, currency)}.`,
  );
  lines.push(
    `Pending (undecided) change orders total ${formatCurrency(contract.pendingChanges, currency)}.`,
  );
  lines.push(
    `Budget ${formatCurrency(budget.budgeted, currency)}; spent ${formatCurrency(budget.actual, currency)}; committed ${formatCurrency(budget.committed, currency)}; remaining ${formatCurrency(budget.remaining, currency)}.`,
  );
  for (const category of budget.categories) {
    lines.push(
      `  - ${category.name}: budget ${formatCurrency(category.budgeted, currency)}, spent ${formatCurrency(category.actual, currency)}, committed ${formatCurrency(category.committed, currency)}${category.isOverBudget ? " -- OVER BUDGET" : ""}`,
    );
  }
  lines.push(
    `Payments: ${formatCurrency(payments.paid, currency)} paid of ${formatCurrency(payments.total, currency)}; ${formatCurrency(payments.outstanding, currency)} outstanding; ${payments.overdueCount} overdue.`,
  );
  if (payments.nextDue) {
    lines.push(
      `Next payment due: ${payments.nextDue.name}, ${formatCurrency(payments.nextDue.amount, currency)}, due ${payments.nextDue.due_date}.`,
    );
    citations.push({ kind: "payment", id: payments.nextDue.id, label: payments.nextDue.name });
  }

  lines.push("");
  lines.push("## Change orders (most recent first)");
  for (const order of w.changeOrders.slice(0, LIST_CAP.changeOrders)) {
    lines.push(
      `- ${order.number} "${order.title}": ${order.status}, cost ${formatCurrency(order.cost_delta, currency)}, schedule ${order.schedule_delta_days}d. ${order.description ?? ""}`,
    );
  }
  more(lines, w.changeOrders.length, LIST_CAP.changeOrders, "older change orders", "Finance");

  lines.push("");
  lines.push("## Open issues (most severe first)");
  if (openIssues.length === 0) {
    lines.push("None.");
  } else {
    const bySeverity = [...openIssues].sort(
      (a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9),
    );
    for (const issue of bySeverity.slice(0, LIST_CAP.issues)) {
      lines.push(
        `- [${issue.severity}] ${issue.title} (${issue.status}${issue.due_date ? `, due ${issue.due_date}` : ""}) at ${issue.location ?? "unspecified location"}. ${issue.description ?? ""}`,
      );
      citations.push({ kind: "issue", id: issue.id, label: issue.title });
    }
    more(lines, bySeverity.length, LIST_CAP.issues, "less severe open issues", "Quality");
  }

  lines.push("");
  lines.push("## Inspections (upcoming, then most recent)");
  const upcoming = w.inspections.filter((i) => (i.scheduled_for ?? "") >= today);
  const past = w.inspections.filter((i) => (i.scheduled_for ?? "") < today).reverse();
  const inspections = [...upcoming, ...past];
  for (const inspection of inspections.slice(0, LIST_CAP.inspections)) {
    lines.push(
      `- ${inspection.name} (${inspection.authority ?? "n/a"}): ${inspection.result}${inspection.scheduled_for ? `, ${inspection.scheduled_for}` : ""}`,
    );
  }
  more(lines, inspections.length, LIST_CAP.inspections, "older inspections", "Quality");

  lines.push("");
  lines.push("## Recent site updates (most recent first)");
  for (const update of w.updates.slice(0, ASSISTANT_RECENT_UPDATES)) {
    lines.push(
      `- ${update.published_at.slice(0, 10)} "${update.title}" [${update.status}] crew=${update.crew_size ?? "?"} hours=${update.hours_worked ?? "?"} weather=${update.weather ?? "?"}: ${update.body}`,
    );
    citations.push({ kind: "update", id: update.id, label: update.title });
  }

  lines.push("");
  lines.push("## Weather (last 30 days, days that affected work)");
  const disrupted = w.weather.slice(0, 30).filter((entry) => entry.work_impact !== "none");
  if (disrupted.length === 0) {
    lines.push("No weather disruption.");
  } else {
    for (const entry of disrupted) {
      lines.push(
        `- ${entry.observed_on}: ${entry.condition}, ${entry.work_impact} stoppage, ${entry.hours_lost}h lost`,
      );
    }
  }

  const selections = viewSelections(w.selectionCategories, w.selectionOptions, w.milestones, now);
  const selectionSummary = summariseSelections(selections);
  lines.push("");
  lines.push("## Finish selections (the buyer's decisions, open ones first)");
  lines.push(
    `${selectionSummary.decided} of ${selectionSummary.total} decided; choices so far ${formatPriceDelta(selectionSummary.budgetImpact, currency)} against the standard specification. A deadline is when the linked work starts, less the longest supplier lead time; missing it delays that work.`,
  );
  const isOpen = (view: (typeof selections)[number]) =>
    view.urgency !== "chosen" && view.urgency !== "locked";
  const orderedSelections = [
    ...selections.filter(isOpen),
    ...selections.filter((view) => !isOpen(view)),
  ];
  for (const view of orderedSelections.slice(0, LIST_CAP.selections)) {
    const open = isOpen(view);
    const state = open
      ? `OPEN, deadline ${view.deadline ?? "not set"}${view.daysLeft != null && view.daysLeft < 0 ? ` (OVERDUE by ${-view.daysLeft}d)` : ""}`
      : `${view.urgency}: ${view.chosen?.name ?? "standard option"}`;
    lines.push(`- ${view.category.name}: ${state}. ${view.consequence}`);
    if (open)
      citations.push({ kind: "selection", id: view.category.id, label: view.category.name });
  }
  more(lines, orderedSelections.length, LIST_CAP.selections, "decided selections", "Selections");

  lines.push("");
  lines.push("## Site visits");
  const liveVisits = w.siteVisits.filter(
    (v) => v.status === "requested" || v.status === "confirmed",
  );
  if (liveVisits.length === 0) {
    lines.push("None booked.");
  } else {
    for (const visit of liveVisits.slice(0, LIST_CAP.visits)) {
      lines.push(
        `- ${formatInZone(visit.starts_at, w.project.timezone, "full")} site time: ${visit.purpose}, ${visit.status}`,
      );
    }
    more(lines, liveVisits.length, LIST_CAP.visits, "later visits", "Site visits");
  }
  lines.push(
    "Visits are escorted, run at set times, need 48 hours' notice, and are booked on the Site visits page.",
  );

  lines.push("");
  lines.push("## Documents available (needing acknowledgement first, then newest)");
  const shared = w.documents.filter((d) => !d.is_confidential);
  const documents = [
    ...shared.filter((d) => d.requires_ack),
    ...shared.filter((d) => !d.requires_ack),
  ];
  for (const doc of documents.slice(0, LIST_CAP.documents)) {
    lines.push(
      `- ${doc.name} (${doc.category}${doc.issued_at ? `, issued ${formatDate(doc.issued_at)}` : ""})${doc.requires_ack ? " -- NEEDS BUYER ACKNOWLEDGEMENT" : ""}`,
    );
  }
  more(lines, documents.length, LIST_CAP.documents, "older documents", "Documents");

  let context = lines.join("\n");
  if (context.length > MAX_CONTEXT_CHARS) {
    // Sections run from most to least asked-about, so the cut falls on the tail.
    const cut = context.lastIndexOf("\n", MAX_CONTEXT_CHARS - 200);
    context = `${context.slice(0, cut)}\n\n[The rest of the project record was left out to keep this summary short. If a question needs it, name the page of the platform that holds it.]`;
  }

  return { context, citations };
}

/** "...and 12 more older documents; the Documents page lists every one." */
function more(lines: string[], total: number, cap: number, what: string, page: string): void {
  if (total > cap) {
    lines.push(`- ...and ${total - cap} more ${what}; the ${page} page lists every one.`);
  }
}

export const SYSTEM_PROMPT = `You are the assistant inside a construction project platform, answering questions from the person whose home is being built.

You are given a factual digest of their project below. Everything you assert must come from it.

Rules:
- Answer only from the project context. If the context does not contain the answer, say plainly that the platform does not hold that information and suggest who to ask (usually the site manager).
- Never invent dates, amounts, names or reasons. Never estimate a completion date yourself -- if asked, quote the forecast in the context, including its range and confidence, and say it is a projection from recent progress rather than a commitment.
- Be direct and concrete. Lead with the answer, then the reasoning. Two or three short paragraphs at most; use a short list when genuinely enumerating things.
- Write for someone who is not a construction professional. Explain a term the first time you use it ("float -- the spare time a task has before it delays the finish").
- Do not be reassuring at the expense of being accurate. If the project is behind, say so and say by how much.
- Do not speculate about blame, contractual liability, or what the builder "should" do. Report what the records show.
- Currency amounts should be written the way they appear in the context.`;
