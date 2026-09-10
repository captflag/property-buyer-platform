/**
 * Selections and finishes.
 *
 * In residential construction this is the single biggest source of both buyer
 * stress and builder delay: dozens of choices, each needed before a specific
 * piece of work can start, each with a supplier lead time. Miss a deadline and
 * the builder either fits the standard option or stops.
 *
 * Two decisions here matter more than they look:
 *
 *   1. Deadlines are *derived* from the programme unless explicitly set:
 *      milestone start, minus the longest option lead time, minus a buffer.
 *      So when the build slips, the buyer's deadlines slip with it, rather
 *      than a stale date forcing a rush the schedule no longer needs.
 *
 *   2. Every open decision states its consequence in plain words. "Choose by
 *      14 October" is a date; "if this passes, the standard worktop is fitted
 *      and changing it later is a change order" is a reason to act.
 */

import { addDays, daysBetween, formatCurrency, formatDate, toDateString } from "@/lib/format";
import type { Milestone, SelectionCategory, SelectionOption } from "@/types/database";

export type SelectionUrgency = "overdue" | "urgent" | "soon" | "later" | "chosen" | "locked";

export interface SelectionView {
  category: SelectionCategory;
  options: SelectionOption[];
  standard: SelectionOption | null;
  chosen: SelectionOption | null;
  milestone: Milestone | null;
  deadline: string | null;
  /** True when the deadline came from the programme rather than being set. */
  deadlineDerived: boolean;
  daysLeft: number | null;
  urgency: SelectionUrgency;
  /** Cost of the current choice relative to the standard option. */
  priceDelta: number;
  /**
   * Options whose supplier lead time can no longer be met before the linked
   * work starts. Choosing one of these would delay that work.
   */
  lateOptionIds: Set<string>;
  consequence: string;
}

export const URGENT_DAYS = 7;
export const SOON_DAYS = 21;

const URGENCY_ORDER: Record<SelectionUrgency, number> = {
  overdue: 0,
  urgent: 1,
  soon: 2,
  later: 3,
  chosen: 4,
  locked: 5,
};

/**
 * When a decision is needed by.
 *
 * Explicit deadline wins. Otherwise: the linked milestone's planned start,
 * less the longest lead time among the options (the buyer might pick that
 * one), less the category's buffer.
 */
export function deriveDeadline(
  category: Pick<SelectionCategory, "decision_deadline" | "buffer_days">,
  options: Pick<SelectionOption, "lead_time_days">[],
  milestone: Pick<Milestone, "planned_start"> | null,
): { date: string | null; derived: boolean } {
  if (category.decision_deadline) {
    return { date: category.decision_deadline, derived: false };
  }
  if (!milestone) return { date: null, derived: false };

  const longestLead = options.reduce((max, o) => Math.max(max, o.lead_time_days), 0);
  return {
    date: addDays(milestone.planned_start, -(longestLead + category.buffer_days)),
    derived: true,
  };
}

export function urgencyFor(
  status: SelectionCategory["status"],
  daysLeft: number | null,
): SelectionUrgency {
  if (status === "confirmed" || status === "locked") return "locked";
  if (status === "chosen") return "chosen";
  if (daysLeft === null) return "later";
  if (daysLeft < 0) return "overdue";
  if (daysLeft <= URGENT_DAYS) return "urgent";
  if (daysLeft <= SOON_DAYS) return "soon";
  return "later";
}

function consequenceFor(view: Omit<SelectionView, "consequence">, today: string): string {
  const { urgency, standard, chosen, milestone, deadline, daysLeft } = view;
  // "the standard white ceramic", but "the standard layout" rather than
  // "the standard standard layout" when the option is already named that way.
  const standardName = standard
    ? /^standard\b/i.test(standard.name)
      ? `the ${standard.name.toLowerCase()}`
      : `the standard ${standard.name.toLowerCase()}`
    : "the standard option";

  if (urgency === "locked") {
    return "Confirmed and ordered. Changing it now goes through a change order.";
  }

  if (urgency === "chosen" && chosen) {
    if (milestone && view.lateOptionIds.has(chosen.id)) {
      const ready = addDays(today, chosen.lead_time_days);
      const late = daysBetween(milestone.planned_start, ready);
      return `${chosen.name} takes ${chosen.lead_time_days} days to arrive, so it would land about ${late} day${late === 1 ? "" : "s"} after ${milestone.name.toLowerCase()} is due to start. Ask the build team whether that holds the work up.`;
    }
    return `You chose ${chosen.name}. The build team will confirm it and place the order.`;
  }

  if (urgency === "overdue" && daysLeft !== null) {
    const ago = Math.abs(daysLeft);
    return `The deadline passed ${ago} day${ago === 1 ? "" : "s"} ago. Unless you choose now, ${standardName} will be fitted, and changing it afterwards needs a change order.`;
  }

  if (deadline) {
    return `Choose by ${formatDate(deadline, "medium")}. If that passes, ${standardName} is fitted, and changing it afterwards needs a change order.`;
  }

  return "No deadline yet — it will be set when the related work is scheduled.";
}

export function viewSelections(
  categories: readonly SelectionCategory[],
  options: readonly SelectionOption[],
  milestones: readonly Milestone[],
  asOf: Date,
): SelectionView[] {
  const today = toDateString(asOf);
  const milestoneById = new Map(milestones.map((m) => [m.id, m]));

  const views = categories.map((category) => {
    const own = options
      .filter((o) => o.category_id === category.id)
      .slice()
      .sort((a, b) => a.sequence - b.sequence);

    const milestone = category.milestone_id
      ? (milestoneById.get(category.milestone_id) ?? null)
      : null;
    const { date: deadline, derived } = deriveDeadline(category, own, milestone);
    const daysLeft = deadline ? daysBetween(today, deadline) : null;

    const standard = own.find((o) => o.is_standard) ?? null;
    const chosen = category.chosen_option_id
      ? (own.find((o) => o.id === category.chosen_option_id) ?? null)
      : null;

    // An option is "late" if ordering it today still would not arrive before
    // the work that needs it is due to start.
    const daysToWork = milestone ? daysBetween(today, milestone.planned_start) : null;
    const lateOptionIds = new Set(
      daysToWork === null || category.status === "locked" || category.status === "confirmed"
        ? []
        : own.filter((o) => o.lead_time_days > daysToWork).map((o) => o.id),
    );

    const base = {
      category,
      options: own,
      standard,
      chosen,
      milestone,
      deadline,
      deadlineDerived: derived,
      daysLeft,
      urgency: urgencyFor(category.status, daysLeft),
      priceDelta: chosen?.price_delta ?? 0,
      lateOptionIds,
    };

    return { ...base, consequence: consequenceFor(base, today) };
  });

  return views.sort(
    (a, b) =>
      URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency] ||
      (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999") ||
      a.category.sequence - b.category.sequence,
  );
}

export interface SelectionSummary {
  total: number;
  decided: number;
  open: number;
  overdue: number;
  urgent: number;
  /** Net cost of every choice made so far, relative to the standard spec. */
  budgetImpact: number;
  /** The soonest open deadline, if any. */
  nextDeadline: SelectionView | null;
}

export function summariseSelections(views: readonly SelectionView[]): SelectionSummary {
  const open = views.filter((v) => v.urgency !== "chosen" && v.urgency !== "locked");
  return {
    total: views.length,
    decided: views.length - open.length,
    open: open.length,
    overdue: views.filter((v) => v.urgency === "overdue").length,
    urgent: views.filter((v) => v.urgency === "urgent").length,
    budgetImpact: views.reduce((total, v) => total + v.priceDelta, 0),
    nextDeadline:
      open
        .filter((v) => v.deadline !== null)
        .sort((a, b) => a.deadline!.localeCompare(b.deadline!))[0] ?? null,
  };
}

/** "+$4,200" / "−$600" / "Included". */
export function formatPriceDelta(delta: number, currency = "USD"): string {
  if (delta === 0) return "Included";
  const formatted = formatCurrency(Math.abs(delta), currency);
  return delta > 0 ? `+${formatted}` : `−${formatted}`;
}
