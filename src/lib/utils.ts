import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names, with later Tailwind utilities winning. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Clamp n into [min, max]. */
export function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

/**
 * Map a value from one range to another. Used constantly by the hand-rolled
 * charts to turn data units into SVG coordinates.
 */
export function scale(
  value: number,
  [inMin, inMax]: [number, number],
  [outMin, outMax]: [number, number],
): number {
  if (inMax === inMin) return outMin;
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}

/** Sum a numeric field across a list, tolerating null/undefined entries. */
export function sumBy<T>(
  items: readonly T[],
  pick: (item: T) => number | null | undefined,
): number {
  return items.reduce<number>((total, item) => total + (pick(item) ?? 0), 0);
}

/** Group a list into a Map keyed by the given selector. */
export function groupBy<T, K>(items: readonly T[], key: (item: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = out.get(k);
    if (bucket) bucket.push(item);
    else out.set(k, [item]);
  }
  return out;
}

/** Stable, dependency-free id for client-only rows (optimistic UI). */
export function localId(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Initials for an avatar fallback: "Amara Okafor" -> "AO". */
export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
