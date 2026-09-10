/**
 * Move-in planner.
 *
 * The ninety days before handover are logistically brutal, and every task in
 * them is timed against one date the buyer does not control. So the plan is
 * anchored to the *forecast* handover by default, not the contract date: when
 * the build slips, "book removals" slips with it, and the buyer never books
 * a van for a house that is not ready.
 *
 * The template is deliberately general -- it names the category of task
 * ("give notice on your current home") rather than assuming renting, a
 * particular utility market, or a country's tax system.
 */

import { addDays, daysBetween, toDateString } from "@/lib/format";
import type { MoveTask } from "@/types/database";

export type MoveCategory = "Finance" | "Home" | "Services" | "Admin" | "Moving" | "Family";

export interface MoveTemplateTask {
  key: string;
  title: string;
  detail: string;
  category: MoveCategory;
  /** Days before handover. Negative means after moving in. */
  daysBefore: number;
}

export const MOVE_TEMPLATE: readonly MoveTemplateTask[] = [
  {
    key: "school-places",
    title: "Check school places for the new address",
    detail: "Admissions often run months ahead and can depend on your address on a set date.",
    category: "Family",
    daysBefore: 90,
  },
  {
    key: "notice-current-home",
    title: "Give notice on your current home",
    detail:
      "Tenancies commonly need one or two months' notice. If you are selling, agree completion dates with the handover in mind.",
    category: "Home",
    daysBefore: 60,
  },
  {
    key: "mortgage-drawdown",
    title: "Confirm the final drawdown with your lender",
    detail:
      "Lenders usually want the completion certificate and a final valuation before releasing the last stage.",
    category: "Finance",
    daysBefore: 45,
  },
  {
    key: "book-removals",
    title: "Book a removals firm",
    detail:
      "Good firms fill up weeks ahead, especially at month ends. Ask about flexible dates in case handover moves.",
    category: "Moving",
    daysBefore: 42,
  },
  {
    key: "broadband",
    title: "Order broadband for the new address",
    detail:
      "New-build connections can take four to six weeks, and some addresses need a new line installed first.",
    category: "Services",
    daysBefore: 35,
  },
  {
    key: "measure-up",
    title: "Book a visit to measure for furniture and blinds",
    detail: "Measure finished rooms, not drawings — plastered walls lose a little width.",
    category: "Home",
    daysBefore: 30,
  },
  {
    key: "declutter",
    title: "Declutter and start packing",
    detail: "Start with rooms and seasons you are not using.",
    category: "Moving",
    daysBefore: 28,
  },
  {
    key: "buildings-insurance",
    title: "Arrange buildings insurance from handover day",
    detail:
      "Cover must start the day you take the keys. Your lender will usually ask for proof of it.",
    category: "Finance",
    daysBefore: 21,
  },
  {
    key: "utilities",
    title: "Set up electricity, water and gas accounts",
    detail:
      "Take the supplier details from the handover pack so accounts open against the correct meters.",
    category: "Services",
    daysBefore: 21,
  },
  {
    key: "contents-insurance",
    title: "Arrange contents insurance for the new home",
    detail: "Check whether moving day itself is covered, by your policy or the removals firm's.",
    category: "Finance",
    daysBefore: 14,
  },
  {
    key: "mail-redirect",
    title: "Set up mail redirection",
    detail: "Three to six months catches most things you forget to update.",
    category: "Admin",
    daysBefore: 14,
  },
  {
    key: "snagging-walk",
    title: "Attend the pre-handover snagging walk",
    detail:
      "Walk every room with the site manager. Anything logged now is fixed before you move in.",
    category: "Home",
    daysBefore: 7,
  },
  {
    key: "address-change",
    title: "Update your address with banks, employer and doctor",
    detail: "Do the ones that send post first.",
    category: "Admin",
    daysBefore: 7,
  },
  {
    key: "furniture-delivery",
    title: "Schedule deliveries for after handover",
    detail:
      "Never before the keys — a delivery to a site you do not yet own is refused at the gate.",
    category: "Moving",
    daysBefore: 5,
  },
  {
    key: "meter-readings",
    title: "Take meter readings on handover day",
    detail: "Photograph every meter with the date visible before anything is switched on.",
    category: "Services",
    daysBefore: 0,
  },
  {
    key: "keys-and-warranties",
    title: "Collect keys, warranties and the home user guide",
    detail: "Check the warranty start dates match your handover date.",
    category: "Home",
    daysBefore: 0,
  },
  {
    key: "property-tax",
    title: "Register for property tax at the new address",
    detail: "Most authorities expect this from the day you take ownership.",
    category: "Admin",
    daysBefore: 0,
  },
  {
    key: "register-to-vote",
    title: "Register to vote at the new address",
    detail: "",
    category: "Admin",
    daysBefore: -14,
  },
  {
    key: "first-month-snags",
    title: "Report anything missed within the first month",
    detail:
      "Doors settle and hairline cracks appear as a new house dries out. Both are normal, and both should be logged.",
    category: "Home",
    daysBefore: -30,
  },
];

export type MoveTaskState = "done" | "overdue" | "due-soon" | "upcoming";

export interface PlannedMoveTask {
  key: string;
  title: string;
  detail: string;
  category: MoveCategory | string;
  daysBefore: number;
  dueDate: string;
  daysUntil: number;
  state: MoveTaskState;
  doneAt: string | null;
  isCustom: boolean;
}

export interface MoveWindow {
  label: string;
  tasks: PlannedMoveTask[];
}

export interface MovePlan {
  anchorDate: string;
  daysToAnchor: number;
  windows: MoveWindow[];
  tasks: PlannedMoveTask[];
  done: number;
  total: number;
  overdue: number;
  next: PlannedMoveTask | null;
}

const WINDOWS: Array<{ label: string; test: (daysBefore: number) => boolean }> = [
  { label: "Two months or more before", test: (d) => d >= 60 },
  { label: "About a month before", test: (d) => d >= 28 && d < 60 },
  { label: "The last few weeks", test: (d) => d >= 1 && d < 28 },
  { label: "Handover day", test: (d) => d === 0 },
  { label: "After you move in", test: (d) => d < 0 },
];

export const DUE_SOON_DAYS = 7;

export function buildMovePlan(input: {
  anchorDate: string;
  asOf: Date;
  records: readonly MoveTask[];
}): MovePlan {
  const today = toDateString(input.asOf);
  const recordByKey = new Map(
    input.records.filter((r) => r.template_key).map((r) => [r.template_key!, r]),
  );

  const templateTasks = MOVE_TEMPLATE.map((t) => ({
    key: t.key,
    title: t.title,
    detail: t.detail,
    category: t.category,
    daysBefore: t.daysBefore,
    doneAt: recordByKey.get(t.key)?.done_at ?? null,
    isCustom: false,
  }));

  const customTasks = input.records
    .filter((r) => !r.template_key && r.title)
    .map((r) => ({
      key: r.id,
      title: r.title!,
      detail: "",
      category: r.category ?? "Home",
      daysBefore: r.days_before ?? 0,
      doneAt: r.done_at,
      isCustom: true,
    }));

  const tasks: PlannedMoveTask[] = [...templateTasks, ...customTasks]
    .map((task) => {
      const dueDate = addDays(input.anchorDate, -task.daysBefore);
      const daysUntil = daysBetween(today, dueDate);
      const state: MoveTaskState = task.doneAt
        ? "done"
        : daysUntil < 0
          ? "overdue"
          : daysUntil <= DUE_SOON_DAYS
            ? "due-soon"
            : "upcoming";
      return { ...task, dueDate, daysUntil, state };
    })
    .sort((a, b) => b.daysBefore - a.daysBefore || a.title.localeCompare(b.title));

  const windows = WINDOWS.map((w) => ({
    label: w.label,
    tasks: tasks.filter((t) => w.test(t.daysBefore)),
  })).filter((w) => w.tasks.length > 0);

  const open = tasks.filter((t) => t.state !== "done");

  return {
    anchorDate: input.anchorDate,
    daysToAnchor: daysBetween(today, input.anchorDate),
    windows,
    tasks,
    done: tasks.length - open.length,
    total: tasks.length,
    overdue: tasks.filter((t) => t.state === "overdue").length,
    next: open.slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] ?? null,
  };
}
