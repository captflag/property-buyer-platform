"use client";

import * as React from "react";

import { useCountUp } from "@/lib/hooks";

/**
 * A figure that counts up to its value on first paint.
 *
 * Restricted to headline numbers -- the completion percentage, a contract
 * value, a stat tile. Animating every number on a page would turn a dashboard
 * into a slot machine, and the effect only reads as considered when it is rare.
 *
 * Renders the final value on the server and under reduced motion, so it is
 * safe in a server-rendered tree and honest about the user's preference.
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  format,
  durationMs,
  className,
}: {
  value: number;
  decimals?: number;
  /** Formats the interpolated value. Defaults to fixed decimals. */
  format?: (n: number) => string;
  durationMs?: number;
  className?: string;
}) {
  const current = useCountUp(value, { decimals, durationMs });
  const text = format ? format(current) : current.toFixed(decimals);

  return (
    <span className={className}>
      {/* The animated text is hidden from assistive tech and the settled value
          is announced once, so a screen reader is not read a stream of
          intermediate numbers. */}
      <span aria-hidden="true">{text}</span>
      <span className="sr-only">{format ? format(value) : value.toFixed(decimals)}</span>
    </span>
  );
}
