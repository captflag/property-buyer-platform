"use client";

import { AlertTriangle, CheckCircle2, Lock, Truck } from "lucide-react";
import * as React from "react";

import { chooseSelection } from "@/app/(app)/buyer-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { DeadlineBadge } from "@/components/widgets/selection-badges";
import { formatPriceDelta, type SelectionUrgency } from "@/lib/domain/selections";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Milestone, SelectionCategory, SelectionOption } from "@/types/database";

/** A SelectionView with its Set flattened, so it crosses the server boundary. */
export interface ClientSelectionView {
  category: SelectionCategory;
  options: SelectionOption[];
  milestone: Pick<Milestone, "id" | "name" | "planned_start"> | null;
  deadline: string | null;
  deadlineDerived: boolean;
  daysLeft: number | null;
  urgency: SelectionUrgency;
  lateOptionIds: string[];
  consequence: string;
}

type Filter = "open" | "decided" | "all";

export function SelectionsBoard({
  views,
  currency,
  askHref,
}: {
  views: ClientSelectionView[];
  currency: string;
  /** Base URL of the questions page; `?about=selection:<id>` is appended. */
  askHref: string;
}) {
  const { toast } = useToast();
  const [filter, setFilter] = React.useState<Filter>("open");

  // Choices made in this session, applied over the server's view. In demo
  // mode they are the only record; with a database they are optimistic until
  // the revalidated page arrives.
  const [local, setLocal] = React.useState<Map<string, string>>(new Map());
  const [confirming, setConfirming] = React.useState<{
    view: ClientSelectionView;
    option: SelectionOption;
  } | null>(null);
  const [pending, startTransition] = React.useTransition();

  const effective = React.useMemo(
    () =>
      views.map((view) => {
        const chosenId = local.get(view.category.id) ?? view.category.chosen_option_id;
        const urgency: SelectionUrgency =
          view.urgency === "locked" ? "locked" : chosenId ? "chosen" : view.urgency;
        return { ...view, chosenId, urgency };
      }),
    [views, local],
  );

  const isDecided = (u: SelectionUrgency) => u === "chosen" || u === "locked";
  const counts = {
    open: effective.filter((v) => !isDecided(v.urgency)).length,
    decided: effective.filter((v) => isDecided(v.urgency)).length,
    all: effective.length,
  };
  const visible = effective.filter((v) =>
    filter === "all" ? true : filter === "open" ? !isDecided(v.urgency) : isDecided(v.urgency),
  );

  const confirm = () => {
    if (!confirming) return;
    const { view, option } = confirming;
    const previous = local.get(view.category.id);

    setLocal((current) => new Map(current).set(view.category.id, option.id));
    setConfirming(null);

    startTransition(async () => {
      const result = await chooseSelection({ categoryId: view.category.id, optionId: option.id });
      if (result.ok) {
        toast({
          tone: "success",
          title: `${view.category.name}: ${option.name}`,
          description: result.message,
        });
      } else if (result.demo) {
        toast({
          tone: "info",
          title: `${view.category.name}: ${option.name}`,
          description: "Shown here, but not saved — this is demo data.",
        });
      } else {
        // Roll back: the server refused, so the screen must not claim otherwise.
        setLocal((current) => {
          const next = new Map(current);
          if (previous) next.set(view.category.id, previous);
          else next.delete(view.category.id);
          return next;
        });
        toast({ tone: "error", title: "Choice not recorded", description: result.message });
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Filter selections" className="flex flex-wrap gap-1">
        {(
          [
            ["open", "To decide"],
            ["decided", "Decided"],
            ["all", "All"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            role="tab"
            aria-selected={filter === value}
            variant={filter === value ? "subtle" : "ghost"}
            size="sm"
            onClick={() => setFilter(value)}
          >
            {label}
            <span className="text-ink-3 ml-1 text-[11px]">{counts[value]}</span>
          </Button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          illustration="ledger"
          title={filter === "open" ? "Nothing left to decide" : "No decisions here yet"}
          description={
            filter === "open"
              ? "Every selection has been made. The build team will confirm each one before ordering."
              : "Choices you make will be listed here."
          }
        />
      ) : (
        <ol className="flex flex-col gap-4">
          {visible.map((view) => (
            <li key={view.category.id} id={view.category.id} className="scroll-mt-20">
              <SelectionCard
                view={view}
                chosenId={view.chosenId}
                currency={currency}
                askHref={`${askHref}?about=selection:${view.category.id}`}
                disabled={pending}
                onChoose={(option) => setConfirming({ view, option })}
              />
            </li>
          ))}
        </ol>
      )}

      <Dialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        {confirming ? (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Choose {confirming.option.name.toLowerCase()} for{" "}
                {confirming.view.category.name.toLowerCase()}?
              </DialogTitle>
              <DialogDescription>
                You can change this until the build team confirms it and places the order.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <dl className="flex flex-col gap-2 text-[13px]">
                <Row label="Price">
                  {confirming.option.price_delta === 0
                    ? "Included in your contract"
                    : `${formatPriceDelta(confirming.option.price_delta, currency)} on your contract, through a change order`}
                </Row>
                <Row label="Lead time">
                  {confirming.option.lead_time_days === 0
                    ? "Available immediately"
                    : `${confirming.option.lead_time_days} days from order`}
                </Row>
                {confirming.view.lateOptionIds.includes(confirming.option.id) &&
                confirming.view.milestone ? (
                  <p className="bg-serious-subtle text-serious-ink mt-1 flex gap-2 px-3 py-2 text-[12px] leading-relaxed">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    Ordered today, this would arrive after{" "}
                    {confirming.view.milestone.name.toLowerCase()} is due to start on{" "}
                    {formatDate(confirming.view.milestone.planned_start, "medium")}. Choosing it may
                    delay that work.
                  </p>
                ) : null}
              </dl>
            </DialogBody>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirming(null)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={confirm}>
                <CheckCircle2 />
                Confirm choice
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-line flex justify-between gap-4 border-b pb-2">
      <dt className="text-ink-3">{label}</dt>
      <dd className="text-ink text-right font-medium">{children}</dd>
    </div>
  );
}

function SelectionCard({
  view,
  chosenId,
  currency,
  askHref,
  disabled,
  onChoose,
}: {
  view: ClientSelectionView & { urgency: SelectionUrgency };
  chosenId: string | null;
  currency: string;
  askHref: string;
  disabled: boolean;
  onChoose: (option: SelectionOption) => void;
}) {
  const locked = view.urgency === "locked";
  const pressing = view.urgency === "overdue" || view.urgency === "urgent";

  return (
    <Card className={cn(pressing && "border-l-serious border-l-4")}>
      <div className="flex flex-col gap-4 p-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="ui-display text-ink text-[17px]">{view.category.name}</h3>
            <p className="text-ink-3 mt-0.5 text-[12px]">
              {view.category.room}
              {view.milestone
                ? ` · needed for ${view.milestone.name.toLowerCase()}, starting ${formatDate(view.milestone.planned_start, "medium")}`
                : ""}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <DeadlineBadge
              urgency={view.urgency}
              daysLeft={view.daysLeft}
              deadline={view.deadline}
              size="md"
            />
            {view.deadline && !locked && view.urgency !== "chosen" ? (
              <span className="text-ink-3 text-[10px]">
                {view.deadlineDerived ? "Worked out from the programme" : "Set by the build team"}
              </span>
            ) : null}
          </div>
        </header>

        {view.category.description ? (
          <p className="text-ink-2 text-[13px] leading-relaxed">{view.category.description}</p>
        ) : null}

        <p
          className={cn(
            "text-[12px] leading-relaxed",
            pressing ? "bg-serious-subtle text-serious-ink px-3 py-2" : "text-ink-3",
          )}
        >
          {view.consequence}
        </p>

        <ul
          className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3"
          aria-label={`Options for ${view.category.name}`}
        >
          {view.options.map((option) => {
            const isChosen = option.id === chosenId;
            const isLate = view.lateOptionIds.includes(option.id);

            return (
              <li key={option.id}>
                <div
                  className={cn(
                    "flex h-full flex-col gap-2.5 border p-3.5 transition-colors",
                    isChosen ? "border-brand bg-brand-subtle/50 border-2" : "border-line",
                  )}
                >
                  <div className="flex items-start gap-3">
                    {option.swatch ? (
                      <span
                        aria-hidden="true"
                        className="border-line-strong size-10 shrink-0 border"
                        style={{ backgroundColor: option.swatch }}
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="text-ink text-[13px] font-semibold">{option.name}</p>
                      <p className="text-ink-3 text-[11px]">
                        {[option.finish, option.supplier].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "tabular shrink-0 text-[12px] font-semibold",
                        option.price_delta > 0
                          ? "text-ink"
                          : option.price_delta < 0
                            ? "text-good-ink"
                            : "text-ink-3",
                      )}
                    >
                      {formatPriceDelta(option.price_delta, currency)}
                    </span>
                  </div>

                  {option.description ? (
                    <p className="text-ink-2 text-[12px] leading-relaxed">{option.description}</p>
                  ) : null}

                  <div className="mt-auto flex flex-wrap items-center gap-1.5">
                    {option.is_standard ? <Badge tone="outline">Standard</Badge> : null}
                    <Badge tone="neutral" icon={Truck}>
                      {option.lead_time_days === 0
                        ? "No lead time"
                        : `${option.lead_time_days}-day lead`}
                    </Badge>
                    {isLate ? (
                      <Badge tone="serious" icon={AlertTriangle}>
                        May delay work
                      </Badge>
                    ) : null}
                  </div>

                  {locked ? (
                    isChosen ? (
                      <p className="text-good-ink flex items-center gap-1.5 text-[12px] font-semibold">
                        <Lock className="size-3.5" aria-hidden="true" />
                        Confirmed and ordered
                      </p>
                    ) : null
                  ) : isChosen ? (
                    <p className="text-brand-subtle-ink flex items-center gap-1.5 text-[12px] font-semibold">
                      <CheckCircle2 className="size-3.5" aria-hidden="true" />
                      Your choice
                    </p>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={disabled}
                      onClick={() => onChoose(option)}
                      aria-label={`Choose ${option.name} for ${view.category.name}`}
                    >
                      Choose this
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <footer className="border-line flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <p className="text-ink-3 text-[11px]">
            {view.category.notes ? `Note: ${view.category.notes}` : " "}
          </p>
          <a href={askHref} className="text-ink-3 hover:text-brand text-[11px] font-medium">
            Ask about this decision
          </a>
        </footer>
      </div>
    </Card>
  );
}
