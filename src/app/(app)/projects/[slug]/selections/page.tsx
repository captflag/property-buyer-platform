import { AlertTriangle, CalendarPlus, CheckCircle2, ListChecks, Wallet } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { StatGrid, StatTile } from "@/components/widgets/stat-tile";
import { DERIVE_TABLES, deriveProject } from "@/lib/data/derived";
import { getViewer, getWorkspace } from "@/lib/data/workspace";
import { formatPriceDelta } from "@/lib/domain/selections";
import { formatDate } from "@/lib/format";

import { SelectionsBoard, type ClientSelectionView } from "./selections-board";

export const metadata: Metadata = { title: "Selections" };

export default async function SelectionsPage({ params }: PageProps<"/projects/[slug]/selections">) {
  const { slug } = await params;
  const [w, viewer] = await Promise.all([getWorkspace(slug, DERIVE_TABLES), getViewer(slug)]);
  const d = deriveProject(w, viewer.profile?.id ?? null);
  const { selectionSummary: summary } = d;

  // Flatten the Set and trim the milestone to what the client needs.
  const views: ClientSelectionView[] = d.selections.map((view) => ({
    category: view.category,
    options: view.options,
    milestone: view.milestone
      ? {
          id: view.milestone.id,
          name: view.milestone.name,
          planned_start: view.milestone.planned_start,
        }
      : null,
    deadline: view.deadline,
    deadlineDerived: view.deadlineDerived,
    daysLeft: view.daysLeft,
    urgency: view.urgency,
    lateOptionIds: [...view.lateOptionIds],
    consequence: view.consequence,
  }));

  const dueThisWeek = d.selections.filter((v) => v.urgency === "urgent").length;

  return (
    <>
      <PageHeader
        title="Selections"
        scene="kitchen"
        description="Every finish and fitting you choose, with the date each decision is needed by and what happens if it passes."
        actions={
          <Button asChild variant="secondary" size="sm">
            <a href={`/api/calendar/${slug}?include=selections`}>
              <CalendarPlus />
              Deadlines to calendar
            </a>
          </Button>
        }
      />

      <div className="flex flex-col gap-6">
        {summary.overdue > 0 ? (
          <Alert tone="critical" icon={AlertTriangle} title="A decision is overdue">
            {summary.overdue === 1 ? "One selection has" : `${summary.overdue} selections have`}{" "}
            passed
            {summary.overdue === 1 ? " its" : " their"} deadline. Until you choose, the build team
            will plan around the standard option — and some of these hold up work that cannot start
            without them.
          </Alert>
        ) : null}

        <StatGrid>
          <StatTile
            label="Decided"
            value={`${summary.decided}`}
            unit={`/ ${summary.total}`}
            icon={CheckCircle2}
            footer={`${summary.open} still to choose`}
          />
          <StatTile
            label="Due this week"
            value={`${dueThisWeek}`}
            icon={ListChecks}
            tone={dueThisWeek > 0 ? "serious" : "default"}
            footer={
              summary.nextDeadline
                ? `Next: ${summary.nextDeadline.category.name}, ${formatDate(summary.nextDeadline.deadline, "short")}`
                : "Nothing scheduled"
            }
          />
          <StatTile
            label="Overdue"
            value={`${summary.overdue}`}
            icon={AlertTriangle}
            tone={summary.overdue > 0 ? "critical" : "default"}
            footer={summary.overdue > 0 ? "The standard option will be assumed" : "All on time"}
          />
          <StatTile
            label="Your choices so far"
            value={formatPriceDelta(summary.budgetImpact, w.project.currency)}
            icon={Wallet}
            hint="The combined cost of every choice made, relative to the standard specification in your contract. Confirmed choices are already included in your contract value through change orders."
            footer="Relative to the standard specification"
          />
        </StatGrid>

        <SelectionsBoard
          views={views}
          currency={w.project.currency}
          askHref={`/projects/${slug}/questions`}
        />
      </div>
    </>
  );
}
