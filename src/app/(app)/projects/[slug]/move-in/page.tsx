import { CalendarPlus } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { DERIVE_TABLES, deriveProject } from "@/lib/data/derived";
import { getViewer, getWorkspace } from "@/lib/data/workspace";

import { MovePlanner } from "./move-planner";

export const metadata: Metadata = { title: "Move-in planner" };

export default async function MoveInPage({ params }: PageProps<"/projects/[slug]/move-in">) {
  const { slug } = await params;
  const [w, viewer] = await Promise.all([
    getWorkspace(slug, [...DERIVE_TABLES, "moveTasks"]),
    getViewer(slug),
  ]);
  const d = deriveProject(w, viewer.profile?.id ?? null);

  // Move tasks are personal. In demo mode the dataset holds only the buyer's;
  // with a database, RLS already limits the rows to the signed-in member.
  const records = viewer.profile
    ? w.moveTasks.filter((t) => t.user_id === viewer.profile!.id)
    : w.moveTasks;

  return (
    <>
      <PageHeader
        title="Move-in planner"
        scene="bedroom"
        description="Everything between now and the keys, timed against when your house will actually be ready."
        actions={
          <Button asChild variant="secondary" size="sm">
            <a href={`/api/calendar/${slug}?include=move,handover`}>
              <CalendarPlus />
              Plan to calendar
            </a>
          </Button>
        }
      />
      <MovePlanner
        records={records}
        forecastDate={d.forecast.projectedDate}
        contractDate={w.project.target_completion_date}
        now={w.now}
      />
    </>
  );
}
