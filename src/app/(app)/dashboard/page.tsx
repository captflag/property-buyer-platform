import {
  ArrowRight,
  Banknote,
  CalendarClock,
  HardHat,
  TrendingDown,
  TrendingUp,
  Truck,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

import { SCurveChart } from "@/components/charts/s-curve-chart";
import { ProgressRing } from "@/components/charts/progress-ring";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CinePhoto } from "@/components/ui/cine-photo";
import { Card, CardContent, CardDescription, CardTitle, CardToolbar } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { DecisionsDue } from "@/components/widgets/decisions-due";
import { DelayBanner } from "@/components/widgets/delay-banner";
import { ForecastCard } from "@/components/widgets/forecast-card";
import { HealthScoreCard } from "@/components/widgets/health-score";
import { MilestoneTracker } from "@/components/widgets/milestone-tracker";
import { SinceLastLooked } from "@/components/widgets/since-last-looked";
import { StatGrid, StatTile } from "@/components/widgets/stat-tile";
import { UpdateCard } from "@/components/widgets/update-card";
import { WeatherWidget } from "@/components/widgets/weather-widget";
import { DERIVE_TABLES, deriveProject } from "@/lib/data/derived";
import { getMessagesSince, getUpdates } from "@/lib/data/feeds";
import { getViewer, getWorkspace } from "@/lib/data/workspace";
import { rollUpBudget, contractPosition, summarisePayments } from "@/lib/domain/finance";
import { scoreHealth } from "@/lib/domain/forecast";
import { buildMovePlan } from "@/lib/domain/move-in";
import { changesSince, windowStart } from "@/lib/domain/since";
import { daysBetween, formatCurrency, formatDate, formatPoints } from "@/lib/format";
import { HERO_PHOTO } from "@/lib/media";
import { cn, sumBy } from "@/lib/utils";

export const metadata: Metadata = { title: "Overview" };

const DASHBOARD_TABLES = [
  ...DERIVE_TABLES,
  "phases",
  "budgetCategories",
  "costEntries",
  "payments",
  "documents",
  "profiles",
  "siteVisits",
  "moveTasks",
  "discussions",
] as const;

/** A cap on "since you last looked" updates; a buyer back after months sees the latest. */
const SINCE_UPDATE_LIMIT = 100;

export default async function DashboardPage() {
  const [w, viewer] = await Promise.all([getWorkspace(undefined, DASHBOARD_TABLES), getViewer()]);
  const now = new Date(w.now);

  if (!w.project.id) {
    return (
      <EmptyState
        illustration="site"
        title="No project yet"
        description="Your builder adds you to a project once your plot is allocated. As soon as they do, progress, documents, payments and site photographs all appear here."
      />
    );
  }

  // ---- Derived figures -----------------------------------------------------
  const totalWeight = sumBy(w.milestones, (m) => m.weight);
  const progress =
    totalWeight > 0 ? sumBy(w.milestones, (m) => m.progress_percent * m.weight) / totalWeight : 0;

  const latestSnapshot = w.snapshots[w.snapshots.length - 1];
  const plannedProgress = latestSnapshot?.planned_percent ?? 0;
  const scheduleVariance = progress - plannedProgress;

  const budget = rollUpBudget(w.budgetCategories, w.costEntries);
  const contract = contractPosition(w.project, w.changeOrders);
  const payments = summarisePayments(w.payments, now);

  const openIssues = w.issues.filter(
    (i) => i.status === "open" || i.status === "acknowledged" || i.status === "in_progress",
  );

  const health = scoreHealth({
    scheduleVariance,
    costVariance: budget.remaining,
    budgetTotal: budget.budgeted,
    openIssues,
    weather: w.weather,
    asOf: now,
  });

  const viewerId = viewer.profile?.id ?? null;
  const d = deriveProject(w, viewerId);
  const forecast = d.forecast;

  // The feeds are windowed by what this page shows: the three latest updates,
  // and whatever was posted since the buyer last caught up.
  const from = windowStart(d.lastSeenAt, now);
  const [recent, sinceUpdates, sinceMessages] = await Promise.all([
    getUpdates(undefined, { limit: 3, media: true }),
    getUpdates(undefined, { limit: SINCE_UPDATE_LIMIT, since: from }),
    getMessagesSince(undefined, from),
  ]);

  const since = changesSince({
    since: d.lastSeenAt,
    asOf: now,
    slug: w.project.slug,
    viewerId,
    updates: sinceUpdates.updates,
    milestones: w.milestones,
    documents: w.documents,
    payments: w.payments,
    issues: w.issues,
    selections: d.selections,
    discussions: w.discussions,
    messages: sinceMessages,
    visits: w.siteVisits,
  });

  const movePlan = d.handoverAnchor
    ? buildMovePlan({
        anchorDate: d.handoverAnchor,
        asOf: now,
        records: viewerId ? w.moveTasks.filter((t) => t.user_id === viewerId) : w.moveTasks,
      })
    : null;

  const daysRemaining = w.project.target_completion_date
    ? daysBetween(w.now.slice(0, 10), w.project.target_completion_date)
    : null;

  const activeMilestones = w.milestones.filter((m) => m.status === "in_progress");
  const recentUpdates = recent.updates;

  // The first word of the name is set as structural type across the hero;
  // the full name stays in the heading's accessible text.
  const [nameLead, ...nameRest] = w.project.name.split(" ");

  return (
    <>
      {/* ---- Hero: cinematic. A dusk scene sets the mood, the name is set
           across it, and the real site photograph is pinned over the corner
           so the mood never stands in for the facts. The whole hero renders
           with the dark tokens, whatever the page theme. ----------------- */}
      <section
        aria-labelledby="overview-title"
        className="dark border-line text-ink relative isolate mb-8 overflow-hidden rounded-[var(--radius-card)] border"
      >
        <CinePhoto
          scene="windowsDusk"
          alt=""
          priority
          sizes="(min-width: 1024px) 75vw, 100vw"
          className="animate-slow-drift absolute inset-0 -z-20 size-full"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(0,0,0,0.62)_0%,rgba(0,0,0,0.06)_34%,rgba(0,0,0,0.22)_62%,rgba(8,8,8,0.96)_100%)]"
        />

        <div className="flex min-h-[520px] flex-col p-5 sm:p-8 lg:min-h-[600px]">
          <div className="ui-runline grid grid-cols-12 items-center gap-x-4 gap-y-2">
            <span className="col-span-12 sm:col-span-3">Overview</span>
            <span className="col-span-12 sm:col-span-5">
              {w.project.address_line1}, {w.project.city}
              {w.project.state ? `, ${w.project.state}` : ""}
            </span>
            <span className="col-span-12 flex flex-wrap items-center gap-3 sm:col-span-4 sm:justify-end">
              <StatusBadge kind="project" value={w.project.status} />
              <Link
                href={`/projects/${w.project.slug}/updates`}
                className="text-ink decoration-accent inline-flex items-center gap-1 underline-offset-4 hover:underline"
              >
                Site updates
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </span>
          </div>

          <div className="mt-auto grid gap-8 pt-16 lg:grid-cols-12 lg:items-end">
            <div className="[container-type:inline-size] lg:col-span-8">
              <p className="ui-label text-ink-2 text-[11px]">
                Private residence · {w.project.city}
                {w.project.state ? `, ${w.project.state}` : ""}
              </p>
              <h1
                id="overview-title"
                className="ui-giant text-ink mt-4 text-[length:min(176px,21.5cqi)] tracking-[-0.02em] uppercase"
              >
                {nameLead}
                {nameRest.length > 0 ? (
                  <span className="sr-only"> {nameRest.join(" ")}</span>
                ) : null}
              </h1>
              {nameRest.length > 0 ? (
                <p
                  aria-hidden="true"
                  className="ui-accent text-ink mt-3 text-[clamp(30px,3.4vw,50px)]"
                >
                  {nameRest.join(" ")}
                </p>
              ) : null}
            </div>

            {/* The real photograph, pinned over the scene. */}
            <figure className="lg:col-span-4">
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/25">
                <Image
                  src={HERO_PHOTO}
                  alt={`${w.project.name} on site`}
                  fill
                  priority
                  sizes="(min-width: 1024px) 25vw, 100vw"
                  className="object-cover"
                />
              </div>
              <figcaption className="ui-label text-ink-2 mt-2 flex justify-between gap-3 text-[10px]">
                <span>On site now</span>
                <span>
                  {recentUpdates[0]
                    ? `Updated ${formatDate(recentUpdates[0].published_at, "medium")}`
                    : "Awaiting first update"}
                </span>
              </figcaption>
            </figure>
          </div>
        </div>

        <div
          data-tour="progress"
          className="border-line bg-canvas/85 grid gap-6 border-t p-5 backdrop-blur-md sm:grid-cols-[auto_1fr] sm:items-center sm:gap-10 sm:p-8"
        >
          <ProgressRing
            value={progress}
            target={plannedProgress}
            label="Overall completion"
            caption="complete"
            tone={scheduleVariance < -5 ? "warning" : "brand"}
          />

          <div className="grid gap-x-8 gap-y-2 md:grid-cols-3">
            <SummaryRow
              label="Against plan"
              value={formatPoints(scheduleVariance)}
              tone={scheduleVariance < 0 ? "critical" : "good"}
            />
            <SummaryRow
              label="Target completion"
              value={formatDate(w.project.target_completion_date, "medium")}
            />
            <SummaryRow
              label="Contract value"
              value={formatCurrency(contract.revised, w.project.currency)}
              hint={
                contract.approvedChanges !== 0
                  ? `includes ${formatCurrency(contract.approvedChanges, w.project.currency)} of approved changes`
                  : undefined
              }
            />
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-6">
        <DelayBanner delay={d.delay} slug={w.project.slug} />

        {/* ---- What needs you ------------------------------------------ */}
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <SinceLastLooked
            items={since.items}
            since={since.since}
            isFirstVisit={since.isFirstVisit}
            now={w.now}
          />
          <div className="flex flex-col gap-4">
            <DecisionsDue
              views={d.selections}
              summary={d.selectionSummary}
              slug={w.project.slug}
              currency={w.project.currency}
            />
            {movePlan ? <MoveCard plan={movePlan} slug={w.project.slug} /> : null}
          </div>
        </div>

        {/* ---- Headline figures ---------------------------------------- */}
        <StatGrid>
          <StatTile
            label="Completion"
            value={progress.toFixed(1)}
            unit="%"
            delta={scheduleVariance}
            deltaLabel={`${Math.abs(scheduleVariance).toFixed(1)} pts`}
            deltaMeaning="up-is-good"
            icon={scheduleVariance >= 0 ? TrendingUp : TrendingDown}
            hint="Milestone progress weighted by each milestone's share of the total build."
            footer={`Plan says ${plannedProgress.toFixed(1)}% by today`}
            tone={scheduleVariance < -5 ? "warning" : "default"}
          />

          <StatTile
            label="Spent to date"
            value={formatCurrency(budget.actual, w.project.currency, { compact: true })}
            icon={Banknote}
            hint="Money actually paid out, excluding orders that are placed but not yet invoiced."
            footer={
              <>
                {formatCurrency(budget.committed, w.project.currency, { compact: true })} more
                committed · {budget.utilisation.toFixed(0)}% of budget
              </>
            }
            tone={budget.overBudgetCount > 0 ? "serious" : "default"}
          />

          <StatTile
            label="Next payment"
            raised
            value={
              payments.nextDue
                ? formatCurrency(payments.nextDue.amount, w.project.currency, { compact: true })
                : "—"
            }
            icon={CalendarClock}
            hint="The next stage payment falling due under your payment schedule."
            footer={
              payments.nextDue
                ? `${payments.nextDue.name} · due ${formatDate(payments.nextDue.due_date, "short")}`
                : "Nothing scheduled"
            }
            tone={payments.overdueCount > 0 ? "critical" : "default"}
          />

          <StatTile
            label="Days to target"
            value={daysRemaining ?? "—"}
            icon={CalendarClock}
            hint="Calendar days between today and the contractual completion date."
            footer={
              forecast.slipDays != null && forecast.slipDays > 0
                ? `Forecast is ${forecast.slipDays} days later`
                : "Forecast is on or ahead of target"
            }
            tone={forecast.slipDays != null && forecast.slipDays > 14 ? "warning" : "default"}
          />
        </StatGrid>

        {/* ---- Progress curve + health --------------------------------- */}
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <Card>
            <CardToolbar>
              <div>
                <CardTitle as="h2">Progress against plan</CardTitle>
                <CardDescription>
                  Weekly readings since work started. The gap at the right edge is where the build
                  stands relative to the programme.
                </CardDescription>
              </div>
            </CardToolbar>
            <CardContent>
              <SCurveChart snapshots={w.snapshots} targetDate={w.project.target_completion_date} />
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            <HealthScoreCard health={health} />
            <ForecastCard forecast={forecast} targetDate={w.project.target_completion_date} />
          </div>
        </div>

        {/* ---- Phases + right rail ------------------------------------- */}
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <MilestoneTracker phases={w.phases} milestones={w.milestones} now={now} />

          <div className="flex flex-col gap-4">
            <Card>
              <CardToolbar>
                <div>
                  <CardTitle as="h2">Happening on site now</CardTitle>
                  <CardDescription>
                    {activeMilestones.length === 0
                      ? "No milestones are currently open"
                      : `${activeMilestones.length} milestones underway`}
                  </CardDescription>
                </div>
              </CardToolbar>
              <CardContent>
                {activeMilestones.length === 0 ? (
                  <EmptyState
                    icon={HardHat}
                    title="Nothing open right now"
                    description="The next phase starts shortly."
                  />
                ) : (
                  <ul className="flex flex-col gap-3">
                    {activeMilestones.map((milestone) => (
                      <li key={milestone.id} className="flex flex-col gap-1.5">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-ink text-[13px] font-medium">{milestone.name}</span>
                          <span className="tabular text-ink-3 text-[12px]">
                            {milestone.progress_percent}%
                          </span>
                        </div>
                        <div className="bg-surface-3 h-1.5 w-full overflow-hidden rounded-full">
                          <div
                            className="bg-brand h-full rounded-full"
                            style={{ width: `${milestone.progress_percent}%` }}
                          />
                        </div>
                        <span className="text-ink-3 text-[11px]">
                          Due {formatDate(milestone.planned_end, "medium")}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <WeatherWidget entries={w.weather} />
          </div>
        </div>

        {/* ---- Recent updates ------------------------------------------ */}
        <section aria-labelledby="recent-updates">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <h2
                id="recent-updates"
                className="text-ink text-[15px] font-semibold tracking-[-0.01em]"
              >
                Latest from site
              </h2>
              <p className="text-ink-3 text-[13px]">
                Posted by {w.organization?.name ?? "your build team"}
              </p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/projects/${w.project.slug}/updates`}>
                All updates
                <ArrowRight />
              </Link>
            </Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {recentUpdates.map((update) => (
              <UpdateCard
                key={update.id}
                update={update}
                media={recent.media.filter((m) => m.update_id === update.id)}
                author={w.profiles.find((p) => p.id === update.author_id)}
                milestone={w.milestones.find((m) => m.id === update.milestone_id)}
                now={now}
                isDemo={w.isDemo}
                slug={w.project.slug}
              />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

/** The move-in plan, reduced to the one thing to do next. */
function MoveCard({ plan, slug }: { plan: ReturnType<typeof buildMovePlan>; slug: string }) {
  return (
    <Card>
      <CardToolbar>
        <div>
          <CardTitle as="h2">Your move</CardTitle>
          <CardDescription>
            {plan.daysToAnchor > 0
              ? `About ${plan.daysToAnchor} days to handover`
              : "Handover is here"}{" "}
            · {plan.done} of {plan.total} done
          </CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/projects/${slug}/move-in`}>
            Planner
            <ArrowRight />
          </Link>
        </Button>
      </CardToolbar>
      <CardContent>
        {plan.next ? (
          <div className="flex items-start gap-3">
            <span className="bg-surface-3 text-ink-2 grid size-9 shrink-0 place-items-center">
              <Truck className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-ink text-[13px] font-medium">{plan.next.title}</p>
              <p
                className={cn(
                  "text-[12px]",
                  plan.overdue > 0 ? "text-critical-ink font-medium" : "text-ink-3",
                )}
              >
                {plan.overdue > 0
                  ? `${plan.overdue} task${plan.overdue === 1 ? "" : "s"} past due`
                  : `By ${formatDate(plan.next.dueDate, "medium")}`}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-ink-3 text-[13px]">Everything on the plan is done.</p>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryRow({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "good" | "critical";
}) {
  return (
    <div className="border-line flex items-baseline justify-between gap-3 border-b pb-2 last:border-0 last:pb-0">
      <span className="text-ink-3 text-[12px]">{label}</span>
      <span className="text-right">
        <span
          className={
            tone === "critical"
              ? "text-critical-ink text-[13px] font-semibold"
              : tone === "good"
                ? "text-good-ink text-[13px] font-semibold"
                : "text-ink text-[13px] font-semibold"
          }
        >
          {value}
        </span>
        {hint ? <span className="text-ink-3 block text-[10px]">{hint}</span> : null}
      </span>
    </div>
  );
}
