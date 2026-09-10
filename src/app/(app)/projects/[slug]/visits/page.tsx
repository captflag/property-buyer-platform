import { CalendarPlus, HardHat, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle, CardToolbar } from "@/components/ui/card";
import { getWorkspace } from "@/lib/data/workspace";
import { availableSlots, DEFAULT_VISIT_RULES } from "@/lib/domain/visits";

import { VisitBooker } from "./visit-booker";

export const metadata: Metadata = { title: "Site visits" };

export default async function VisitsPage({ params }: PageProps<"/projects/[slug]/visits">) {
  const { slug } = await params;
  const w = await getWorkspace(slug, ["siteVisits"]);
  const now = new Date(w.now);
  const timeZone = w.project.timezone;

  const slots = availableSlots({ asOf: now, timeZone, existing: w.siteVisits });

  // "Central Daylight Time" -- the zone as the site experiences it today.
  const zoneLabel =
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "long" })
      .formatToParts(now)
      .find((part) => part.type === "timeZoneName")?.value ?? timeZone;

  return (
    <>
      <PageHeader
        title="Site visits"
        scene="villaPool"
        description="Book a time to see your house. Sessions are escorted by the site manager, so they run at set times."
        actions={
          <Button asChild variant="secondary" size="sm">
            <a href={`/api/calendar/${slug}?include=visits`}>
              <CalendarPlus />
              Visits to calendar
            </a>
          </Button>
        }
      />

      <div className="flex flex-col gap-6">
        <VisitBooker
          slots={slots}
          visits={w.siteVisits}
          timeZone={timeZone}
          zoneLabel={zoneLabel}
          now={w.now}
        />

        <Card>
          <CardToolbar>
            <div className="flex items-center gap-2">
              <HardHat className="text-ink-3 size-4" aria-hidden="true" />
              <CardTitle as="h2">Before you come</CardTitle>
            </div>
          </CardToolbar>
          <CardContent>
            <ul className="text-ink-2 grid gap-x-8 gap-y-2 text-[13px] leading-relaxed sm:grid-cols-2">
              <li>
                Sessions run Tuesday and Thursday at 10:00 and 14:00, and Saturday at 10:00, for{" "}
                {DEFAULT_VISIT_RULES.durationMinutes} minutes.
              </li>
              <li>
                Book at least {DEFAULT_VISIT_RULES.minNoticeHours} hours ahead — the site manager
                needs to arrange an escort and a safety briefing.
              </li>
              <li>Park on the street and report to the site cabin by the north gate.</li>
              <li>Hard hats, high-visibility vests and boots are provided. Wear closed shoes.</li>
              <li className="flex gap-2 sm:col-span-2">
                <ShieldAlert
                  className="text-serious-ink mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                Children under 16 cannot come onto an active site. Nobody enters an area the site
                manager has not cleared, whatever it looks like from the doorway.
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
