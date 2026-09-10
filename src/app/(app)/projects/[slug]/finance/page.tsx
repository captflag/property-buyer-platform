import { AlertTriangle, Banknote, FileSignature, TrendingDown, Wallet } from "lucide-react";
import type { Metadata } from "next";

import {
  BudgetBarChart,
  CashflowChart,
  SpendCompositionBar,
} from "@/components/charts/budget-charts";
import { PageHeader } from "@/components/layout/app-shell";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardTitle, CardToolbar } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { StatGrid, StatTile } from "@/components/widgets/stat-tile";
import { getWorkspace } from "@/lib/data/workspace";
import {
  contractPosition,
  costPerformanceIndex,
  rollUpBudget,
  summariseDraws,
  summarisePayments,
} from "@/lib/domain/finance";
import { formatCurrency, formatDate, humanise } from "@/lib/format";
import { cn, sumBy } from "@/lib/utils";

export const metadata: Metadata = { title: "Finance" };

export default async function FinancePage({ params }: PageProps<"/projects/[slug]/finance">) {
  const { slug } = await params;
  const w = await getWorkspace(slug, [
    "milestones",
    "budgetCategories",
    "costEntries",
    "changeOrders",
    "payments",
    "drawRequests",
  ]);
  const now = new Date(w.now);
  const currency = w.project.currency;

  const budget = rollUpBudget(w.budgetCategories, w.costEntries);
  const contract = contractPosition(w.project, w.changeOrders);
  const payments = summarisePayments(w.payments, now);
  const draws = summariseDraws(w.drawRequests);

  const totalWeight = sumBy(w.milestones, (m) => m.weight);
  const progress =
    totalWeight > 0 ? sumBy(w.milestones, (m) => m.progress_percent * m.weight) / totalWeight : 0;

  const cpi = costPerformanceIndex(progress, budget.budgeted, budget.actual);

  return (
    <>
      <PageHeader
        title="Finance"
        scene="penthouse"
        description="What your home costs, what has been spent against it, and what falls due next."
      />

      <div className="flex flex-col gap-6">
        {budget.overBudgetCount > 0 ? (
          <Alert tone="serious" icon={AlertTriangle} title="Some categories are running over">
            {budget.overBudgetCount} cost{" "}
            {budget.overBudgetCount === 1 ? "category has" : "categories have"} committed more than
            the budget allows. That does not automatically increase your contract price — it is
            absorbed by contingency first — but it is worth asking about at the next site meeting.
          </Alert>
        ) : null}

        <StatGrid>
          <StatTile
            label="Contract value"
            value={formatCurrency(contract.revised, currency, { compact: true })}
            icon={FileSignature}
            hint="Original contract plus approved change orders. Proposed changes are not included."
            footer={
              contract.approvedChanges !== 0 ? (
                <>
                  {formatCurrency(contract.original, currency, { compact: true })} original ·{" "}
                  {formatCurrency(contract.approvedChanges, currency, { compact: true })} in
                  approved changes
                </>
              ) : (
                "No approved changes"
              )
            }
          />

          <StatTile
            label="Paid to date"
            value={formatCurrency(payments.paid, currency, { compact: true })}
            icon={Banknote}
            footer={`${payments.percentPaid.toFixed(0)}% of the payment schedule`}
          />

          <StatTile
            label="Outstanding"
            value={formatCurrency(payments.outstanding, currency, { compact: true })}
            icon={Wallet}
            tone={payments.overdueCount > 0 ? "critical" : "default"}
            footer={
              payments.overdueCount > 0
                ? `${payments.overdueCount} payment${payments.overdueCount === 1 ? "" : "s"} overdue`
                : payments.nextDue
                  ? `Next due ${formatDate(payments.nextDue.due_date, "medium")}`
                  : "Nothing scheduled"
            }
          />

          <StatTile
            label="Cost performance"
            value={cpi ? cpi.toFixed(2) : "—"}
            icon={TrendingDown}
            hint="Value of the work completed divided by what was spent to complete it. Above 1.00 means the work done so far cost less than budgeted."
            tone={cpi != null && cpi < 0.95 ? "warning" : "default"}
            footer={
              cpi == null
                ? "No spend recorded yet"
                : cpi >= 1
                  ? "Work done is costing less than budgeted"
                  : "Work done is costing more than budgeted"
            }
          />
        </StatGrid>

        {/* ---- Budget --------------------------------------------------- */}
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardToolbar>
              <div>
                <CardTitle as="h2">Budget against spend</CardTitle>
                <CardDescription>
                  Spent is money already paid out. Committed is ordered but not yet invoiced — it
                  will land, so it counts against the budget.
                </CardDescription>
              </div>
            </CardToolbar>
            <CardContent>
              <BudgetBarChart categories={budget.categories} currency={currency} />
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            <Card>
              <CardToolbar>
                <div>
                  <CardTitle as="h2">Where the money goes</CardTitle>
                  <CardDescription>Share of committed and actual spend</CardDescription>
                </div>
              </CardToolbar>
              <CardContent>
                <SpendCompositionBar categories={budget.categories} currency={currency} />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5">
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <span className="text-ink-3 text-[11px] font-medium tracking-wide uppercase">
                    Budget consumed
                  </span>
                  <span className="tabular text-ink text-[13px] font-semibold">
                    {budget.utilisation.toFixed(0)}%
                  </span>
                </div>
                <Progress
                  value={budget.utilisation}
                  label="Budget consumed"
                  tone={
                    budget.utilisation > 100
                      ? "critical"
                      : budget.utilisation > 85
                        ? "warning"
                        : "brand"
                  }
                />
                <dl className="mt-4 grid grid-cols-2 gap-3">
                  <Figure label="Budget" value={formatCurrency(budget.budgeted, currency)} />
                  <Figure label="Spent" value={formatCurrency(budget.actual, currency)} />
                  <Figure label="Committed" value={formatCurrency(budget.committed, currency)} />
                  <Figure
                    label="Remaining"
                    value={formatCurrency(budget.remaining, currency)}
                    tone={budget.remaining < 0 ? "critical" : "default"}
                  />
                </dl>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card>
          <CardToolbar>
            <div>
              <CardTitle as="h2">Cash flow</CardTitle>
              <CardDescription>Cumulative spend against the total budget line</CardDescription>
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

        {/* ---- Payment schedule ----------------------------------------- */}
        <Card>
          <CardToolbar>
            <div>
              <CardTitle as="h2">Payment schedule</CardTitle>
              <CardDescription>
                Stage payments tied to build milestones. Each becomes due when its stage is
                certified complete.
              </CardDescription>
            </div>
          </CardToolbar>
          <CardContent className="px-0 pb-0">
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-[620px] text-[13px]">
                <caption className="sr-only">
                  Stage payments with amounts, due dates and status
                </caption>
                <thead className="text-ink-3 border-line border-y text-left text-[11px] tracking-wide uppercase">
                  <tr>
                    <th scope="col" className="py-2 pr-3 pl-5 font-medium">
                      Stage
                    </th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">
                      Share
                    </th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">
                      Amount
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Due
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Status
                    </th>
                    <th scope="col" className="py-2 pr-5 font-medium">
                      Invoice
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-line divide-y">
                  {w.payments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-surface-2 transition-colors">
                      <td className="text-ink py-2.5 pr-3 pl-5 font-medium">{payment.name}</td>
                      <td className="tabular text-ink-2 py-2.5 pr-3 text-right">
                        {payment.percent_of_contract}%
                      </td>
                      <td className="tabular text-ink py-2.5 pr-3 text-right font-semibold">
                        {formatCurrency(payment.amount, currency)}
                      </td>
                      <td
                        className={cn(
                          "py-2.5 pr-3",
                          payment.status === "overdue"
                            ? "text-critical-ink font-medium"
                            : "text-ink-2",
                        )}
                      >
                        {formatDate(payment.due_date, "medium")}
                      </td>
                      <td className="py-2.5 pr-3">
                        <StatusBadge kind="payment" value={payment.status} />
                      </td>
                      <td className="text-ink-3 py-2.5 pr-5 text-[12px]">
                        {payment.invoice_number ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-line border-t">
                  <tr className="bg-surface-2">
                    <th scope="row" className="text-ink py-2.5 pr-3 pl-5 text-left font-semibold">
                      Total
                    </th>
                    <td />
                    <td className="tabular text-ink py-2.5 pr-3 text-right font-semibold">
                      {formatCurrency(payments.total, currency)}
                    </td>
                    <td colSpan={3} className="text-ink-3 py-2.5 pr-5 text-[12px]">
                      {formatCurrency(payments.paid, currency)} paid ·{" "}
                      {formatCurrency(payments.outstanding, currency)} outstanding
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ---- Draws + change orders ------------------------------------ */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardToolbar>
              <div>
                <CardTitle as="h2">Draw requests</CardTitle>
                <CardDescription>
                  {draws.awaitingCount > 0
                    ? `${draws.awaitingCount} awaiting a decision`
                    : "Nothing awaiting a decision"}
                </CardDescription>
              </div>
            </CardToolbar>
            <CardContent>
              {w.drawRequests.length === 0 ? (
                <EmptyState icon={Banknote} title="No draw requests yet" />
              ) : (
                <ul className="divide-line divide-y">
                  {w.drawRequests.map((draw) => (
                    <li key={draw.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-ink text-[13px] font-medium">
                            {draw.reference}
                            <span className="text-ink-3 ml-2 font-normal">
                              {formatCurrency(draw.amount, currency)}
                            </span>
                          </p>
                        </div>
                        <Badge
                          tone={
                            draw.status === "approved" || draw.status === "paid"
                              ? "good"
                              : draw.status === "rejected"
                                ? "critical"
                                : draw.status === "draft"
                                  ? "neutral"
                                  : "warning"
                          }
                        >
                          {humanise(draw.status)}
                        </Badge>
                      </div>
                      {draw.justification ? (
                        <p className="text-ink-3 text-[12px] leading-relaxed">
                          {draw.justification}
                        </p>
                      ) : null}
                      {draw.decision_note ? (
                        <p className="text-ink-2 bg-surface-2 rounded-[var(--radius-card)] px-2.5 py-1.5 text-[11px]">
                          <span className="font-medium">Decision:</span> {draw.decision_note}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardToolbar>
              <div>
                <CardTitle as="h2">Change orders</CardTitle>
                <CardDescription>Variations to the original scope and price</CardDescription>
              </div>
            </CardToolbar>
            <CardContent>
              {w.changeOrders.length === 0 ? (
                <EmptyState icon={FileSignature} title="No changes to the contract" />
              ) : (
                <ul className="divide-line divide-y">
                  {w.changeOrders.map((order) => (
                    <li key={order.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-ink min-w-0 text-[13px] font-medium">
                          <span className="text-ink-3 mr-1.5 font-mono text-[11px]">
                            {order.number}
                          </span>
                          {order.title}
                        </p>
                        <Badge
                          tone={
                            order.status === "approved"
                              ? "good"
                              : order.status === "rejected"
                                ? "critical"
                                : "warning"
                          }
                        >
                          {humanise(order.status)}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
                        <span className={order.cost_delta >= 0 ? "text-ink-2" : "text-good-ink"}>
                          <span className="text-ink-3">Cost: </span>
                          {order.cost_delta >= 0 ? "+" : "−"}
                          {formatCurrency(Math.abs(order.cost_delta), currency)}
                        </span>
                        {order.schedule_delta_days !== 0 ? (
                          <span className="text-serious-ink">
                            <span className="text-ink-3">Schedule: </span>
                            {order.schedule_delta_days > 0 ? "+" : "−"}
                            {Math.abs(order.schedule_delta_days)} days
                          </span>
                        ) : (
                          <span className="text-ink-3">No schedule impact</span>
                        )}
                      </div>

                      {order.description ? (
                        <p className="text-ink-3 text-[12px] leading-relaxed">
                          {order.description}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}

              {contract.pendingChanges !== 0 ? (
                <p className="text-warning-ink bg-warning-subtle mt-3 rounded-[var(--radius-card)] px-3 py-2 text-[12px]">
                  {formatCurrency(contract.pendingChanges, currency)} of proposed changes are
                  awaiting a decision. They are not in your contract value yet.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Figure({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "critical";
}) {
  return (
    <div>
      <dt className="text-ink-3 text-[11px]">{label}</dt>
      <dd
        className={cn(
          "tabular mt-0.5 text-[13px] font-semibold",
          tone === "critical" ? "text-critical-ink" : "text-ink",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
