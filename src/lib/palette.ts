/**
 * Chart palette.
 *
 * Deliberately a plain module with no "use client" directive: both server and
 * client components need to resolve a phase or category to its colour, and a
 * value exported from a client module cannot be called during a server render.
 *
 * The slot order is the colourblind-safety mechanism, not a decorative choice.
 * It was validated against this app's own light and dark surfaces -- see
 * docs/DESIGN.md. Do not reorder it, and do not add a ninth colour: a ninth
 * series folds into "Other" or the chart gets faceted instead.
 */

export const SERIES_COLOURS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
] as const;

/** Resolve a 1-based palette slot to its CSS colour. */
export function seriesColour(slot: number): string {
  const index = Math.max(0, Math.min(SERIES_COLOURS.length - 1, Math.round(slot) - 1));
  return SERIES_COLOURS[index]!;
}
