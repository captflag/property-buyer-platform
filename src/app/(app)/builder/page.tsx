import { Banknote, HardHat, Info, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/app-shell";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardTitle, CardToolbar } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { StatGrid, StatTile } from "@/components/widgets/stat-tile";
import { getUpdates } from "@/lib/data/feeds";
import { getPortfolio, type PortfolioSite } from "@/lib/data/portfolio";
import { getWorkspace } from "@/lib/data/workspace";
import { summariseDraws } from "@/lib/domain/finance";
import { expectedProgress, slippageDays } from "@/lib/domain/schedule";
import { formatCurrency, formatDate, formatPoints, formatRelative, humanise } from "@/lib/format";
import { cn } from "@/lib/utils";

import { UpdateComposer } from "./update-composer";
import { VisitDecisions } from "./visit-decisions";

export const metadata: Metadata = { title: "Site console" };

const SITE_COLUMNS = [
  "Site",
  "Progress",
  "Against plan",
  "Budget",
  "Open issues",
  "Overdue payments",
  "Handover",
];

/**
 * Every site the builder can see, the ones needing attention first. Each row
 * opens the console for that site; the one the console is showing is marked.
 */
function YourSites({ sites, current }: { sites: PortfolioSite[]; current: string }) {
  return (
    <Card>
      <CardToolbar>
        <div>
          <CardTitle as="h2">Your sites</CardTitle>
          <CardDescription>
            {sites.length} {sites.length === 1 ? "project" : "projects"}, the ones needing attention
            first
          </CardDescription>
        </div>
      </CardToolbar>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead>
              <tr className="border-line border-b text-left">
                {SITE_COLUMNS.map((label) => (
                  <th
                    key={label}
                    scope="col"
                    className="ui-label text-ink-3 py-2 pr-4 text-[10px] font-normal"
                  >
                    {label}
                  </th>
                ))}
                <th scope="col" className="py-2">
                  <span className="sr-only">Console</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-line divide-y">
              {sites.map((site) => {
                const isCurrent = site.slug === current;
                return (
                  <tr
                    key={site.projectId}
                    aria-current={isCurrent ? "true" : undefined}
                    className={cn(isCurrent && "bg-surface-2")}
                  >
                    <th scope="row" className="py-2.5 pr-4 text-left font-normal">
                      <span className="text-ink block font-semibold">{site.name}</span>
                      <span className="text-ink-3 text-[12px]">
                        {[site.city, site.role ? humanise(site.role) : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </th>
                    <td className="tabular py-2.5 pr-4">{site.progress.toFixed(1)}%</td>
                    <td
                      className={cn(
                        "tabular py-2.5 pr-4",
                        site.scheduleVariance < -2 ? "text-critical-ink" : "text-ink-2",
                      )}
                    >
                      {formatPoints(site.scheduleVariance)}
                    </td>
                    <td
                      className={cn(
                        "tabular py-2.5 pr-4",
                        site.costVariance < 0 && "text-critical-ink",
                      )}
                    >
                      {site.costVariance < 0
                        ? `${formatCurrency(-site.costVariance, site.currency, { compact: true })} over`
                        : `${formatCurrency(site.costVariance, site.currency, { compact: true })} left`}
                    </td>
                    <td className="tabular py-2.5 pr-4">
                      {site.openIssues}
                      {site.criticalIssues > 0 ? (
                        <span className="text-critical-ink"> · {site.criticalIssues} critical</span>
                      ) : null}
                    </td>
                    <td
                      className={cn(
                        "tabular py-2.5 pr-4",
                        site.overduePayments > 0 && "text-critical-ink",
                      )}
                    >
                      {site.overduePayments}
                    </td>
                    <td className="tabular py-2.5 pr-4">
                      {site.daysRemaining == null
                        ? "—"
                        : site.daysRemaining < 0
                          ? `${-site.daysRemaining} days past`
                          : `${site.daysRemaining} days`}
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      {isCurrent ? (
                        <span className="text-ink-3 text-[12px]">In the console</span>
                      ) : (
                        <Link
                          href={`/builder?project=${encodeURIComponent(site.slug)}`}
                          className="text-ink decoration-accent text-[12px] font-semibold underline underline-offset-4 hover:decoration-2"
                        >
                          Open console
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function BuilderPage({ searchParams }: PageProps<"/builder">) {
  const query = await searchParams;
  // `?project=` picks the site the console acts on; without it, the most recent.
  const slug = typeof query.project === "string" ? query.project : undefined;

  const [w, latest, sites] = await Promise.all([
    getWorkspace(slug, ["drawRequests", "issues", "milestones", "profiles", "siteVisits"]),
    getUpdates(slug, { limit: 1 }),
    getPortfolio(),
  ]);

  if (!w.project.id) {
    return (
      <>
        <PageHeader title="Site console" description="Post updates and keep the record straight." />
        <div className="flex flex-col gap-6">
          <EmptyState
            icon={HardHat}
            title={slug ? "That site is not one of yours" : "No sites yet"}
            description={
              slug
                ? "Choose one of your sites below, or ask the project owner to add you to it."
                : "When you are added to a project as its builder, its console appears here."
            }
          />
          {sites.length > 0 ? <YourSites sites={sites} current="" /> : null}
        </div>
      </>
    );
  }

  const now = new Date(w.now);
  const lastUpdate = latest.updates[0];
  const currency = w.project.currency;

  const draws = summariseDraws(w.drawRequests);
  const awaiting = w.drawRequests.filter(
    (d) => d.status === "submitted" || d.status === "under_review",
  );

  const active = w.milestones.filter((m) => m.status === "in_progress" || m.status === "blocked");

  const behind = active
    .map((m) => ({ milestone: m, expected: expectedProgress(m, now), slip: slippageDays(m, now) }))
    .filter((e) => e.slip > 0 || e.milestone.progress_percent < e.expected - 8)
    .sort((a, b) => b.slip - a.slip);

  const openIssues = w.issues.filter(
    (i) => i.status === "open" || i.status === "acknowledged" || i.status === "in_progress",
  );

  const daysSinceUpdate = lastUpdate
    ? Math.floor((now.getTime() - new Date(lastUpdate.published_at).getTime()) / 86_400_000)
    : null;

  return (
    <>
      <PageHeader
        title="Site console"
        description={`Post updates and keep the record straight for ${w.project.name}.`}
      />

      <div className="flex flex-col gap-6">
        {w.isDemo ? (
          <Alert tone="warning" icon={Info} title="Demo mode">
            There is no database connected, so the forms below validate and give feedback but do not
            save. Connect a Supabase project and they write for real, with row-level security
            deciding who may post what.
          </Alert>
        ) : null}

        <YourSites sites={sites} current={w.project.slug} />

        <StatGrid>
          <StatTile
            label="Days since last update"
            value={daysSinceUpdate ?? "—"}
            icon={HardHat}
            tone={daysSinceUpdate != null && daysSinceUpdate > 7 ? "warning" : "default"}
            footer={
              lastUpdate
                ? `Last posted ${formatRelative(lastUpdate.published_at, now)}`
                : "Nothing posted yet"
            }
          />
          <StatTile
            label="Milestones open"
            value={`${active.length}`}
            footer={`${behind.length} behind pace or overdue`}
            tone={behind.length > 0 ? "warning" : "default"}
          />
          <StatTile
            label="Draws awaiting decision"
            value={`${awaiting.length}`}
            icon={Banknote}
            tone={awaiting.length > 0 ? "warning" : "default"}
            footer={
              formatCurrency(draws.awaitingDecision, currency, { compact: true }) + " in value"
            }
          />
          <StatTile
            label="Open issues"
            value={`${openIssues.length}`}
            icon={TriangleAlert}
            tone={openIssues.some((i) => i.severity === "critical") ? "critical" : "default"}
            footer={`${openIssues.filter((i) => i.severity === "high" || i.severity === "critical").length} high or critical`}
          />
        </StatGrid>

        <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
          <UpdateComposer milestones={w.milestones} projectSlug={w.project.slug} />

          <div className="flex flex-col gap-4">
            <VisitDecisions
              visits={w.siteVisits}
              timeZone={w.project.timezone}
              requesterNames={Object.fromEntries(
                w.profiles.map((p) => [p.id, p.full_name ?? "Buyer"]),
              )}
            />

            <Card>
              <CardToolbar>
                <div>
                  <CardTitle as="h2">Needs your attention</CardTitle>
                  <CardDescription>Open milestones running behind pace</CardDescription>
                </div>
              </CardToolbar>
              <CardContent>
                {behind.length === 0 ? (
                  <EmptyState
                    icon={HardHat}
                    title="Everything is on pace"
                    description="No open milestone is behind where the plan expects it today."
                  />
                ) : (
                  <ul className="divide-line divide-y">
                    {behind.map(({ milestone, expected, slip }) => (
                      <li
                        key={milestone.id}
                        className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-ink text-[13px] font-medium">{milestone.name}</span>
                          <StatusBadge kind="work" value={milestone.status} />
                        </div>

                        <Progress
                          value={milestone.progress_percent}
                          label={`${milestone.name} progress`}
                          size="sm"
                          tone={slip > 0 ? "critical" : "warning"}
                        />

                        <p className="text-ink-3 text-[11px]">
                          {milestone.progress_percent}% done, plan expects {expected}% ·{" "}
                          {slip > 0
                            ? `${slip} days past its finish of ${formatDate(milestone.planned_end, "short")}`
                            : `due ${formatDate(milestone.planned_end, "short")}`}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardToolbar>
                <div>
                  <CardTitle as="h2">Draw requests</CardTitle>
                  <CardDescription>Awaiting a decision from the buyer</CardDescription>
                </div>
              </CardToolbar>
              <CardContent>
                {awaiting.length === 0 ? (
                  <EmptyState icon={Banknote} title="Nothing outstanding" />
                ) : (
                  <ul className="flex flex-col gap-3">
                    {awaiting.map((draw) => (
                      <li
                        key={draw.id}
                        className="border-line rounded-[var(--radius-card)] border p-3"
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-ink text-[13px] font-semibold">
                            {draw.reference}
                          </span>
                          <span className="tabular text-ink text-[13px] font-semibold">
                            {formatCurrency(draw.amount, currency)}
                          </span>
                        </div>
                        {draw.justification ? (
                          <p className="text-ink-3 mt-1.5 text-[12px] leading-relaxed">
                            {draw.justification}
                          </p>
                        ) : null}
                        {draw.submitted_at ? (
                          <p className="text-ink-3 mt-2 text-[11px]">
                            Submitted {formatRelative(draw.submitted_at, now)}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
