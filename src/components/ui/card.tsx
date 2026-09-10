import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A section of a page.
 *
 * Editorial by default: no fill and no outline, just a rule above and space
 * around it. Twenty identical boxes on a page flatten every hierarchy, so a
 * box is reserved for the one thing that should stand out -- pass `raised`
 * for that (the next payment, an overdue decision).
 */
export function Card({
  className,
  interactive = false,
  raised = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean; raised?: boolean }) {
  return (
    <div
      className={cn(
        "ui-card",
        raised && "ui-card--raised",
        interactive &&
          "hover:border-t-accent focus-within:border-t-accent transition-colors duration-200",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5 pt-6 pb-4", className)} {...props} />;
}

/**
 * Sets the last word of a string title in the italic serif -- "Decisions
 * *due*" -- the same accent voice as the landing page. Single words and
 * non-string titles are left as they are.
 */
function withAccent(children: React.ReactNode): React.ReactNode {
  if (typeof children !== "string") return children;
  const text = children.trimEnd();
  const split = text.lastIndexOf(" ");
  if (split <= 0) return children;
  return (
    <>
      {text.slice(0, split + 1)}
      <span className="ui-accent">{text.slice(split + 1)}</span>
    </>
  );
}

/**
 * Card headers carry a heading and often an action. The heading level is a
 * prop rather than hard-coded: a card inside a page section is usually an h3,
 * but the same card at the top of a page is an h2, and getting that wrong
 * breaks the document outline for screen reader users.
 */
export function CardTitle({
  className,
  as: Comp = "h3",
  accent = true,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & {
  as?: "h2" | "h3" | "h4";
  /** Set the last word in the italic serif. On by default. */
  accent?: boolean;
}) {
  return (
    <Comp
      className={cn(
        "ui-display text-ink text-[22px] leading-[1.08] tracking-[-0.03em] sm:text-[24px]",
        className,
      )}
      {...props}
    >
      {accent ? withAccent(children) : children}
    </Comp>
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-ink-3 text-[13px] leading-relaxed", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("pb-8", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("border-line flex items-center gap-3 border-t py-3", className)}
      {...props}
    />
  );
}

/** A header row with the title on the left and controls on the right. */
export function CardToolbar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-start justify-between gap-4 pt-6 pb-4", className)} {...props} />
  );
}
