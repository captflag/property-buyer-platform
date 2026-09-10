import { Activity, CloudRain, Gauge, TrendingDown, TrendingUp } from "lucide-react";
import type { Metadata } from "next";

import { CashflowChart } from "@/components/charts/budget-charts";
import { SCurveChart } from "@/components/charts/s-curve-chart";
import { PageHeader } from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardTitle, CardToolbar } from "@/components/ui/card";
import { ForecastCard } from "@/components/widgets/forecast-card";
import { HealthScoreCard } from "@/components/widgets/health-score";
import { StatGrid, StatTile } from "@/components/widgets/stat-tile";
import { WeatherWidget } from "@/components/widgets/weather-widget";
import { getWorkspace } from "@/lib/data/workspace";
import { rollUpBudget } from "@/lib/domain/finance";
import { earnedValue, forecastCompletion, scoreHealth } from "@/lib/domain/forecast";
import { computeSchedule } from "@/lib/domain/schedule";
import { formatCurrency, formatPoints } from "@/lib/format";
import { cn, sumBy } from "@/lib/utils";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage({ params }: PageProps<"/projects/[slug]/analytics">) {
  const { slug } = await params;
  const w = await getWorkspace(slug, [
    "milestones",
    "dependencies",
    "phases",
    "snapshots",
    "budgetCategories",
    "costEntries",
    "issues",
    "weather",
  ]);
  const now = new Date(w.now);
  const currency = w.project.currency;

  const totalWeight = sumBy(w.milestones, (m) => m.weight);
  const progress =
    totalWeight > 0 ? sumBy(w.milestones, (m) => m.progress_percent * m.weight) / totalWeight : 0;

  const latest = w.snapshots[w.snapshots.length - 1];
  const planned = latest?.planned_percent ?? 0;
  const scheduleVariance = progress - planned;

  const budget = rollUpBudget(w.budgetCategories, w.costEntries);
  const evm = earnedValue(budget.budgeted, planned, progress, budget.actual);
  const forecast = forecastCompletion(w.snapshots, w.project.target_completion_date, { asOf: now });
  const schedule = computeSchedule(w.milestones, w.dependencies);

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

  const floatByPhase = w.phases.map((phase) => {
    const tasks = w.milestones
      .filter((m) => m.phase_id === phase.id)
      .map((m) => schedule.tasks.get(m.id))
      .filter(Boolean);
    const minFloat = tasks.length > 0 ? Math.min(...tasks.map((t) => t!.totalFloat)) : 0;
    return { phase, minFloat, criticalCount: tasks.filter((t) => t!.isCritical).length };
  });

  return (
    <>
      <PageHeader
        title="Analytics"
        scene="concreteNight"
        description="Earned value, schedule performance and the things eating into your float."
      />

      <div className="flex flex-col gap-6">
        <StatGrid>
          <StatTile
            label="Schedule performance"
            value={evm.schedulePerformanceIndex?.toFixed(2) ?? "—"}
            icon={
              evm.schedulePerformanceIndex && evm.schedulePerformanceIndex >= 1
                ? TrendingUp
                : TrendingDown
            }
            hint="Earned value divided by planned value. Below 1.00 means less work has been done than the plan called for by now."
            tone={
              evm.schedulePerformanceIndex != null && evm.schedulePerformanceIndex < 0.95
                ? "warning"
                : "default"
            }
            footer={formatPoints(scheduleVariance) + " against plan"}
          />
          <StatTile
            label="Cost performance"
            value={evm.costPerformanceIndex?.toFixed(2) ?? "—"}
            icon={Gauge}
            hint="Earned value divided by actual cost. Above 1.00 means the work completed cost less than budgeted for it."
            tone={
              evm.costPerformanceIndex != null && evm.costPerformanceIndex < 0.95
                ? "warning"
                : "default"
            }
            footer={`${formatCurrency(evm.earnedValue, currency, { compact: true })} earned on ${formatCurrency(evm.actualCost, currency, { compact: true })} spent`}
          />
          <StatTile
            label="Estimate at completion"
            value={
              evm.estimateAtCompletion
                ? formatCurrency(evm.estimateAtCompletion, currency, { compact: true })
                : "—"
            }
            hint="What the whole build is projected to cost if current cost performance continues."
            tone={
              evm.varianceAtCompletion != null && evm.varianceAtCompletion < 0
                ? "serious"
                : "default"
            }
            footer={
              evm.varianceAtCompletion == null
                ? "Not enough spend to project"
                : evm.varianceAtCompletion >= 0
                  ? `${formatCurrency(evm.varianceAtCompletion, currency, { compact: true })} under budget`
                  : `${formatCurrency(Math.abs(evm.varianceAtCompletion), currency, { compact: true })} over budget`
            }
          />
          <StatTile
            label="Health score"
            value={`${health.score}`}
            unit="/100"
            icon={Activity}
            tone={
              health.grade === "good"
                ? "good"
                : health.grade === "warning"
                  ? "warning"
                  : health.grade === "serious"
                    ? "serious"
                    : "critical"
            }
            footer="Schedule 40 · Cost 30 · Quality 20 · Weather 10"
          />
        </StatGrid>

        <Card>
          <CardToolbar>
            <div>
              <CardTitle as="h2">Progress against plan</CardTitle>
              <CardDescription>
                The full history. Where the two lines separate is where the project lost ground.
              </CardDescription>
            </div>
          </CardToolbar>
          <CardContent>
            <SCurveChart snapshots={w.snapshots} targetDate={w.project.target_completion_date} />
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-3">
          <HealthScoreCard health={health} />
          <ForecastCard forecast={forecast} targetDate={w.project.target_completion_date} />
          <WeatherWidget entries={w.weather} />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardToolbar>
              <div>
                <CardTitle as="h2">Cash flow</CardTitle>
                <CardDescription>Cumulative spend against budget</CardDescription>
              </div>
            </CardToolbar>
            <CardContent>
              <CashflowChart
                costs={w.costEntries}
                budgetTotal={budget.budgeted}
                currency={currency}
              />
            </CardContent>
          </Card>

          <Card>
            <CardToolbar>
              <div>
                <CardTitle as="h2">Float by phase</CardTitle>
                <CardDescription>
                  How much slack each phase has before it starts pushing the end date
                </CardDescription>
              </div>
            </CardToolbar>
            <CardContent>
              <ul className="flex flex-col gap-2.5">
                {floatByPhase.map(({ phase, minFloat, criticalCount }) => (
                  <li key={phase.id} className="flex items-center justify-between gap-3">
                    <span className="text-ink-2 min-w-0 truncate text-[12px]">{phase.name}</span>
                    <span
                      className={cn(
                        "tabular ui-chip shrink-0 px-2 py-0.5 text-[11px] font-semibold",
                        criticalCount > 0
                          ? "bg-critical-subtle text-critical-ink"
                          : minFloat <= 5
                            ? "bg-warning-subtle text-warning-ink"
                            : "bg-good-subtle text-good-ink",
                      )}
                    >
                      {criticalCount > 0 ? "No float" : `${minFloat} days`}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-ink-3 border-line mt-3 border-t pt-3 text-[11px] leading-relaxed">
                A phase with no float sits on the critical path: every day it slips is a day added
                to the completion date. Phases with float can absorb a delay without moving anything
                downstream.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardToolbar>
            <div>
              <CardTitle as="h2">Reading these numbers</CardTitle>
              <CardDescription>What each index means, and what it does not</CardDescription>
            </div>
          </CardToolbar>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Explainer
                icon={TrendingUp}
                term="Schedule performance index (SPI)"
                detail="Work completed divided by work planned, both measured in budget terms. An SPI of 0.93 means roughly 93% of the planned work is done. It says nothing about whether the remaining work is harder."
              />
              <Explainer
                icon={Gauge}
                term="Cost performance index (CPI)"
                detail="Value delivered per unit spent. A CPI above 1.00 is favourable, but early in a build it is often flattered by front-loaded budgets and should be treated cautiously."
              />
              <Explainer
                icon={Activity}
                term="Estimate at completion (EAC)"
                detail="Total budget divided by CPI — what the build costs if current efficiency holds to the end. It assumes past performance predicts future performance, which is a real assumption, not a certainty."
              />
              <Explainer
                icon={CloudRain}
                term="Weather impact"
                detail="Days on which conditions stopped or halved outside work. Counted from the site log rather than a forecast, so it reflects what actually happened on the ground."
              />
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Explainer({
  icon: Icon,
  term,
  detail,
}: {
  icon: typeof Activity;
  term: string;
  detail: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="bg-surface-3 text-ink-2 mt-0.5 grid size-8 shrink-0 place-items-center rounded-[var(--radius-card)]">
        <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <div>
        <dt className="text-ink text-[12px] font-semibold">{term}</dt>
        <dd className="text-ink-2 mt-0.5 text-[12px] leading-relaxed">{detail}</dd>
      </div>
    </div>
  );
}
