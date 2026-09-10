import { cva, type VariantProps } from "class-variance-authority";
import {
  AlertTriangle,
  Ban,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  Clock,
  OctagonAlert,
  PauseCircle,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";
import { humanise } from "@/lib/format";
import type {
  InspectionResult,
  IssueSeverity,
  IssueStatus,
  PaymentStatus,
  ProjectStatus,
  WorkStatus,
} from "@/types/database";

const badgeVariants = cva(
  "ui-chip ui-label inline-flex items-center gap-1.5 border whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-surface-3 text-ink-2 border-line",
        brand: "bg-brand-subtle text-brand-subtle-ink border-brand/30",
        good: "bg-good-subtle text-good-ink border-good/30",
        warning: "bg-warning-subtle text-warning-ink border-warning/40",
        serious: "bg-serious-subtle text-serious-ink border-serious/40",
        critical: "bg-critical-subtle text-critical-ink border-critical/40",
        outline: "bg-transparent text-ink-2 border-line",
      },
      size: {
        sm: "px-2 py-0.5 text-[10px] [&_svg]:size-3",
        md: "px-2.5 py-1 text-[11px] [&_svg]:size-3.5",
      },
    },
    defaultVariants: { tone: "neutral", size: "sm" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  icon?: LucideIcon;
}

export function Badge({ className, tone, size, icon: Icon, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone, size }), className)} {...props}>
      {Icon ? <Icon aria-hidden="true" strokeWidth={2.25} /> : null}
      {children}
    </span>
  );
}

/**
 * Status pills.
 *
 * Every one of these pairs a colour with an icon and a text label. That is not
 * decoration: status colours in this palette sit below 3:1 contrast on the
 * light surface by design, so colour is never allowed to carry the meaning on
 * its own -- and it keeps the states readable for colourblind users and in
 * forced-colours mode.
 */

type Descriptor = { tone: NonNullable<BadgeProps["tone"]>; icon: LucideIcon; label: string };

const WORK: Record<WorkStatus, Descriptor> = {
  not_started: { tone: "neutral", icon: CircleDashed, label: "Not started" },
  in_progress: { tone: "brand", icon: CircleDot, label: "In progress" },
  blocked: { tone: "critical", icon: OctagonAlert, label: "Blocked" },
  completed: { tone: "good", icon: CheckCircle2, label: "Complete" },
  cancelled: { tone: "neutral", icon: Ban, label: "Cancelled" },
};

const PROJECT: Record<ProjectStatus, Descriptor> = {
  planning: { tone: "neutral", icon: CalendarClock, label: "Planning" },
  in_progress: { tone: "brand", icon: CircleDot, label: "In progress" },
  on_hold: { tone: "warning", icon: PauseCircle, label: "On hold" },
  completed: { tone: "good", icon: CheckCircle2, label: "Complete" },
  handed_over: { tone: "good", icon: CheckCircle2, label: "Handed over" },
  cancelled: { tone: "neutral", icon: Ban, label: "Cancelled" },
};

const PAYMENT: Record<PaymentStatus, Descriptor> = {
  scheduled: { tone: "neutral", icon: CalendarClock, label: "Scheduled" },
  due: { tone: "warning", icon: Clock, label: "Due" },
  invoiced: { tone: "warning", icon: Clock, label: "Invoiced" },
  paid: { tone: "good", icon: CheckCircle2, label: "Paid" },
  overdue: { tone: "critical", icon: AlertTriangle, label: "Overdue" },
  waived: { tone: "neutral", icon: Ban, label: "Waived" },
};

const ISSUE_SEVERITY: Record<IssueSeverity, Descriptor> = {
  low: { tone: "neutral", icon: CircleDot, label: "Low" },
  medium: { tone: "warning", icon: AlertTriangle, label: "Medium" },
  high: { tone: "serious", icon: AlertTriangle, label: "High" },
  critical: { tone: "critical", icon: OctagonAlert, label: "Critical" },
};

const ISSUE_STATUS: Record<IssueStatus, Descriptor> = {
  open: { tone: "critical", icon: CircleDot, label: "Open" },
  acknowledged: { tone: "warning", icon: CircleDot, label: "Acknowledged" },
  in_progress: { tone: "brand", icon: CircleDot, label: "In progress" },
  resolved: { tone: "good", icon: CheckCircle2, label: "Resolved" },
  closed: { tone: "neutral", icon: CheckCircle2, label: "Closed" },
};

const INSPECTION: Record<InspectionResult, Descriptor> = {
  pending: { tone: "neutral", icon: CalendarClock, label: "Scheduled" },
  pass: { tone: "good", icon: CheckCircle2, label: "Passed" },
  fail: { tone: "critical", icon: XCircle, label: "Failed" },
  conditional: { tone: "warning", icon: AlertTriangle, label: "Conditional" },
};

const REGISTRY = {
  work: WORK,
  project: PROJECT,
  payment: PAYMENT,
  severity: ISSUE_SEVERITY,
  issue: ISSUE_STATUS,
  inspection: INSPECTION,
} as const;

type Kind = keyof typeof REGISTRY;

export function StatusBadge<K extends Kind>({
  kind,
  value,
  size = "sm",
  className,
}: {
  kind: K;
  value: keyof (typeof REGISTRY)[K] & string;
  size?: BadgeProps["size"];
  className?: string;
}) {
  const map = REGISTRY[kind] as Record<string, Descriptor>;
  const descriptor = map[value] ?? {
    tone: "neutral" as const,
    icon: CircleDashed,
    label: humanise(value),
  };

  return (
    <Badge tone={descriptor.tone} size={size} icon={descriptor.icon} className={className}>
      {descriptor.label}
    </Badge>
  );
}
