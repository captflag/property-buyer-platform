import type { Workspace } from "@/lib/data/workspace";
import { explainDelay } from "@/lib/domain/delay";
import { forecastCompletion } from "@/lib/domain/forecast";
import { computeSchedule } from "@/lib/domain/schedule";
import { summariseSelections, viewSelections } from "@/lib/domain/selections";
import { sumBy } from "@/lib/utils";

/**
 * Everything the buyer-facing pages derive from a workspace, computed once.
 *
 * The dashboard, the selections page, the digest, the calendar feed, the
 * lender pack and the assistant all need the same schedule, forecast,
 * selection deadlines and delay explanation. Computing them in one place is
 * what guarantees they agree -- a deadline that reads "9 days" on one screen
 * and "8 days" on another is exactly the inconsistency that erodes trust.
 *
 * Pure: no I/O, safe to call from pages, route handlers and actions alike.
 */
/** The tables `deriveProject` reads. Spread into a page's own list. */
export const DERIVE_TABLES = [
  "milestones",
  "dependencies",
  "snapshots",
  "selectionCategories",
  "selectionOptions",
  "weather",
  "changeOrders",
  "issues",
  "members",
] as const;

export function deriveProject(
  w: Workspace<(typeof DERIVE_TABLES)[number]>,
  viewerId: string | null,
) {
  const now = new Date(w.now);
  const slug = w.project.slug;

  const totalWeight = sumBy(w.milestones, (m) => m.weight);
  const progress =
    totalWeight > 0 ? sumBy(w.milestones, (m) => m.progress_percent * m.weight) / totalWeight : 0;
  const planned = w.snapshots[w.snapshots.length - 1]?.planned_percent ?? 0;

  const schedule = computeSchedule(w.milestones, w.dependencies);
  const forecast = forecastCompletion(w.snapshots, w.project.target_completion_date, { asOf: now });
  const selections = viewSelections(w.selectionCategories, w.selectionOptions, w.milestones, now);
  const selectionSummary = summariseSelections(selections);

  const delay = explainDelay({
    project: w.project,
    forecast,
    schedule,
    milestones: w.milestones,
    weather: w.weather,
    changeOrders: w.changeOrders,
    issues: w.issues,
    selections,
    asOf: now,
    slug,
  });

  const membership = viewerId ? (w.members.find((m) => m.user_id === viewerId) ?? null) : null;

  // The move-in plan and the calendar anchor to the forecast, not the
  // contract: planning a removal van around a date the build is already
  // projected to miss would be planning to fail.
  const handoverAnchor = forecast.projectedDate ?? w.project.target_completion_date;

  return {
    now,
    slug,
    progress,
    planned,
    schedule,
    forecast,
    selections,
    selectionSummary,
    delay,
    membership,
    lastSeenAt: membership?.last_seen_at ?? null,
    handoverAnchor,
  };
}

export type DerivedProject = ReturnType<typeof deriveProject>;
