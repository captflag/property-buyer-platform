import { Info, type LucideIcon } from "lucide-react";
import * as React from "react";

import { ILLUSTRATIONS, type IllustrationName } from "@/components/ui/illustration";
import { cn } from "@/lib/utils";

/**
 * Presentational feedback components.
 *
 * Deliberately NOT a client module. These take a Lucide icon *component* as a
 * prop, and a server component cannot pass a function across the client
 * boundary -- so marking these "use client" would make them unusable from every
 * server-rendered page that wants an empty state. They have no interactivity,
 * so there is nothing to gain from it either.
 */

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton", className)} aria-hidden="true" {...props} />;
}

/**
 * Empty state.
 *
 * Prefers a line illustration over an icon when one is named: an illustration
 * gives an otherwise-blank screen something to be, and it is the cheapest place
 * to show the interface was drawn rather than assembled. The icon path stays
 * for tight spaces where a 96px drawing would dominate.
 */
export function EmptyState({
  icon: Icon = Info,
  illustration,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  illustration?: IllustrationName;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  const Drawing = illustration ? ILLUSTRATIONS[illustration] : null;

  return (
    <div
      className={cn(
        "border-line-strong flex flex-col items-center justify-center border border-dashed",
        "px-6 text-center",
        Drawing ? "py-10" : "py-12",
        className,
      )}
    >
      {Drawing ? (
        <Drawing size={112} className="text-ink-3 mb-4" />
      ) : (
        <div className="bg-surface-3 text-ink-3 border-line mb-3 border p-3">
          <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
        </div>
      )}
      <p className="ui-display text-ink text-[15px]">{title}</p>
      {description ? (
        <p className="text-ink-3 mt-1.5 max-w-sm text-[13px] leading-relaxed">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Alert({
  tone = "brand",
  icon: Icon,
  title,
  children,
  className,
}: {
  tone?: "brand" | "good" | "warning" | "serious" | "critical";
  icon?: LucideIcon;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const tones = {
    brand: "bg-brand-subtle text-brand-subtle-ink border-brand",
    good: "bg-good-subtle text-good-ink border-good",
    warning: "bg-warning-subtle text-warning-ink border-warning",
    serious: "bg-serious-subtle text-serious-ink border-serious",
    critical: "bg-critical-subtle text-critical-ink border-critical",
  }[tone];

  return (
    <div
      role={tone === "critical" || tone === "serious" ? "alert" : "status"}
      className={cn(
        "flex gap-3 border-l-3 px-4 py-3 text-[13px] leading-relaxed",
        tones,
        className,
      )}
    >
      {Icon ? <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : null}
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && "mt-0.5 opacity-90")}>{children}</div> : null}
      </div>
    </div>
  );
}

export function Separator({
  orientation = "horizontal",
  className,
}: {
  orientation?: "horizontal" | "vertical";
  className?: string;
}) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        "bg-line shrink-0",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
    />
  );
}
