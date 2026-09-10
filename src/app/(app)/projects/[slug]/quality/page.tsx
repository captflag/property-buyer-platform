import {
  CalendarCheck,
  Camera,
  CircleCheck,
  MapPin,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/app-shell";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardTitle, CardToolbar } from "@/components/ui/card";
import { Avatar } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/feedback";
import { AskAboutLink } from "@/components/widgets/ask-about";
import { SnagReporter } from "@/components/widgets/snag-reporter";
import { StatGrid, StatTile } from "@/components/widgets/stat-tile";
import { getViewer, getWorkspace } from "@/lib/data/workspace";
import { roomsFor } from "@/lib/domain/rooms";
import { formatDate, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Quality & issues" };

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 } as const;

export default async function QualityPage({ params }: PageProps<"/projects/[slug]/quality">) {
  const { slug } = await params;
  const [w, viewer] = await Promise.all([
    getWorkspace(slug, ["milestones", "issues", "inspections", "profiles"]),
    getViewer(slug),
  ]);
  const viewerId = viewer.profile?.id ?? null;
  const now = new Date(w.now);
  const today = w.now.slice(0, 10);

  const open = w.issues
    .filter((i) => i.status === "open" || i.status === "acknowledged" || i.status === "in_progress")
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const closed = w.issues.filter((i) => i.status === "resolved" || i.status === "closed");

  const passed = w.inspections.filter((i) => i.result === "pass").length;
  const upcoming = w.inspections
    .filter((i) => i.result === "pending")
    .sort((a, b) => ((a.scheduled_for ?? "") < (b.scheduled_for ?? "") ? -1 : 1));

  const overdue = open.filter((i) => i.due_date != null && i.due_date < today);

  return (
    <>
      <PageHeader
        title="Quality & issues"
        scene="bath"
        description="Defects, snags and inspections — tracked from first fix rather than assembled the week before handover."
        actions={<SnagReporter rooms={roomsFor(w.project)} />}
      />

      <div className="flex flex-col gap-6">
        <StatGrid>
          <StatTile
            label="Open issues"
            value={`${open.length}`}
            icon={TriangleAlert}
            tone={
              open.some((i) => i.severity === "critical")
                ? "critical"
                : open.length > 0
                  ? "warning"
                  : "default"
            }
            footer={
              open.length === 0
                ? "Nothing outstanding"
                : `${open.filter((i) => i.severity === "high" || i.severity === "critical").length} high or critical`
            }
          />
          <StatTile
            label="Past their due date"
            value={`${overdue.length}`}
            tone={overdue.length > 0 ? "critical" : "default"}
            footer={overdue.length === 0 ? "All within target" : "Chase these at the next meeting"}
          />
          <StatTile
            label="Inspections passed"
            value={`${passed}`}
            unit={`/ ${w.inspections.filter((i) => i.result !== "pending").length}`}
            icon={ShieldCheck}
            footer="No failures recorded"
          />
          <StatTile
            label="Resolved to date"
            value={`${closed.length}`}
            icon={CircleCheck}
            footer="Issues closed out since work started"
          />
        </StatGrid>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardToolbar>
              <div>
                <CardTitle as="h2">Open issues</CardTitle>
                <CardDescription>Most severe first</CardDescription>
              </div>
            </CardToolbar>
            <CardContent>
              {open.length === 0 ? (
                <EmptyState
                  icon={CircleCheck}
                  title="Nothing outstanding"
                  description="Every issue raised on this build has been closed out."
                />
              ) : (
                <ul className="divide-line divide-y">
                  {open.map((issue) => {
                    const isOverdue = issue.due_date != null && issue.due_date < today;
                    const reporter = w.profiles.find((p) => p.id === issue.reported_by);
                    const milestone = w.milestones.find((m) => m.id === issue.milestone_id);

                    return (
                      <li key={issue.id} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <h3 className="text-ink min-w-0 text-[13px] font-semibold">
                            {issue.title}
                          </h3>
                          <div className="flex shrink-0 gap-1.5">
                            {issue.raised_by_buyer ? (
                              <Badge tone="brand">
                                {issue.reported_by === viewerId
                                  ? "Raised by you"
                                  : "Raised by buyer"}
                              </Badge>
                            ) : null}
                            <StatusBadge kind="severity" value={issue.severity} />
                            <StatusBadge kind="issue" value={issue.status} />
                          </div>
                        </div>

                        {issue.description ? (
                          <p className="text-ink-2 text-[12px] leading-relaxed">
                            {issue.description}
                          </p>
                        ) : null}

                        <div className="text-ink-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                          {issue.room || issue.location ? (
                            <span className="flex items-center gap-1">
                              <MapPin className="size-3" aria-hidden="true" />
                              {[issue.room, issue.location].filter(Boolean).join(" · ")}
                            </span>
                          ) : null}
                          {issue.photo_paths.length > 0 ? (
                            <span className="flex items-center gap-1">
                              <Camera className="size-3" aria-hidden="true" />
                              {issue.photo_paths.length} photo
                              {issue.photo_paths.length === 1 ? "" : "s"}
                            </span>
                          ) : null}
                          {milestone ? <span>{milestone.name}</span> : null}
                          {issue.due_date ? (
                            <span className={cn(isOverdue && "text-critical-ink font-medium")}>
                              Due {formatDate(issue.due_date, "medium")}
                              {isOverdue ? " — overdue" : ""}
                            </span>
                          ) : null}
                          <span className="flex items-center gap-1.5">
                            <Avatar name={reporter?.full_name} size="xs" />
                            Raised {formatRelative(issue.created_at, now)}
                          </span>
                          <AskAboutLink
                            slug={slug}
                            kind="issue"
                            id={issue.id}
                            className="ml-auto"
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            <Card>
              <CardToolbar>
                <div>
                  <CardTitle as="h2">Inspections</CardTitle>
                  <CardDescription>Statutory and third-party sign-offs</CardDescription>
                </div>
              </CardToolbar>
              <CardContent>
                <ul className="divide-line divide-y">
                  {w.inspections.map((inspection) => (
                    <li
                      key={inspection.id}
                      className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="text-ink text-[13px] font-medium">{inspection.name}</p>
                        <p className="text-ink-3 mt-0.5 text-[11px]">
                          {inspection.authority}
                          {inspection.scheduled_for
                            ? ` · ${formatDate(inspection.scheduled_for, "medium")}`
                            : ""}
                        </p>
                      </div>
                      <StatusBadge kind="inspection" value={inspection.result} />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {upcoming.length > 0 ? (
              <Card>
                <CardToolbar>
                  <div>
                    <CardTitle as="h2">Coming up</CardTitle>
                    <CardDescription>Next inspections due</CardDescription>
                  </div>
                </CardToolbar>
                <CardContent>
                  <ul className="flex flex-col gap-2.5">
                    {upcoming.slice(0, 3).map((inspection) => (
                      <li key={inspection.id} className="flex items-center gap-2.5">
                        <span className="bg-surface-3 text-ink-2 grid size-8 shrink-0 place-items-center rounded-[var(--radius-card)]">
                          <CalendarCheck className="size-4" strokeWidth={1.75} aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-ink truncate text-[12px] font-medium">
                            {inspection.name}
                          </p>
                          <p className="text-ink-3 text-[11px]">
                            {formatDate(inspection.scheduled_for, "medium")}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : null}

            {closed.length > 0 ? (
              <Card>
                <CardToolbar>
                  <div>
                    <CardTitle as="h2">Recently closed</CardTitle>
                  </div>
                </CardToolbar>
                <CardContent>
                  <ul className="flex flex-col gap-2">
                    {closed.slice(0, 4).map((issue) => (
                      <li key={issue.id} className="flex items-start gap-2">
                        <CircleCheck
                          className="text-good mt-0.5 size-3.5 shrink-0"
                          strokeWidth={2.25}
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="text-ink-2 text-[12px]">{issue.title}</p>
                          {issue.resolved_at ? (
                            <p className="text-ink-3 text-[11px]">
                              Closed {formatRelative(issue.resolved_at, now)}
                            </p>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
