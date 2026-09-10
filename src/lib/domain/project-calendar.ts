import type { CalendarEvent } from "@/lib/calendar";
import type { DerivedProject } from "@/lib/data/derived";
import type { Workspace } from "@/lib/data/workspace";
import { buildMovePlan } from "@/lib/domain/move-in";
import { formatCurrency } from "@/lib/format";

/**
 * The project's dates, as calendar events.
 *
 * Sections are opt-in by query parameter so a buyer can put payment dates in
 * a shared family calendar without also pushing twenty move-in chores into
 * it. The move plan is excluded by default for exactly that reason.
 *
 * Only dates the buyer can act on are included. Milestone starts and ends are
 * deliberately left out: a calendar full of "Plasterboard & skim" entries that
 * move every week is noise, and the timeline page is where that belongs.
 */

export const CALENDAR_SECTIONS = [
  "payments",
  "inspections",
  "visits",
  "selections",
  "handover",
  "move",
] as const;

export type CalendarSection = (typeof CALENDAR_SECTIONS)[number];

export const DEFAULT_SECTIONS: readonly CalendarSection[] = [
  "payments",
  "inspections",
  "visits",
  "selections",
  "handover",
];

export function parseSections(param: string | null): Set<CalendarSection> {
  if (!param) return new Set(DEFAULT_SECTIONS);
  if (param === "all") return new Set(CALENDAR_SECTIONS);

  const chosen = new Set<CalendarSection>();
  for (const part of param.split(",")) {
    const trimmed = part.trim();
    if ((CALENDAR_SECTIONS as readonly string[]).includes(trimmed)) {
      chosen.add(trimmed as CalendarSection);
    }
  }
  return chosen.size > 0 ? chosen : new Set(DEFAULT_SECTIONS);
}

/** The tables the calendar reads, on top of `deriveProject`'s. */
export const CALENDAR_TABLES = ["payments", "inspections", "siteVisits", "moveTasks"] as const;

export function projectCalendarEvents(
  w: Workspace<(typeof CALENDAR_TABLES)[number]>,
  d: DerivedProject,
  sections: ReadonlySet<CalendarSection>,
  origin: string,
): CalendarEvent[] {
  const base = `${origin}/projects/${w.project.slug}`;
  const currency = w.project.currency;
  const location = [
    w.project.address_line1,
    w.project.city,
    [w.project.state, w.project.postal_code].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  const events: CalendarEvent[] = [];

  if (sections.has("payments")) {
    for (const payment of w.payments) {
      if (payment.status === "paid" || payment.status === "waived" || !payment.due_date) continue;
      events.push({
        uid: `payment-${payment.id}`,
        title: `Payment due: ${payment.name} (${formatCurrency(payment.amount, currency)})`,
        description: [
          `Stage payment for ${w.project.name}.`,
          payment.invoice_number ? `Invoice ${payment.invoice_number}.` : null,
        ]
          .filter(Boolean)
          .join(" "),
        start: payment.due_date,
        allDay: true,
        url: `${base}/finance`,
        categories: ["Payment"],
      });
    }
  }

  if (sections.has("inspections")) {
    for (const inspection of w.inspections) {
      if (inspection.result !== "pending" || !inspection.scheduled_for) continue;
      events.push({
        uid: `inspection-${inspection.id}`,
        title: `Inspection: ${inspection.name}`,
        description: inspection.authority ? `Carried out by ${inspection.authority}.` : undefined,
        start: inspection.scheduled_for,
        allDay: true,
        location,
        url: `${base}/quality`,
        categories: ["Inspection"],
      });
    }
  }

  if (sections.has("visits")) {
    for (const visit of w.siteVisits) {
      if (visit.status !== "requested" && visit.status !== "confirmed") continue;
      events.push({
        uid: `visit-${visit.id}`,
        title:
          visit.status === "confirmed"
            ? `Site visit: ${visit.purpose}`
            : `Site visit (awaiting confirmation): ${visit.purpose}`,
        description:
          "Report to the site cabin by the north gate. Hard hats and boots are provided. " +
          (visit.builder_note ?? ""),
        start: visit.starts_at,
        allDay: false,
        durationMinutes: visit.duration_minutes,
        location,
        url: `${base}/visits`,
        categories: ["Site visit"],
      });
    }
  }

  if (sections.has("selections")) {
    for (const view of d.selections) {
      if (view.urgency === "chosen" || view.urgency === "locked" || !view.deadline) continue;
      events.push({
        uid: `selection-${view.category.id}`,
        title: `Decision due: ${view.category.name}`,
        description: view.consequence,
        start: view.deadline,
        allDay: true,
        url: `${base}/selections#${view.category.id}`,
        categories: ["Decision"],
      });
    }
  }

  if (sections.has("handover")) {
    if (w.project.target_completion_date) {
      events.push({
        uid: `completion-contract-${w.project.id}`,
        title: `${w.project.name}: contract completion date`,
        start: w.project.target_completion_date,
        allDay: true,
        url: `${base}/timeline`,
        categories: ["Handover"],
      });
    }
    if (d.forecast.projectedDate && d.forecast.projectedDate !== w.project.target_completion_date) {
      events.push({
        uid: `completion-forecast-${w.project.id}`,
        title: `${w.project.name}: forecast handover (projection)`,
        description:
          "A projection from the recent rate of progress, not a date the builder has committed to. It updates as work progresses.",
        start: d.forecast.projectedDate,
        allDay: true,
        url: `${base}/timeline`,
        categories: ["Handover"],
      });
    }
  }

  if (sections.has("move") && d.handoverAnchor) {
    const plan = buildMovePlan({ anchorDate: d.handoverAnchor, asOf: d.now, records: w.moveTasks });
    for (const task of plan.tasks) {
      if (task.state === "done") continue;
      events.push({
        uid: `move-${task.key}`,
        title: `Move: ${task.title}`,
        description: task.detail || undefined,
        start: task.dueDate,
        allDay: true,
        url: `${base}/move-in`,
        categories: ["Move"],
      });
    }
  }

  return events.sort((a, b) => a.start.localeCompare(b.start));
}
