import type { Metadata } from "next";

import { StatusBadge } from "@/components/ui/badge";
import { getUpdates, getUpdateStats } from "@/lib/data/feeds";
import { getWorkspace, requestNow } from "@/lib/data/workspace";
import { contractPosition, rollUpBudget, summarisePayments } from "@/lib/domain/finance";
import { forecastCompletion, scoreHealth } from "@/lib/domain/forecast";
import { computeSchedule, slippageDays } from "@/lib/domain/schedule";
import { daysBetween, formatCurrency, formatDate, formatPoints } from "@/lib/format";
import { cn, sumBy } from "@/lib/utils";

import { PrintButton } from "./print-button";
import "./print.css";

export const metadata: Metadata = {
  title: "Progress report",
  robots: { index: false, follow: false },
};

/**
 * A printable progress report.
 *
 * Rendered as a document rather than as a dashboard: one column, ruled
 * sections, tables that repeat their headers across pages, and no interactive
 * chrome. The print stylesheet strips the app's navigation and flattens the
 * parchment palette to ink, because a warm background wastes toner and makes
 * hairlines vanish.
 *
 * This is deliberately server-rendered with no client charts. A report is a
 * record of a moment; anything that animates or depends on hover has no
 * meaning once it is on paper.
 */
export default async function ReportPage({ params }: PageProps<"/projects/[slug]/report">) {
  const { slug } = await params;
  const cutoff = new Date(new Date(requestNow()).getTime() - 30 * 86_400_000).toISOString();
  const [w, recent, month] = await Promise.all([
    getWorkspace(slug, [
      "milestones",
      "dependencies",
      "phases",
      "snapshots",
      "budgetCategories",
      "costEntries",
      "changeOrders",
      "payments",
      "issues",
      "weather",
      "profiles",
    ]),
    getUpdates(slug, { limit: 5 }),
    getUpdateStats(slug, cutoff),
  ]);
  const now = new Date(w.now);
  const today = w.now.slice(0, 10);
  const currency = w.project.currency;

  const totalWeight = sumBy(w.milestones, (m) => m.weight);
  const progress =
    totalWeight > 0 ? sumBy(w.milestones, (m) => m.progress_percent * m.weight) / totalWeight : 0;
  const planned = w.snapshots[w.snapshots.length - 1]?.planned_percent ?? 0;

  const schedule = computeSchedule(w.milestones, w.dependencies);
  const budget = rollUpBudget(w.budgetCategories, w.costEntries);
  const contract = contractPosition(w.project, w.changeOrders);
  const payments = summarisePayments(w.payments, now);
  const forecast = forecastCompletion(w.snapshots, w.project.target_completion_date, { asOf: now });

  const openIssues = w.issues.filter(
    (i) => i.status === "open" || i.status === "acknowledged" || i.status === "in_progress",
  );

  const health = scoreHealth({
    scheduleVariance: progress - planned,
    costVariance: budget.remaining,
    budgetTotal: budget.budgeted,
    openIssues,
    weather: w.weather,
    asOf: now,
  });

  const active = w.milestones.filter((m) => m.status === "in_progress" || m.status === "blocked");
  const recentUpdates = recent.updates;

  return (
    <div className="report">
      <div className="print-hide mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-3 text-[12px]">
          This page is laid out for print. Use your browser&apos;s print dialog, or the button, and
          choose &ldquo;Save as PDF&rdquo; to file it.
        </p>
        <PrintButton />
      </div>

      <article className="report__sheet flex flex-col gap-8">
        {/* ---- Masthead ------------------------------------------------- */}
        <header className="report__rule flex flex-wrap items-end justify-between gap-4 pb-4">
          <div>
            <p className="ui-label text-ink-3 text-[10px]">Construction progress report</p>
            <h1 className="ui-display text-ink mt-1 text-3xl">{w.project.name}</h1>
            <p className="report__ink-soft text-ink-2 mt-1 text-[13px]">
              {w.project.address_line1}
              {w.project.address_line2 ? `, ${w.project.address_line2}` : ""}, {w.project.city}
              {w.project.state ? `, ${w.project.state}` : ""} {w.project.postal_code ?? ""}
            </p>
          </div>

          <div className="text-right">
            <p className="ui-label text-ink-3 text-[10px]">Issued</p>
            <p className="ui-display text-ink text-lg">{formatDate(today, "long")}</p>
            <p className="report__ink-soft text-ink-3 mt-0.5 text-[11px]">
              {w.organization?.name ?? "Build team"}
            </p>
          </div>
        </header>

        {/* ---- Summary --------------------------------------------------- */}
        <section className="flex flex-col gap-3">
          <SectionTitle>Summary</SectionTitle>

          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
            <Figure
              label="Completion"
              value={`${progress.toFixed(1)}%`}
              note={`Plan ${planned.toFixed(1)}%`}
            />
            <Figure
              label="Against plan"
              value={formatPoints(progress - planned)}
              note={progress >= planned ? "Ahead" : "Behind"}
            />
            <Figure
              label="Contract value"
              value={formatCurrency(contract.revised, currency)}
              note={`incl. ${formatCurrency(contract.approvedChanges, currency)} changes`}
            />
            <Figure label="Health" value={`${health.score}/100`} note={health.grade} />
          </dl>

          <p className="text-ink-2 mt-1 text-[13px] leading-relaxed">
            The build is {progress.toFixed(1)}% complete against a programme expectation of{" "}
            {planned.toFixed(1)}% for today, a variance of {formatPoints(progress - planned)}.{" "}
            {forecast.projectedDate
              ? `Projecting the recent rate of progress forward gives a completion date of ${formatDate(
                  forecast.projectedDate,
                  "long",
                )}, against a contract date of ${formatDate(w.project.target_completion_date, "long")}. That projection is a trend through the last ${forecast.sampleSize} readings and carries ${forecast.confidence} confidence — it is not a revised commitment.`
              : "There is not yet enough progress history to project a completion date independently."}
          </p>
        </section>

        {/* ---- Work in progress ------------------------------------------ */}
        <section className="flex flex-col gap-3">
          <SectionTitle>Work in progress</SectionTitle>

          {active.length === 0 ? (
            <p className="text-ink-3 text-[13px]">No milestones are currently open on site.</p>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="report__rule text-left">
                  <Th>Milestone</Th>
                  <Th>Phase</Th>
                  <Th>Planned finish</Th>
                  <Th align="right">Progress</Th>
                  <Th align="right">Float</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody className="divide-line divide-y">
                {active.map((milestone) => {
                  const task = schedule.tasks.get(milestone.id);
                  const phase = w.phases.find((p) => p.id === milestone.phase_id);
                  const slip = slippageDays(milestone, now);

                  return (
                    <tr key={milestone.id} className="report__row">
                      <Td className="font-medium">{milestone.name}</Td>
                      <Td className="report__ink-soft text-ink-3">{phase?.name ?? "—"}</Td>
                      <Td className={cn(slip > 0 && "text-critical-ink font-medium")}>
                        {formatDate(milestone.planned_end, "medium")}
                        {slip > 0 ? ` (${slip}d late)` : ""}
                      </Td>
                      <Td align="right" className="tabular">
                        {milestone.progress_percent}%
                      </Td>
                      <Td align="right" className="tabular report__ink-soft text-ink-3">
                        {task?.isCritical ? "critical" : `${task?.totalFloat ?? 0}d`}
                      </Td>
                      <Td>
                        <span data-print-keep-colour="true">
                          <StatusBadge kind="work" value={milestone.status} />
                        </span>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        {/* ---- Financial position ---------------------------------------- */}
        <section className="flex flex-col gap-3">
          <SectionTitle>Financial position</SectionTitle>

          <table className="w-full text-[12px]">
            <thead>
              <tr className="report__rule text-left">
                <Th>Cost category</Th>
                <Th align="right">Budget</Th>
                <Th align="right">Spent</Th>
                <Th align="right">Committed</Th>
                <Th align="right">Remaining</Th>
              </tr>
            </thead>
            <tbody className="divide-line divide-y">
              {budget.categories.map((category) => (
                <tr key={category.id} className="report__row">
                  <Td>{category.name}</Td>
                  <Td align="right" className="tabular">
                    {formatCurrency(category.budgeted, currency)}
                  </Td>
                  <Td align="right" className="tabular">
                    {formatCurrency(category.actual, currency)}
                  </Td>
                  <Td align="right" className="tabular">
                    {formatCurrency(category.committed, currency)}
                  </Td>
                  <Td
                    align="right"
                    className={cn(
                      "tabular font-medium",
                      category.isOverBudget && "text-critical-ink",
                    )}
                  >
                    {formatCurrency(category.remaining, currency)}
                  </Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-line-strong border-t-2 font-semibold">
                <Td>Total</Td>
                <Td align="right" className="tabular">
                  {formatCurrency(budget.budgeted, currency)}
                </Td>
                <Td align="right" className="tabular">
                  {formatCurrency(budget.actual, currency)}
                </Td>
                <Td align="right" className="tabular">
                  {formatCurrency(budget.committed, currency)}
                </Td>
                <Td align="right" className="tabular">
                  {formatCurrency(budget.remaining, currency)}
                </Td>
              </tr>
            </tfoot>
          </table>

          <p className="text-ink-2 text-[12px] leading-relaxed">
            {formatCurrency(payments.paid, currency)} of the{" "}
            {formatCurrency(payments.total, currency)} payment schedule has been settled.{" "}
            {payments.nextDue
              ? `The next stage payment, ${payments.nextDue.name}, falls due on ${formatDate(payments.nextDue.due_date, "long")} at ${formatCurrency(payments.nextDue.amount, currency)}.`
              : "No further stage payments are scheduled."}
            {payments.overdueCount > 0
              ? ` ${payments.overdueCount} payment${payments.overdueCount === 1 ? " is" : "s are"} overdue.`
              : ""}
          </p>
        </section>

        {/* ---- Quality ---------------------------------------------------- */}
        <section className="flex flex-col gap-3">
          <SectionTitle>Open issues</SectionTitle>

          {openIssues.length === 0 ? (
            <p className="text-ink-3 text-[13px]">
              No issues are outstanding at the date of this report.
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {openIssues.map((issue) => (
                <li
                  key={issue.id}
                  className="report__row border-line border-b pb-2.5 last:border-0"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-ink text-[13px] font-medium">{issue.title}</p>
                    <span data-print-keep-colour="true">
                      <StatusBadge kind="severity" value={issue.severity} />
                    </span>
                  </div>
                  {issue.description ? (
                    <p className="report__ink-soft text-ink-2 mt-1 text-[12px] leading-relaxed">
                      {issue.description}
                    </p>
                  ) : null}
                  <p className="report__ink-soft text-ink-3 mt-1 text-[11px]">
                    {issue.location ? `${issue.location} · ` : ""}
                    Raised {formatDate(issue.created_at, "medium")}
                    {issue.due_date ? ` · due ${formatDate(issue.due_date, "medium")}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---- Site activity ---------------------------------------------- */}
        <section className="report__page-break flex flex-col gap-3">
          <SectionTitle>Site activity, last 30 days</SectionTitle>

          <p className="report__ink-soft text-ink-2 text-[12px]">
            {month.count} update{month.count === 1 ? "" : "s"} posted · {month.hours.toFixed(0)}{" "}
            crew hours logged ·{" "}
            {w.weather
              .slice(0, 30)
              .reduce(
                (t, e) =>
                  t + (e.work_impact === "full" ? 1 : e.work_impact === "partial" ? 0.5 : 0),
                0,
              )}{" "}
            days affected by weather
          </p>

          <ul className="flex flex-col gap-3">
            {recentUpdates.map((update) => (
              <li key={update.id} className="report__row border-line border-b pb-3 last:border-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-ink text-[13px] font-medium">{update.title}</p>
                  <p className="report__ink-soft text-ink-3 text-[11px]">
                    {formatDate(update.published_at, "medium")}
                  </p>
                </div>
                <p className="report__ink-soft text-ink-2 mt-1 text-[12px] leading-relaxed">
                  {update.body}
                </p>
                <p className="report__ink-soft text-ink-3 mt-1 text-[11px]">
                  {update.crew_size ?? "—"} crew · {update.hours_worked ?? "—"} hours ·{" "}
                  {update.weather ?? "—"}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* ---- Sign-off ---------------------------------------------------- */}
        <section className="report__rule border-t pt-6">
          <div className="grid gap-8 sm:grid-cols-2">
            {[
              { role: "Site manager", name: w.project.site_manager_name },
              { role: "Buyer", name: w.profiles.find((p) => p.role === "buyer")?.full_name },
            ].map((party) => (
              <div key={party.role}>
                <div className="border-line-strong h-12 border-b" />
                <p className="ui-label text-ink-3 mt-1.5 text-[9px]">{party.role}</p>
                <p className="text-ink text-[12px]">{party.name ?? "—"}</p>
              </div>
            ))}
          </div>

          <p className="report__ink-soft text-ink-3 mt-8 text-[10px] leading-relaxed">
            Figures are as at {formatDate(today, "long")} and are derived from the project record
            held on the platform. The completion projection is a statistical trend, not a
            contractual commitment. Days remaining to contract completion:{" "}
            {w.project.target_completion_date
              ? daysBetween(today, w.project.target_completion_date)
              : "—"}
            .
          </p>
        </section>
      </article>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="ui-label text-ink border-line-strong border-b pb-1.5 text-[10px]">{children}</h2>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <dt className="ui-label text-ink-3 text-[9px]">{label}</dt>
      <dd className="ui-display text-ink mt-0.5 text-xl">{value}</dd>
      {note ? <p className="report__ink-soft text-ink-3 text-[11px]">{note}</p> : null}
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <th
      scope="col"
      className={cn(
        "ui-label text-ink-3 py-1.5 pr-3 text-[9px]",
        align === "right" && "text-right",
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  className,
}: {
  children: React.ReactNode;
  align?: "right";
  className?: string;
}) {
  return (
    <td className={cn("py-1.5 pr-3", align === "right" && "text-right", className)}>{children}</td>
  );
}
