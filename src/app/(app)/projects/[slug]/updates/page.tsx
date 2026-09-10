import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardTitle, CardToolbar } from "@/components/ui/card";
import { getUpdates, getUpdateStats, PAGE_SIZE } from "@/lib/data/feeds";
import { getWorkspace, requestNow } from "@/lib/data/workspace";
import { formatRelative } from "@/lib/format";

import { UpdatesFeed } from "./updates-feed";

export const metadata: Metadata = { title: "Site updates" };

export default async function UpdatesPage({ params }: PageProps<"/projects/[slug]/updates">) {
  const { slug } = await params;
  const cutoff = new Date(new Date(requestNow()).getTime() - 30 * 86_400_000).toISOString();

  // The first page of the feed, and the month's figures counted in the
  // database rather than by loading a month of updates to add them up.
  const [w, page, month] = await Promise.all([
    getWorkspace(slug, ["milestones", "profiles"]),
    getUpdates(slug, { limit: PAGE_SIZE.updates, media: true }),
    getUpdateStats(slug, cutoff),
  ]);
  const now = new Date(w.now);
  const latest = page.updates[0];

  return (
    <>
      <PageHeader
        title="Site updates"
        scene="pathwayDusk"
        description="Every report from site, with the crew, hours and conditions behind it."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <UpdatesFeed
          updates={page.updates}
          media={page.media}
          nextCursor={page.nextCursor}
          profiles={w.profiles}
          milestones={w.milestones}
          now={w.now}
          isDemo={w.isDemo}
          projectId={w.project.id}
          slug={slug}
        />

        <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardToolbar>
              <div>
                <CardTitle>Last 30 days</CardTitle>
                <CardDescription>Activity on site</CardDescription>
              </div>
            </CardToolbar>
            <CardContent className="flex flex-col gap-3">
              <Figure label="Updates posted" value={`${month.count}`} />
              <Figure label="Crew hours logged" value={`${month.hours.toFixed(0)}`} />
              <Figure label="Photographs" value={`${month.photos}`} />
              {latest ? (
                <Figure label="Most recent" value={formatRelative(latest.published_at, now)} />
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardToolbar>
              <div>
                <CardTitle>How updates work</CardTitle>
              </div>
            </CardToolbar>
            <CardContent>
              <ul className="text-ink-2 flex flex-col gap-2 text-[12px] leading-relaxed">
                <li>
                  Site posts an update whenever a milestone moves, and at least weekly while work is
                  active.
                </li>
                <li>
                  Crew size, hours and weather are recorded on every post, so a slow week has a
                  visible reason.
                </li>
                <li>
                  Photographs are taken the same day the update is written — never reused from
                  earlier in the build.
                </li>
                <li>New updates appear here live, without needing a refresh.</li>
              </ul>
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-line flex items-baseline justify-between gap-3 border-b pb-2 last:border-0 last:pb-0">
      <span className="text-ink-3 text-[12px]">{label}</span>
      <span className="text-ink tabular text-[14px] font-semibold">{value}</span>
    </div>
  );
}
