"use client";

import { Check, X } from "lucide-react";
import * as React from "react";

import { decideSiteVisit } from "@/app/(app)/buyer-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle, CardToolbar } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { formatInZone } from "@/lib/domain/visits";
import type { SiteVisit } from "@/types/database";

/**
 * Pending visit requests, for the site manager.
 *
 * The other half of the buyer's booking flow: without it, a requested visit
 * would sit unconfirmed forever. Decisions are optimistic, rolled back if the
 * database refuses.
 */
export function VisitDecisions({
  visits,
  timeZone,
  requesterNames,
}: {
  visits: SiteVisit[];
  timeZone: string;
  requesterNames: Record<string, string>;
}) {
  const { toast } = useToast();
  const [decided, setDecided] = React.useState<Record<string, "confirmed" | "declined">>({});
  const [, startTransition] = React.useTransition();

  const pending = visits.filter((v) => v.status === "requested" && !decided[v.id]);

  const decide = (visit: SiteVisit, decision: "confirmed" | "declined") => {
    setDecided((current) => ({ ...current, [visit.id]: decision }));
    startTransition(async () => {
      const result = await decideSiteVisit({
        visitId: visit.id,
        decision,
        note:
          decision === "confirmed"
            ? "Confirmed. Hard hats and boots are provided at the cabin."
            : undefined,
      });
      if (result.ok || result.demo) {
        toast({
          tone: result.ok ? "success" : "info",
          title: decision === "confirmed" ? "Visit confirmed" : "Visit declined",
          description: result.ok ? undefined : "Demo mode — not saved.",
        });
      } else {
        setDecided((current) => {
          const next = { ...current };
          delete next[visit.id];
          return next;
        });
        toast({ tone: "error", title: "Not saved", description: result.message });
      }
    });
  };

  return (
    <Card>
      <CardToolbar>
        <div>
          <CardTitle as="h2">Visit requests</CardTitle>
          <CardDescription>
            {pending.length === 0 ? "Nothing waiting" : `${pending.length} awaiting your decision`}
          </CardDescription>
        </div>
      </CardToolbar>
      <CardContent>
        {pending.length === 0 ? (
          <EmptyState illustration="site" title="No visit requests" className="py-8" />
        ) : (
          <ul className="divide-line divide-y">
            {pending.map((visit) => (
              <li key={visit.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                <p className="text-ink text-[13px] font-semibold">
                  {formatInZone(visit.starts_at, timeZone, "full")}
                </p>
                <p className="text-ink-3 text-[12px]">
                  {requesterNames[visit.requested_by ?? ""] ?? "Buyer"} · {visit.purpose} ·{" "}
                  {visit.attendees} {visit.attendees === 1 ? "person" : "people"}
                </p>
                {visit.notes ? <p className="text-ink-2 text-[12px]">{visit.notes}</p> : null}
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" onClick={() => decide(visit, "confirmed")}>
                    <Check />
                    Confirm
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => decide(visit, "declined")}>
                    <X />
                    Decline
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
