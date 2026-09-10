/**
 * "Since you last looked."
 *
 * A diff of the project between the member's last-seen instant and now, so a
 * buyer returning after a week sees the four things that changed instead of
 * having to re-read a dashboard that looks almost identical to last time.
 *
 * The last-seen instant only moves when the buyer marks the project as caught
 * up, never on page view. Opening the dashboard and leaving immediately must
 * not silently swallow a week of news.
 */

import { daysBetween, toDateString } from "@/lib/format";
import type { SelectionView } from "@/lib/domain/selections";
import { URGENT_DAYS } from "@/lib/domain/selections";
import type {
  Discussion,
  DiscussionMessage,
  Issue,
  Milestone,
  Payment,
  ProjectDocument,
  SiteVisit,
  Update,
} from "@/types/database";

export type ChangeKind =
  "update" | "milestone" | "document" | "payment" | "issue" | "selection" | "message" | "visit";

export interface ChangeItem {
  kind: ChangeKind;
  id: string;
  title: string;
  detail: string | null;
  at: string;
  href: string;
  tone: "good" | "warning" | "critical" | "neutral";
}

export interface SinceSummary {
  since: string | null;
  isFirstVisit: boolean;
  items: ChangeItem[];
  counts: Record<ChangeKind, number>;
}

/** With no last-seen instant, show the last week rather than all history. */
const FIRST_VISIT_WINDOW_DAYS = 7;

/**
 * The instant the "since" window opens: the last-seen mark, or a week ago on
 * a first visit. Exported so the data layer fetches exactly this window.
 */
export function windowStart(since: string | null, asOf: Date): string {
  return since ?? new Date(asOf.getTime() - FIRST_VISIT_WINDOW_DAYS * 86_400_000).toISOString();
}

export function changesSince(input: {
  since: string | null;
  asOf: Date;
  slug: string;
  viewerId: string | null;
  updates: readonly Update[];
  milestones: readonly Milestone[];
  documents: readonly ProjectDocument[];
  payments: readonly Payment[];
  issues: readonly Issue[];
  selections: readonly SelectionView[];
  discussions: readonly Discussion[];
  messages: readonly DiscussionMessage[];
  visits: readonly SiteVisit[];
}): SinceSummary {
  const isFirstVisit = input.since === null;
  const since = windowStart(input.since, input.asOf);
  const sinceDay = since.slice(0, 10);
  const base = `/projects/${input.slug}`;
  const items: ChangeItem[] = [];

  for (const update of input.updates) {
    if (update.is_published && update.published_at > since) {
      items.push({
        kind: "update",
        id: update.id,
        title: update.title,
        detail: "Site update",
        at: update.published_at,
        href: `${base}/updates#${update.id}`,
        tone: update.status === "blocked" ? "critical" : "neutral",
      });
    }
  }

  for (const milestone of input.milestones) {
    if (
      milestone.status === "completed" &&
      milestone.actual_end &&
      milestone.actual_end > sinceDay
    ) {
      items.push({
        kind: "milestone",
        id: milestone.id,
        title: `${milestone.name} completed`,
        detail: null,
        at: `${milestone.actual_end}T12:00:00.000Z`,
        href: `${base}/timeline`,
        tone: "good",
      });
    }
  }

  for (const doc of input.documents) {
    if (!doc.is_confidential && doc.created_at > since) {
      items.push({
        kind: "document",
        id: doc.id,
        title: doc.name,
        detail: doc.requires_ack ? "Needs your acknowledgement" : "New document",
        at: doc.created_at,
        href: `${base}/documents`,
        tone: doc.requires_ack ? "warning" : "neutral",
      });
    }
  }

  for (const payment of input.payments) {
    if (payment.status === "paid" && payment.paid_at && payment.paid_at > since) {
      items.push({
        kind: "payment",
        id: payment.id,
        title: `Payment recorded: ${payment.name}`,
        detail: null,
        at: payment.paid_at,
        href: `${base}/finance`,
        tone: "good",
      });
    } else if (
      (payment.status === "invoiced" || payment.status === "due" || payment.status === "overdue") &&
      payment.updated_at > since
    ) {
      items.push({
        kind: "payment",
        id: payment.id,
        title: `${payment.status === "overdue" ? "Overdue" : "Payment due"}: ${payment.name}`,
        detail: payment.due_date ? `Due ${payment.due_date}` : null,
        at: payment.updated_at,
        href: `${base}/finance`,
        tone: payment.status === "overdue" ? "critical" : "warning",
      });
    }
  }

  for (const issue of input.issues) {
    if (issue.created_at > since) {
      items.push({
        kind: "issue",
        id: issue.id,
        title: issue.raised_by_buyer
          ? `Your snag logged: ${issue.title}`
          : `Issue raised: ${issue.title}`,
        detail: issue.room ?? issue.location,
        at: issue.created_at,
        href: `${base}/quality`,
        tone: issue.severity === "critical" || issue.severity === "high" ? "critical" : "warning",
      });
    } else if (issue.resolved_at && issue.resolved_at > since) {
      items.push({
        kind: "issue",
        id: issue.id,
        title: `Resolved: ${issue.title}`,
        detail: null,
        at: issue.resolved_at,
        href: `${base}/quality`,
        tone: "good",
      });
    }
  }

  // A decision that has *crossed into* the urgent window since the last visit
  // is news; one that was already urgent last time is not.
  const today = toDateString(input.asOf);
  for (const view of input.selections) {
    if (view.urgency !== "urgent" && view.urgency !== "overdue") continue;
    if (!view.deadline) continue;
    const daysLeftAtLastVisit = daysBetween(sinceDay, view.deadline);
    if (daysLeftAtLastVisit <= URGENT_DAYS && !isFirstVisit) continue;

    items.push({
      kind: "selection",
      id: view.category.id,
      title:
        view.urgency === "overdue"
          ? `Decision overdue: ${view.category.name}`
          : `Decision due soon: ${view.category.name}`,
      detail: `${Math.max(0, view.daysLeft ?? 0)} days left`,
      // Sorted as if it happened at the moment it became urgent.
      at: `${today}T00:00:00.000Z`,
      href: `${base}/selections#${view.category.id}`,
      tone: view.urgency === "overdue" ? "critical" : "warning",
    });
  }

  const discussionById = new Map(input.discussions.map((d) => [d.id, d]));
  const latestByThread = new Map<string, DiscussionMessage>();
  for (const message of input.messages) {
    if (message.created_at <= since) continue;
    // Your own messages are not news to you.
    if (input.viewerId && message.author_id === input.viewerId) continue;
    const current = latestByThread.get(message.discussion_id);
    if (!current || message.created_at > current.created_at) {
      latestByThread.set(message.discussion_id, message);
    }
  }
  for (const [threadId, message] of latestByThread) {
    const thread = discussionById.get(threadId);
    if (!thread) continue;
    items.push({
      kind: "message",
      id: message.id,
      title: `Reply: ${thread.title}`,
      detail: message.body.length > 90 ? `${message.body.slice(0, 90)}…` : message.body,
      at: message.created_at,
      href: `${base}/questions#${thread.id}`,
      tone: "neutral",
    });
  }

  for (const visit of input.visits) {
    if (visit.updated_at <= since) continue;
    if (visit.status !== "confirmed" && visit.status !== "declined") continue;
    items.push({
      kind: "visit",
      id: visit.id,
      title: visit.status === "confirmed" ? "Site visit confirmed" : "Site visit declined",
      detail: visit.builder_note,
      at: visit.updated_at,
      href: `${base}/visits`,
      tone: visit.status === "confirmed" ? "good" : "warning",
    });
  }

  items.sort((a, b) => (a.at > b.at ? -1 : a.at < b.at ? 1 : 0));

  const counts = {
    update: 0,
    milestone: 0,
    document: 0,
    payment: 0,
    issue: 0,
    selection: 0,
    message: 0,
    visit: 0,
  } satisfies Record<ChangeKind, number>;
  for (const item of items) counts[item.kind] += 1;

  return { since: input.since, isFirstVisit, items, counts };
}
