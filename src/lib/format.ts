/**
 * Formatting helpers.
 *
 * Every formatter here is locale-aware and deterministic given the same inputs,
 * so server-rendered markup matches what the client renders on hydration. That
 * is why nothing in this file reads `new Date()` implicitly -- callers pass the
 * reference instant, which keeps relative times stable across the boundary.
 */

const DEFAULT_LOCALE = "en-US";

export function formatCurrency(
  amount: number,
  currency = "USD",
  options: { compact?: boolean; locale?: string } = {},
): string {
  const { compact = false, locale = DEFAULT_LOCALE } = options;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(amount);
}

export function formatNumber(
  value: number,
  options: { compact?: boolean; decimals?: number; locale?: string } = {},
): string {
  const { compact = false, decimals, locale = DEFAULT_LOCALE } = options;
  return new Intl.NumberFormat(locale, {
    notation: compact ? "compact" : "standard",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals ?? (compact ? 1 : 2),
  }).format(value);
}

export function formatPercent(value: number, decimals = 0, locale = DEFAULT_LOCALE): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100);
}

/** A signed percentage-point delta: "+4.2 pts" / "-1.0 pts". */
export function formatPoints(value: number, decimals = 1): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(decimals)} pts`;
}

export function formatDate(
  input: string | Date | null | undefined,
  style: "short" | "medium" | "long" | "day-month" = "medium",
  locale = DEFAULT_LOCALE,
): string {
  if (!input) return "—";
  const date = typeof input === "string" ? parseDate(input) : input;
  if (!date || Number.isNaN(date.getTime())) return "—";

  const options: Intl.DateTimeFormatOptions =
    style === "short"
      ? { month: "short", day: "numeric" }
      : style === "day-month"
        ? { day: "numeric", month: "short" }
        : style === "long"
          ? { weekday: "long", year: "numeric", month: "long", day: "numeric" }
          : { year: "numeric", month: "short", day: "numeric" };

  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(date);
}

export function formatDateTime(
  input: string | Date | null | undefined,
  locale = DEFAULT_LOCALE,
): string {
  if (!input) return "—";
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/**
 * Relative time. `now` is an explicit parameter rather than an implicit
 * `Date.now()` so a server render and the matching client hydration agree.
 */
export function formatRelative(input: string | Date, now: Date, locale = DEFAULT_LOCALE): string {
  const date = typeof input === "string" ? new Date(input) : input;
  const diffMs = date.getTime() - now.getTime();
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31_536_000_000],
    ["month", 2_592_000_000],
    ["week", 604_800_000],
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];

  for (const [unit, ms] of units) {
    if (Math.abs(diffMs) >= ms) {
      return rtf.format(Math.round(diffMs / ms), unit);
    }
  }
  return rtf.format(Math.round(diffMs / 1000), "second");
}

export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

/**
 * Parse a plain `YYYY-MM-DD` as UTC midnight.
 *
 * `new Date("2026-03-15")` is already UTC, but `new Date("2026-03-15T00:00:00")`
 * is local -- mixing the two shifts calendar dates by a day for anyone west of
 * Greenwich. Everything date-shaped in this app goes through here.
 */
export function parseDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) {
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  }
  return new Date(value);
}

/** Whole days from a to b, positive when b is later. */
export function daysBetween(a: string | Date, b: string | Date): number {
  const start = typeof a === "string" ? parseDate(a) : a;
  const end = typeof b === "string" ? parseDate(b) : b;
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

/** Shift a date by n days, returning a `YYYY-MM-DD` string. */
export function addDays(value: string | Date, days: number): string {
  const date = typeof value === "string" ? parseDate(value) : new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** "in_progress" -> "In progress". Used for enum values in the UI. */
export function humanise(value: string): string {
  const spaced = value.replace(/[_-]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}
