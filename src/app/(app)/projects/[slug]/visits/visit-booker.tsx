"use client";

import { CalendarCheck, Clock, Users, X } from "lucide-react";
import * as React from "react";

import { cancelSiteVisit, requestSiteVisit } from "@/app/(app)/buyer-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle, CardToolbar } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import {
  Field,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { formatInZone, VISIT_PURPOSES, type VisitSlot } from "@/lib/domain/visits";
import { cn, localId } from "@/lib/utils";
import type { SiteVisit } from "@/types/database";

const STATUS: Record<
  SiteVisit["status"],
  { label: string; tone: "good" | "warning" | "neutral" | "critical" }
> = {
  requested: { label: "Awaiting confirmation", tone: "warning" },
  confirmed: { label: "Confirmed", tone: "good" },
  declined: { label: "Declined", tone: "critical" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  completed: { label: "Completed", tone: "neutral" },
};

export function VisitBooker({
  slots: initialSlots,
  visits: initialVisits,
  timeZone,
  zoneLabel,
  now,
}: {
  slots: VisitSlot[];
  visits: SiteVisit[];
  timeZone: string;
  zoneLabel: string;
  now: string;
}) {
  const { toast } = useToast();
  const [visits, setVisits] = React.useState(initialVisits);
  const [taken, setTaken] = React.useState<Set<string>>(new Set());
  const [selected, setSelected] = React.useState<string | null>(null);
  const [purpose, setPurpose] = React.useState<string>(VISIT_PURPOSES[0]);
  const [attendees, setAttendees] = React.useState("2");
  const [notes, setNotes] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const slots = initialSlots.filter((s) => !taken.has(s.startsAt));
  const byDate = React.useMemo(() => {
    const map = new Map<string, VisitSlot[]>();
    for (const slot of slots) {
      const list = map.get(slot.date) ?? [];
      list.push(slot);
      map.set(slot.date, list);
    }
    return [...map.entries()];
  }, [slots]);

  const upcoming = visits
    .filter((v) => (v.status === "requested" || v.status === "confirmed") && v.starts_at >= now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = visits
    .filter((v) => !upcoming.includes(v))
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at));

  const book = () => {
    if (!selected) return;
    const visit: SiteVisit = {
      id: localId("local"),
      project_id: "",
      requested_by: null,
      starts_at: selected,
      duration_minutes: 60,
      purpose,
      attendees: Number(attendees),
      notes: notes.trim() || null,
      status: "requested",
      builder_note: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setVisits((current) => [...current, visit]);
    setTaken((current) => new Set(current).add(selected));
    setSelected(null);
    setNotes("");

    startTransition(async () => {
      const result = await requestSiteVisit({
        startsAt: visit.starts_at,
        purpose: visit.purpose as (typeof VISIT_PURPOSES)[number],
        attendees: visit.attendees,
        notes: visit.notes ?? undefined,
      });
      if (result.ok) {
        toast({ tone: "success", title: "Visit requested", description: result.message });
      } else if (result.demo) {
        toast({
          tone: "info",
          title: "Visit requested",
          description: "Shown here, but not saved — this is demo data.",
        });
      } else {
        setVisits((current) => current.filter((v) => v.id !== visit.id));
        setTaken((current) => {
          const next = new Set(current);
          next.delete(visit.starts_at);
          return next;
        });
        toast({ tone: "error", title: "Not booked", description: result.message });
      }
    });
  };

  const cancel = (visit: SiteVisit) => {
    setVisits((current) =>
      current.map((v) => (v.id === visit.id ? { ...v, status: "cancelled" } : v)),
    );
    setTaken((current) => {
      const next = new Set(current);
      next.delete(visit.starts_at);
      return next;
    });

    if (visit.id.startsWith("local_")) return;

    startTransition(async () => {
      const result = await cancelSiteVisit(visit.id);
      if (!result.ok && !result.demo) {
        setVisits((current) => current.map((v) => (v.id === visit.id ? visit : v)));
        toast({ tone: "error", title: "Not cancelled", description: result.message });
      } else {
        toast({ tone: "info", title: "Visit cancelled" });
      }
    });
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
      <Card>
        <CardToolbar>
          <div>
            <CardTitle as="h2">Book a visit</CardTitle>
            <CardDescription>All times are site time ({zoneLabel}).</CardDescription>
          </div>
        </CardToolbar>
        <CardContent className="flex flex-col gap-5">
          {byDate.length === 0 ? (
            <EmptyState
              illustration="site"
              title="No sessions free in the next three weeks"
              description="Ask the site manager through Questions and they will find you a time."
            />
          ) : (
            <div
              className="flex flex-col gap-4"
              role="radiogroup"
              aria-label="Available visit times"
            >
              {byDate.map(([date, daySlots]) => (
                <div key={date}>
                  <p className="ui-label text-ink-3 mb-2 text-[10px]">
                    {formatInZone(daySlots[0]!.startsAt, timeZone, "date")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {daySlots.map((slot) => (
                      <button
                        key={slot.startsAt}
                        type="button"
                        role="radio"
                        aria-checked={selected === slot.startsAt}
                        onClick={() => setSelected(slot.startsAt)}
                        className={cn(
                          "border px-3 py-1.5 text-[13px] font-medium transition-colors",
                          "focus-visible:ring-ring focus-visible:ring-2",
                          selected === slot.startsAt
                            ? "bg-brand text-brand-ink border-brand"
                            : "border-line-strong text-ink hover:bg-surface-2",
                        )}
                      >
                        {formatInZone(slot.startsAt, timeZone, "time")}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {selected ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                book();
              }}
              className="border-line flex flex-col gap-3 border-t pt-4"
            >
              <p className="text-ink text-[13px]">
                <CalendarCheck className="text-brand mr-1.5 inline size-4" aria-hidden="true" />
                {formatInZone(selected, timeZone, "full")}
              </p>

              <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="visit-purpose" className="ui-label text-ink-2 text-[10px]">
                    Reason for the visit
                  </label>
                  <Select value={purpose} onValueChange={setPurpose}>
                    <SelectTrigger id="visit-purpose">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VISIT_PURPOSES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="visit-attendees" className="ui-label text-ink-2 text-[10px]">
                    People
                  </label>
                  <Select value={attendees} onValueChange={setAttendees}>
                    <SelectTrigger id="visit-attendees">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["1", "2", "3", "4", "5", "6"].map((n) => (
                        <SelectItem key={n} value={n}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Field label="Anything the site manager should know" htmlFor="visit-notes">
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="e.g. We'd like to see the tile samples in the bathroom."
                />
              </Field>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setSelected(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={pending}>
                  Request this visit
                </Button>
              </div>
            </form>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <CardToolbar>
            <div>
              <CardTitle as="h2">Your visits</CardTitle>
              <CardDescription>
                {upcoming.length === 0 ? "Nothing booked" : `${upcoming.length} coming up`}
              </CardDescription>
            </div>
          </CardToolbar>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-ink-3 text-[13px]">Pick a session to request a visit.</p>
            ) : (
              <ul className="divide-line divide-y">
                {upcoming.map((visit) => (
                  <VisitRow
                    key={visit.id}
                    visit={visit}
                    timeZone={timeZone}
                    onCancel={() => cancel(visit)}
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {past.length > 0 ? (
          <Card>
            <CardToolbar>
              <div>
                <CardTitle as="h2">Earlier</CardTitle>
              </div>
            </CardToolbar>
            <CardContent>
              <ul className="divide-line divide-y">
                {past.map((visit) => (
                  <VisitRow key={visit.id} visit={visit} timeZone={timeZone} />
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function VisitRow({
  visit,
  timeZone,
  onCancel,
}: {
  visit: SiteVisit;
  timeZone: string;
  onCancel?: () => void;
}) {
  const status = STATUS[visit.status];
  return (
    <li className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <p className="text-ink text-[13px] font-medium">
          {formatInZone(visit.starts_at, timeZone, "full")}
        </p>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <p className="text-ink-3 flex flex-wrap gap-x-3 text-[12px]">
        <span>{visit.purpose}</span>
        <span className="flex items-center gap-1">
          <Users className="size-3" aria-hidden="true" />
          {visit.attendees}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="size-3" aria-hidden="true" />
          {visit.duration_minutes} min
        </span>
      </p>
      {visit.builder_note ? (
        <p className="text-ink-2 bg-surface-2 px-2.5 py-1.5 text-[12px]">{visit.builder_note}</p>
      ) : null}
      {onCancel ? (
        <Button variant="ghost" size="sm" className="self-start" onClick={onCancel}>
          <X />
          Cancel visit
        </Button>
      ) : null}
    </li>
  );
}
