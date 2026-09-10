/**
 * Weekly digest.
 *
 * One message a week that answers "do I need to do anything, and is my house
 * on track?" -- composed from the same records as the dashboard, so the email
 * and the screen can never disagree.
 *
 * Composition is separate from delivery on purpose. `composeDigest` produces a
 * structured digest; `digestToText` renders the plain-text body an email
 * provider would send. Wiring a provider is a transport concern, not a
 * content one, and keeping them apart is what makes the content testable.
 */

import { addDays, daysBetween, formatCurrency, formatDate, toDateString } from "@/lib/format";
import type { DelayExplanation } from "@/lib/domain/delay";
import type { SelectionView } from "@/lib/domain/selections";
import type { Issue, Milestone, Payment, ProgressSnapshot, Update } from "@/types/database";

export interface DigestItem {
  text: string;
  href?: string;
}

export interface DigestSection {
  title: string;
  items: DigestItem[];
  /** Sections that need the reader to act are marked, and sorted first. */
  actionRequired: boolean;
}

export interface Digest {
  projectName: string;
  periodStart: string;
  periodEnd: string;
  progressNow: number;
  progressBefore: number | null;
  progressDelta: number | null;
  headline: string;
  sections: DigestSection[];
}

/** The snapshot nearest to a date, looking backwards. */
function snapshotOnOrBefore(
  snapshots: readonly ProgressSnapshot[],
  date: string,
): ProgressSnapshot | null {
  let best: ProgressSnapshot | null = null;
  for (const s of snapshots) {
    if (s.captured_on <= date && (!best || s.captured_on > best.captured_on)) best = s;
  }
  return best;
}

/**
 * The earliest instant a digest can mention an update from, so the data layer
 * fetches the week rather than the whole feed. A day wider than the period,
 * because `composeDigest` compares calendar dates; it filters the rest.
 */
export function digestWindowStart(asOf: Date, periodDays: number = 7): string {
  return `${addDays(toDateString(asOf), -(periodDays + 1))}T00:00:00.000Z`;
}

export function composeDigest(input: {
  projectName: string;
  slug: string;
  currency: string;
  asOf: Date;
  periodDays?: number;
  snapshots: readonly ProgressSnapshot[];
  updates: readonly Update[];
  milestones: readonly Milestone[];
  payments: readonly Payment[];
  issues: readonly Issue[];
  selections: readonly SelectionView[];
  delay: DelayExplanation;
}): Digest {
  const periodDays = input.periodDays ?? 7;
  const periodEnd = toDateString(input.asOf);
  const periodStart = addDays(periodEnd, -periodDays);
  const base = `/projects/${input.slug}`;
  const inPeriod = (date: string | null | undefined) =>
    !!date && date.slice(0, 10) > periodStart && date.slice(0, 10) <= periodEnd;

  const now = snapshotOnOrBefore(input.snapshots, periodEnd);
  const before = snapshotOnOrBefore(input.snapshots, periodStart);
  const progressNow = now?.actual_percent ?? 0;
  const progressBefore = before?.actual_percent ?? null;
  const progressDelta = progressBefore === null ? null : progressNow - progressBefore;

  const headline =
    progressDelta === null
      ? `${input.projectName} is ${progressNow.toFixed(1)}% complete.`
      : progressDelta < 0.05
        ? `No measurable progress was recorded on ${input.projectName} this week. It stands at ${progressNow.toFixed(1)}%.`
        : `${input.projectName} moved from ${progressBefore!.toFixed(1)}% to ${progressNow.toFixed(1)}% this week (+${progressDelta.toFixed(1)} points).`;

  const sections: DigestSection[] = [];

  // ---- Decisions: the thing most likely to need action -------------------
  const decisions = input.selections.filter(
    (v) =>
      (v.urgency === "overdue" || v.urgency === "urgent" || v.urgency === "soon") &&
      v.daysLeft !== null &&
      v.daysLeft <= 14,
  );
  if (decisions.length > 0) {
    sections.push({
      title: "Decisions you need to make",
      actionRequired: true,
      items: decisions.map((v) => ({
        text:
          v.urgency === "overdue"
            ? `${v.category.name} — overdue since ${formatDate(v.deadline, "medium")}`
            : `${v.category.name} — choose by ${formatDate(v.deadline, "medium")} (${v.daysLeft} days)`,
        href: `${base}/selections#${v.category.id}`,
      })),
    });
  }

  // ---- Money --------------------------------------------------------------
  const horizon = addDays(periodEnd, 14);
  const dueSoon = input.payments.filter(
    (p) =>
      p.status !== "paid" && p.status !== "waived" && p.due_date !== null && p.due_date <= horizon,
  );
  const paid = input.payments.filter((p) => p.status === "paid" && inPeriod(p.paid_at));
  if (dueSoon.length > 0 || paid.length > 0) {
    sections.push({
      title: "Payments",
      actionRequired: dueSoon.length > 0,
      items: [
        ...dueSoon.map((p) => ({
          text:
            p.due_date! < periodEnd
              ? `${p.name}: ${formatCurrency(p.amount, input.currency)} was due ${formatDate(p.due_date, "medium")}`
              : `${p.name}: ${formatCurrency(p.amount, input.currency)} due ${formatDate(p.due_date, "medium")} (${daysBetween(periodEnd, p.due_date!)} days)`,
          href: `${base}/finance`,
        })),
        ...paid.map((p) => ({
          text: `Payment recorded: ${p.name}, ${formatCurrency(p.amount, input.currency)}`,
          href: `${base}/finance`,
        })),
      ],
    });
  }

  // ---- Schedule -------------------------------------------------------------
  if (input.delay.isSlipping) {
    sections.push({
      title: "Schedule",
      actionRequired: false,
      items: [
        { text: input.delay.headline, href: `${base}/timeline` },
        ...input.delay.reasons
          .slice(0, 3)
          .map((r) => ({ text: `${r.label} — ${r.detail}`, href: r.href })),
      ],
    });
  }

  // ---- On site ----------------------------------------------------------
  const updates = input.updates.filter((u) => u.is_published && inPeriod(u.published_at));
  const completed = input.milestones.filter(
    (m) => m.status === "completed" && inPeriod(m.actual_end),
  );
  const started = input.milestones.filter(
    (m) => m.actual_start && inPeriod(m.actual_start) && m.status !== "completed",
  );
  if (updates.length + completed.length + started.length > 0) {
    sections.push({
      title: "On site this week",
      actionRequired: false,
      items: [
        ...completed.map((m) => ({ text: `Completed: ${m.name}`, href: `${base}/timeline` })),
        ...started.map((m) => ({ text: `Started: ${m.name}`, href: `${base}/timeline` })),
        ...updates.map((u) => ({
          text: `${formatDate(u.published_at, "short")} — ${u.title}`,
          href: `${base}/updates#${u.id}`,
        })),
      ],
    });
  }

  // ---- Quality -------------------------------------------------------------
  const raised = input.issues.filter((i) => inPeriod(i.created_at));
  const resolved = input.issues.filter((i) => inPeriod(i.resolved_at));
  if (raised.length + resolved.length > 0) {
    sections.push({
      title: "Issues",
      actionRequired: false,
      items: [
        ...raised.map((i) => ({
          text: `Raised: ${i.title} (${i.severity})`,
          href: `${base}/quality`,
        })),
        ...resolved.map((i) => ({ text: `Resolved: ${i.title}`, href: `${base}/quality` })),
      ],
    });
  }

  sections.sort((a, b) => Number(b.actionRequired) - Number(a.actionRequired));

  return {
    projectName: input.projectName,
    periodStart,
    periodEnd,
    progressNow,
    progressBefore,
    progressDelta,
    headline,
    sections,
  };
}

/** Plain-text body for an email. Absolute links need the site origin. */
export function digestToText(digest: Digest, origin: string): string {
  const lines: string[] = [
    `${digest.projectName} — week to ${formatDate(digest.periodEnd, "long")}`,
    "",
    digest.headline,
    "",
  ];

  if (digest.sections.length === 0) {
    lines.push("Nothing else changed this week, and there is nothing you need to do.");
  }

  for (const section of digest.sections) {
    lines.push(
      section.actionRequired
        ? `${section.title.toUpperCase()} (action needed)`
        : section.title.toUpperCase(),
    );
    for (const item of section.items) {
      lines.push(`  • ${item.text}`);
      if (item.href) lines.push(`    ${origin}${item.href}`);
    }
    lines.push("");
  }

  lines.push("You are receiving this because weekly digests are on in your notification settings.");
  return lines.join("\n");
}
