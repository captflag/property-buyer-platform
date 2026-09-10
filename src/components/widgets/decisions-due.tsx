import { ArrowRight, ListChecks } from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardTitle, CardToolbar } from "@/components/ui/card";
import { DeadlineBadge } from "@/components/widgets/selection-badges";
import type { SelectionSummary, SelectionView } from "@/lib/domain/selections";
import { formatPriceDelta } from "@/lib/domain/selections";

/**
 * The next decisions the buyer owes, on the dashboard.
 *
 * Three at most. A dashboard widget that lists all eleven open choices is a
 * worse version of the selections page; this one exists to answer "is there
 * anything I need to decide this week?" in a glance.
 */
export function DecisionsDue({
  views,
  summary,
  slug,
  currency,
}: {
  views: SelectionView[];
  summary: SelectionSummary;
  slug: string;
  currency: string;
}) {
  const open = views.filter((v) => v.urgency !== "chosen" && v.urgency !== "locked").slice(0, 3);

  return (
    <Card>
      <CardToolbar>
        <div>
          <CardTitle as="h2">Decisions due</CardTitle>
          <CardDescription>
            {summary.decided} of {summary.total} decided
            {summary.budgetImpact !== 0
              ? ` · choices so far ${formatPriceDelta(summary.budgetImpact, currency)}`
              : ""}
          </CardDescription>
        </div>
        <ListChecks className="text-ink-3 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      </CardToolbar>

      <CardContent>
        {open.length === 0 ? (
          <p className="text-ink-3 text-[13px]">
            Every decision is made. Nothing is waiting on you.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {open.map((view) => (
              <li key={view.category.id}>
                <Link
                  href={`/projects/${slug}/selections#${view.category.id}`}
                  className="group flex items-start justify-between gap-3"
                >
                  <span className="min-w-0">
                    <span className="text-ink group-hover:text-brand block text-[13px] font-medium transition-colors">
                      {view.category.name}
                    </span>
                    <span className="text-ink-3 block text-[11px]">
                      {view.options.length} options
                      {view.milestone ? ` · for ${view.milestone.name.toLowerCase()}` : ""}
                    </span>
                  </span>
                  <DeadlineBadge
                    urgency={view.urgency}
                    daysLeft={view.daysLeft}
                    deadline={view.deadline}
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}

        <Link
          href={`/projects/${slug}/selections`}
          className="text-brand mt-4 inline-flex items-center gap-1 text-[12px] font-semibold hover:underline"
        >
          All selections
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </CardContent>
    </Card>
  );
}
