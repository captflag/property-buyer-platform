"use client";

import {
  AlertTriangle,
  Banknote,
  CalendarCheck,
  CheckCircle2,
  FileText,
  HardHat,
  ListChecks,
  MessageSquare,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { markProjectSeen } from "@/app/(app)/buyer-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle, CardToolbar } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import type { ChangeItem, ChangeKind } from "@/lib/domain/since";
import { formatDate, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

const ICONS: Record<ChangeKind, LucideIcon> = {
  update: HardHat,
  milestone: CheckCircle2,
  document: FileText,
  payment: Banknote,
  issue: AlertTriangle,
  selection: ListChecks,
  message: MessageSquare,
  visit: CalendarCheck,
};

const TONES: Record<ChangeItem["tone"], string> = {
  good: "bg-good-subtle text-good-ink",
  warning: "bg-warning-subtle text-warning-ink",
  critical: "bg-critical-subtle text-critical-ink",
  neutral: "bg-surface-3 text-ink-2",
};

const VISIBLE = 6;

/**
 * What changed since the buyer last marked the project as caught up.
 *
 * "Mark as seen" is explicit and nothing else moves the marker -- a buyer who
 * opens the page and gets interrupted should find the same list waiting next
 * time, not an empty card that silently swallowed a week of news.
 */
export function SinceLastLooked({
  items,
  since,
  isFirstVisit,
  now,
}: {
  items: ChangeItem[];
  since: string | null;
  isFirstVisit: boolean;
  now: string;
}) {
  const { toast } = useToast();
  const [cleared, setCleared] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const nowDate = React.useMemo(() => new Date(now), [now]);

  const visible = expanded ? items : items.slice(0, VISIBLE);
  const hidden = items.length - visible.length;

  const markSeen = () => {
    startTransition(async () => {
      const result = await markProjectSeen();
      if (result.ok || result.demo) {
        setCleared(true);
        if (result.demo) {
          toast({
            tone: "info",
            title: "Caught up",
            description: "In demo mode the list returns on reload.",
          });
        }
      } else {
        toast({ tone: "error", title: "Couldn't update", description: result.message });
      }
    });
  };

  const description = isFirstVisit
    ? "The last seven days on your build"
    : since
      ? `Since you last caught up, ${formatRelative(since, nowDate)}`
      : "Recent activity";

  return (
    <Card>
      <CardToolbar>
        <div>
          <CardTitle as="h2">Since you last looked</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {!cleared && items.length > 0 ? (
          <Button variant="ghost" size="sm" onClick={markSeen} disabled={pending}>
            {pending ? "Saving…" : "Mark all as seen"}
          </Button>
        ) : null}
      </CardToolbar>

      <CardContent>
        {cleared || items.length === 0 ? (
          <div className="flex items-center gap-3 py-3">
            <span className="bg-good-subtle text-good-ink grid size-9 shrink-0 place-items-center">
              <Sparkles className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-ink text-[13px] font-medium">You&apos;re up to date</p>
              <p className="text-ink-3 text-[12px]">
                {since && !cleared
                  ? `Nothing has changed since ${formatDate(since, "medium")}.`
                  : "New updates, payments and decisions will collect here until you next mark them as seen."}
              </p>
            </div>
          </div>
        ) : (
          <>
            <ul className="divide-line divide-y" aria-live="polite">
              {visible.map((item) => {
                const Icon = ICONS[item.kind];
                return (
                  <li key={`${item.kind}-${item.id}`}>
                    <Link
                      href={item.href}
                      className="hover:bg-surface-2 -mx-2 flex items-start gap-3 px-2 py-2.5 transition-colors"
                    >
                      <span
                        className={cn(
                          "mt-0.5 grid size-7 shrink-0 place-items-center",
                          TONES[item.tone],
                        )}
                      >
                        <Icon className="size-3.5" strokeWidth={2} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="text-ink block truncate text-[13px] font-medium">
                          {item.title}
                        </span>
                        {item.detail ? (
                          <span className="text-ink-3 block truncate text-[12px]">
                            {item.detail}
                          </span>
                        ) : null}
                      </span>
                      <time dateTime={item.at} className="text-ink-3 shrink-0 pt-0.5 text-[11px]">
                        {formatRelative(item.at, nowDate)}
                      </time>
                    </Link>
                  </li>
                );
              })}
            </ul>

            {hidden > 0 ? (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="text-brand mt-2 text-[12px] font-semibold hover:underline"
              >
                Show {hidden} more
              </button>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
