import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { buildProjectContext, SYSTEM_PROMPT, type AssistantWorkspace } from "@/lib/ai/context";
import { rollUpBudget, summarisePayments } from "@/lib/domain/finance";
import { forecastCompletion } from "@/lib/domain/forecast";
import { computeSchedule, slippageDays } from "@/lib/domain/schedule";
import { formatPriceDelta, summariseSelections, viewSelections } from "@/lib/domain/selections";
import { availableSlots, DEFAULT_VISIT_RULES, formatInZone } from "@/lib/domain/visits";
import { formatCurrency, formatDate } from "@/lib/format";
import { logError } from "@/lib/log";
import { sumBy } from "@/lib/utils";
import type { AiCitation } from "@/types/database";

export interface AssistantAnswer {
  content: string;
  citations: AiCitation[];
  /** Whether a model produced this, or the built-in retrieval fallback did. */
  source: "model" | "local";
}

/**
 * Answer a question about the project.
 *
 * With ANTHROPIC_API_KEY set, this asks Claude with the project digest as
 * grounding. Without one, it falls back to a deterministic responder that
 * matches the question against a small set of intents and answers from the same
 * data.
 *
 * The fallback is not a stub. It exists because a construction platform whose
 * help feature dies the moment a key is missing is worse than one that answers
 * the ten questions buyers actually ask, and because it makes the demo
 * genuinely usable with zero configuration.
 */
export async function answerQuestion(
  question: string,
  workspace: AssistantWorkspace,
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
): Promise<AssistantAnswer> {
  const { context, citations } = buildProjectContext(workspace);
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return { ...localAnswer(question, workspace), source: "local" };
  }

  try {
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-opus-5",
      max_tokens: 1024,
      system: `${SYSTEM_PROMPT}\n\n---\n\n${context}`,
      messages: [
        ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: question },
      ],
    });

    const content = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    if (!content) {
      return { ...localAnswer(question, workspace), source: "local" };
    }

    // Only cite things the answer actually mentions, so the citation strip
    // reflects the answer rather than the whole project.
    const mentioned = citations.filter((citation) =>
      content.toLowerCase().includes(citation.label.toLowerCase().slice(0, 18)),
    );

    return { content, citations: mentioned.slice(0, 5), source: "model" };
  } catch (error) {
    logError("assistant_model_failed", error, { fallback: "local" });
    return { ...localAnswer(question, workspace), source: "local" };
  }
}

/* -------------------------------------------------------------------------- */
/* Local fallback                                                             */
/* -------------------------------------------------------------------------- */

type Intent =
  | "schedule"
  | "delay"
  | "cost"
  | "payment"
  | "issues"
  | "next"
  | "documents"
  | "weather"
  | "who"
  | "decisions"
  | "visit"
  | "unknown";

function classify(question: string): Intent {
  const q = question.toLowerCase();
  const has = (...words: string[]) => words.some((w) => q.includes(w));

  if (has("late", "delay", "behind", "slip", "pushed", "moved")) return "delay";
  // Before schedule and payment: "when is my tile decision due" is about the
  // decision, not the handover date or an invoice.
  if (
    has(
      "decide",
      "decision",
      "choose",
      "choice",
      "selection",
      "tile",
      "flooring",
      "colour",
      "color",
    )
  )
    return "decisions";
  if (has("visit", "see the house", "look round", "look around", "come to site", "come and see"))
    return "visit";
  if (has("finish", "complete", "done", "handover", "move in", "ready", "when will"))
    return "schedule";
  if (has("cost", "budget", "over", "spend", "spent", "price", "expensive")) return "cost";
  if (has("pay", "payment", "invoice", "due", "owe", "instal")) return "payment";
  if (has("issue", "problem", "defect", "snag", "wrong", "fault")) return "issues";
  if (has("next", "happening", "now", "currently", "this week")) return "next";
  if (has("document", "permit", "certificate", "drawing", "contract", "warranty"))
    return "documents";
  if (has("weather", "rain", "storm", "wet")) return "weather";
  if (has("who", "contact", "manager", "builder", "architect", "phone")) return "who";
  return "unknown";
}

function localAnswer(
  question: string,
  w: AssistantWorkspace,
): { content: string; citations: AiCitation[] } {
  const now = new Date(w.now);
  const currency = w.project.currency;
  const citations: AiCitation[] = [];

  const totalWeight = sumBy(w.milestones, (m) => m.weight);
  const progress =
    totalWeight > 0 ? sumBy(w.milestones, (m) => m.progress_percent * m.weight) / totalWeight : 0;
  const planned = w.snapshots[w.snapshots.length - 1]?.planned_percent ?? 0;
  const variance = progress - planned;

  const schedule = computeSchedule(w.milestones, w.dependencies);
  const forecast = forecastCompletion(w.snapshots, w.project.target_completion_date, { asOf: now });
  const budget = rollUpBudget(w.budgetCategories, w.costEntries);
  const payments = summarisePayments(w.payments, now);

  const openIssues = w.issues.filter(
    (i) => i.status === "open" || i.status === "acknowledged" || i.status === "in_progress",
  );
  const active = w.milestones.filter((m) => m.status === "in_progress");
  const blocked = w.milestones.filter((m) => m.status === "blocked");

  switch (classify(question)) {
    case "schedule": {
      citations.push({ kind: "project", id: w.project.id, label: w.project.name });
      const body = [
        `Your build is ${progress.toFixed(1)}% complete. The programme expects ${planned.toFixed(1)}% by today, so it is ${Math.abs(variance).toFixed(1)} points ${variance < 0 ? "behind" : "ahead of"} plan.`,
      ];
      if (forecast.projectedDate) {
        body.push(
          `The contract completion date is ${formatDate(w.project.target_completion_date)}. Projecting the recent rate of progress forward gives ${formatDate(forecast.projectedDate)}, most likely somewhere between ${formatDate(forecast.earliestDate)} and ${formatDate(forecast.latestDate)}. That is ${forecast.confidence} confidence — it is a trend line through the last ${forecast.sampleSize} readings, not a commitment from your builder.`,
        );
      } else {
        body.push(
          `The contract completion date is ${formatDate(w.project.target_completion_date)}. There is not yet enough progress history to project a date independently.`,
        );
      }
      return { content: body.join("\n\n"), citations };
    }

    case "delay": {
      const reasons: string[] = [];

      const wetDays = w.weather
        .slice(0, 60)
        .filter((e) => e.work_impact !== "none")
        .reduce((t, e) => t + (e.work_impact === "full" ? 1 : 0.5), 0);
      if (wetDays > 0) {
        reasons.push(
          `Weather has cost about ${wetDays % 1 === 0 ? wetDays : wetDays.toFixed(1)} working days in the last two months.`,
        );
      }

      for (const milestone of blocked) {
        const task = schedule.tasks.get(milestone.id);
        reasons.push(
          `"${milestone.name}" is blocked${task?.isCritical ? ", and it sits on the critical path — so that delay passes straight through to the finish date" : `, though it has ${task?.totalFloat ?? 0} days of float to absorb some of it`}.`,
        );
        citations.push({ kind: "milestone", id: milestone.id, label: milestone.name });
      }

      const overdue = w.milestones
        .map((m) => ({ m, slip: slippageDays(m, now) }))
        .filter((e) => e.slip > 0 && e.m.status !== "completed")
        .sort((a, b) => b.slip - a.slip)
        .slice(0, 2);
      for (const { m, slip } of overdue) {
        reasons.push(`"${m.name}" is ${slip} days past its planned finish.`);
      }

      const highIssues = openIssues.filter(
        (i) => i.severity === "high" || i.severity === "critical",
      );
      for (const issue of highIssues.slice(0, 2)) {
        reasons.push(`Open ${issue.severity}-severity issue: ${issue.title}.`);
        citations.push({ kind: "issue", id: issue.id, label: issue.title });
      }

      if (reasons.length === 0) {
        return {
          content: `Nothing in the records is currently holding the build up. Progress is ${progress.toFixed(1)}% against a planned ${planned.toFixed(1)}%, and no milestones are blocked or overdue.`,
          citations,
        };
      }

      return {
        content: `The build is ${Math.abs(variance).toFixed(1)} points ${variance < 0 ? "behind" : "ahead of"} plan. What the records show:\n\n${reasons.map((r) => `• ${r}`).join("\n")}`,
        citations,
      };
    }

    case "decisions": {
      const views = viewSelections(w.selectionCategories, w.selectionOptions, w.milestones, now);
      const summary = summariseSelections(views);
      const open = views.filter((v) => v.urgency !== "chosen" && v.urgency !== "locked");
      for (const v of open.slice(0, 5)) {
        citations.push({ kind: "selection", id: v.category.id, label: v.category.name });
      }

      if (open.length === 0) {
        return {
          content: `All ${summary.total} of your finish choices are made${summary.budgetImpact !== 0 ? `, coming to ${formatPriceDelta(summary.budgetImpact, currency)} against the standard specification` : ""}. There is nothing left to decide.`,
          citations,
        };
      }

      const lines = open.slice(0, 5).map((v) => {
        const when =
          v.daysLeft == null
            ? "no deadline set yet"
            : v.daysLeft < 0
              ? `${-v.daysLeft} days overdue`
              : v.daysLeft === 0
                ? "due today"
                : `due ${formatDate(v.deadline)} (${v.daysLeft} days)`;
        return `• ${v.category.name} — ${when}. ${v.consequence}`;
      });

      return {
        content: `You have ${open.length} finish decision${open.length === 1 ? "" : "s"} still to make (${summary.decided} of ${summary.total} done). Most pressing first:\n\n${lines.join("\n")}\n\nEach deadline is when the work that needs the choice starts, less the supplier's lead time — so a late decision holds up that work, not just the paperwork. Everything is on the Selections page.`,
        citations,
      };
    }

    case "visit": {
      const timeZone = w.project.timezone;
      const upcoming = w.siteVisits
        .filter(
          (v) => (v.status === "requested" || v.status === "confirmed") && v.starts_at >= w.now,
        )
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      const slots = availableSlots({ asOf: now, timeZone, existing: w.siteVisits }).slice(0, 3);

      const body: string[] = [];
      if (upcoming.length > 0) {
        body.push(
          `You have ${upcoming.length === 1 ? "a visit" : `${upcoming.length} visits`} booked:\n\n${upcoming
            .map(
              (v) =>
                `• ${formatInZone(v.starts_at, timeZone, "full")} — ${v.purpose}, ${v.status === "confirmed" ? "confirmed" : "awaiting the site manager's confirmation"}`,
            )
            .join("\n")}`,
        );
      }
      body.push(
        slots.length > 0
          ? `The next free sessions are ${slots.map((s) => formatInZone(s.startsAt, timeZone, "full")).join("; ")}. Visits are escorted, need ${DEFAULT_VISIT_RULES.minNoticeHours} hours' notice, and are booked from the Site visits page.`
          : "There are no free sessions in the next three weeks. Ask the site manager through Questions and they will find you a time.",
      );
      return { content: body.join("\n\n"), citations };
    }

    case "cost": {
      const over = budget.categories.filter((c) => c.isOverBudget);
      const body = [
        `Your revised contract value is ${formatCurrency(
          w.project.contract_value +
            sumBy(
              w.changeOrders.filter((c) => c.status === "approved"),
              (c) => c.cost_delta,
            ),
          currency,
        )}. Against the build budget of ${formatCurrency(budget.budgeted, currency)}, ${formatCurrency(budget.actual, currency)} has been spent and a further ${formatCurrency(budget.committed, currency)} is committed — ordered but not yet invoiced.`,
      ];
      if (over.length > 0) {
        body.push(
          `${over.length === 1 ? "One category is" : `${over.length} categories are`} over budget once commitments are counted: ${over.map((c) => `${c.name} (${formatCurrency(Math.abs(c.remaining), currency)} over)`).join(", ")}. Overruns are normally absorbed by contingency before they reach your contract price.`,
        );
      } else {
        body.push("Every cost category is currently within its budget.");
      }
      return { content: body.join("\n\n"), citations };
    }

    case "payment": {
      if (!payments.nextDue) {
        return {
          content: `You have paid ${formatCurrency(payments.paid, currency)} of ${formatCurrency(payments.total, currency)}. Nothing further is scheduled at the moment.`,
          citations,
        };
      }
      citations.push({ kind: "payment", id: payments.nextDue.id, label: payments.nextDue.name });
      return {
        content: `Your next payment is ${formatCurrency(payments.nextDue.amount, currency)} for "${payments.nextDue.name}", due ${formatDate(payments.nextDue.due_date)}.\n\nSo far you have paid ${formatCurrency(payments.paid, currency)} of the ${formatCurrency(payments.total, currency)} schedule, leaving ${formatCurrency(payments.outstanding, currency)} outstanding${payments.overdueCount > 0 ? `, of which ${payments.overdueCount} payment${payments.overdueCount === 1 ? " is" : "s are"} already overdue` : ""}.`,
        citations,
      };
    }

    case "issues": {
      if (openIssues.length === 0) {
        return { content: "There are no open issues on your build right now.", citations };
      }
      for (const issue of openIssues) {
        citations.push({ kind: "issue", id: issue.id, label: issue.title });
      }
      return {
        content: `There ${openIssues.length === 1 ? "is 1 open issue" : `are ${openIssues.length} open issues`} on your build:\n\n${openIssues
          .map(
            (i) =>
              `• ${i.title} — ${i.severity} severity, ${i.status.replace("_", " ")}${i.location ? `, at ${i.location}` : ""}${i.due_date ? `, due ${formatDate(i.due_date)}` : ""}`,
          )
          .join("\n")}`,
        citations,
      };
    }

    case "next": {
      if (active.length === 0) {
        return { content: "No milestones are open on site at the moment.", citations };
      }
      for (const m of active) citations.push({ kind: "milestone", id: m.id, label: m.name });
      const recent = w.updates[0];
      if (recent) citations.push({ kind: "update", id: recent.id, label: recent.title });

      return {
        content: `${active.length === 1 ? "One milestone is" : `${active.length} milestones are`} open on site:\n\n${active
          .map(
            (m) =>
              `• ${m.name} — ${m.progress_percent}% complete, due ${formatDate(m.planned_end)}`,
          )
          .join(
            "\n",
          )}\n\n${recent ? `The most recent report from site was "${recent.title}" on ${formatDate(recent.published_at)}.` : ""}`,
        citations,
      };
    }

    case "documents": {
      const visible = w.documents.filter((d) => !d.is_confidential);
      const needAck = visible.filter((d) => d.requires_ack);
      return {
        content: `You have ${visible.length} documents available, covering permits, drawings, contracts, certificates and warranties. ${needAck.length > 0 ? `${needAck.length} of them still ${needAck.length === 1 ? "needs" : "need"} your acknowledgement: ${needAck.map((d) => d.name).join(", ")}.` : "None of them are waiting on your acknowledgement."}\n\nThey are all in the Documents section, searchable by name or category.`,
        citations,
      };
    }

    case "weather": {
      const recent = w.weather.slice(0, 30);
      const lost = recent
        .filter((e) => e.work_impact !== "none")
        .reduce((t, e) => t + (e.work_impact === "full" ? 1 : 0.5), 0);
      return {
        content:
          lost === 0
            ? "No working days have been lost to weather in the last 30 days."
            : `About ${lost % 1 === 0 ? lost : lost.toFixed(1)} working days have been lost to weather in the last 30 days, costing roughly ${recent.reduce((t, e) => t + e.hours_lost, 0).toFixed(0)} crew hours. The site log records the conditions day by day, so this is what actually happened on the ground rather than a forecast.`,
        citations,
      };
    }

    case "who": {
      return {
        content: `Your build team:\n\n• Site manager: ${w.project.site_manager_name ?? "not recorded"}${w.project.site_manager_phone ? ` — ${w.project.site_manager_phone}` : ""}\n• Contractor: ${w.project.contractor_name ?? w.organization?.name ?? "not recorded"}\n• Architect: ${w.project.architect_name ?? "not recorded"}\n\nFor anything urgent, the site manager is the right first call.`,
        citations,
      };
    }

    default:
      return {
        content: `I can answer from your project's records — progress and the schedule, why dates have moved, budget and spend, your payment schedule, open issues, inspections, documents, weather, your finish decisions, site visits, and who is on the build team.\n\nRight now: the build is ${progress.toFixed(1)}% complete, ${Math.abs(variance).toFixed(1)} points ${variance < 0 ? "behind" : "ahead of"} plan, with ${openIssues.length} open issue${openIssues.length === 1 ? "" : "s"}. Ask me about any of that and I will point at the underlying records.`,
        citations,
      };
  }
}
