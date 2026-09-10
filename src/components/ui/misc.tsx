"use client";

import * as AvatarPrimitive from "@radix-ui/react-avatar";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as React from "react";

import { cn, clamp, initials } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Avatar                                                                      */
/* -------------------------------------------------------------------------- */

export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string | null | undefined;
  src?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const dimensions = {
    xs: "size-6 text-[10px]",
    sm: "size-8 text-xs",
    md: "size-10 text-sm",
    lg: "size-14 text-base",
  }[size];

  return (
    <AvatarPrimitive.Root
      className={cn(
        "relative flex shrink-0 overflow-hidden",
        "ring-line-strong rounded-[var(--radius-avatar)] ring-1 ring-inset",
        dimensions,
        className,
      )}
    >
      {src ? <AvatarPrimitive.Image src={src} alt="" className="size-full object-cover" /> : null}
      <AvatarPrimitive.Fallback
        className="bg-surface-3 text-ink-2 flex size-full items-center justify-center font-semibold"
        delayMs={src ? 300 : 0}
      >
        <span aria-hidden="true">{initials(name)}</span>
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

/* -------------------------------------------------------------------------- */
/* Progress                                                                    */
/* -------------------------------------------------------------------------- */

export function Progress({
  value,
  label,
  tone = "brand",
  size = "md",
  className,
}: {
  value: number;
  /** Accessible name. Required -- a bare bar tells a screen reader nothing. */
  label: string;
  tone?: "brand" | "good" | "warning" | "critical" | "accent";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const pct = clamp(value, 0, 100);
  const height = { sm: "h-1.5", md: "h-2", lg: "h-3" }[size];
  const fill = {
    brand: "bg-brand",
    good: "bg-good",
    warning: "bg-warning",
    critical: "bg-critical",
    accent: "bg-accent",
  }[tone];

  return (
    <ProgressPrimitive.Root
      value={pct}
      aria-label={label}
      className={cn(
        "bg-surface-3 border-line relative w-full overflow-hidden border",
        height,
        className,
      )}
    >
      <ProgressPrimitive.Indicator
        className={cn("size-full transition-transform duration-500 ease-out", fill)}
        style={{ transform: `translateX(-${100 - pct}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

/* -------------------------------------------------------------------------- */
/* Tabs                                                                        */
/* -------------------------------------------------------------------------- */

export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(function TabsList({ className, ...props }, ref) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn("border-line-strong flex items-center gap-1 border-b-2", className)}
      {...props}
    />
  );
});

export const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(function TabsTrigger({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "ui-label text-ink-3 relative -mb-0.5 cursor-pointer px-3 py-2 text-[11px] whitespace-nowrap",
        "border-b-2 border-transparent transition-colors duration-150",
        "hover:text-ink",
        "data-[state=active]:border-brand data-[state=active]:text-ink",
        className,
      )}
      {...props}
    />
  );
});

export const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function TabsContent({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Content
      ref={ref}
      className={cn("focus-visible:outline-none", className)}
      {...props}
    />
  );
});
