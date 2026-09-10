import "server-only";

import { headers } from "next/headers";

import { isSupabaseConfigured } from "@/lib/env";
import { logError } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";

/**
 * Rate limits for the actions that cost money or reach other people: the
 * assistant (a model call each), snag reports (a photo upload and a
 * notification to site), questions and visit requests (a notification each).
 *
 * The limits are generous for a person and tight for a script. They protect
 * cost and the build team's attention, not access -- row-level security still
 * decides access -- so a failure to count lets the request through and is
 * logged, rather than locking everyone out when the counter is unavailable.
 */

export interface RateLimit {
  /** Must match the list in `hit_rate_limit()`. */
  bucket: "assistant" | "snag" | "question" | "visit";
  max: number;
  windowSeconds: number;
}

export const LIMITS = {
  assistant: { bucket: "assistant", max: 30, windowSeconds: 10 * 60 },
  snag: { bucket: "snag", max: 20, windowSeconds: 60 * 60 },
  question: { bucket: "question", max: 30, windowSeconds: 10 * 60 },
  visit: { bucket: "visit", max: 10, windowSeconds: 60 * 60 },
} as const satisfies Record<string, RateLimit>;

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the window resets; 0 when allowed. */
  retryAfterSeconds: number;
}

/**
 * A fixed-window counter in memory, for demo mode and callers with no account.
 *
 * Per process, so across N instances the effective limit is N times higher --
 * acceptable for the anonymous path, which reaches no real data. Bounded, so
 * a flood of distinct addresses cannot grow it without limit.
 */
export function createMemoryLimiter(options: { now?: () => number; maxKeys?: number } = {}) {
  const now = options.now ?? Date.now;
  const maxKeys = options.maxKeys ?? 10_000;
  const windows = new Map<string, { start: number; hits: number }>();

  return (limit: RateLimit, identity: string): RateLimitResult => {
    const at = now();
    const windowMs = limit.windowSeconds * 1000;
    const start = Math.floor(at / windowMs) * windowMs;
    const key = `${limit.bucket}:${identity}`;

    const current = windows.get(key);
    const hits = current && current.start === start ? current.hits + 1 : 1;

    if (!current && windows.size >= maxKeys) {
      // Maps iterate in insertion order, so the first key is the oldest.
      const oldest = windows.keys().next().value;
      if (oldest !== undefined) windows.delete(oldest);
    }
    windows.set(key, { start, hits });

    const allowed = hits <= limit.max;
    return {
      allowed,
      retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((start + windowMs - at) / 1000)),
    };
  };
}

const memory = createMemoryLimiter();

/** The caller's address as the proxy in front of the app reports it. */
async function clientAddress(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/**
 * Spend one unit of a limit. Signed in, it is counted in Postgres and shared
 * by every instance; otherwise it is counted in memory against the address.
 */
export async function takeRateLimit(limit: RateLimit): Promise<RateLimitResult> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    if (supabase) {
      const { data: auth } = await supabase.auth.getClaims();
      if (auth?.claims.sub) {
        const { data, error } = await supabase.rpc("hit_rate_limit", {
          p_bucket: limit.bucket,
          p_max: limit.max,
          p_window_seconds: limit.windowSeconds,
        });
        if (error) {
          logError("rate_limit_unavailable", error, { bucket: limit.bucket });
          return { allowed: true, retryAfterSeconds: 0 };
        }
        const row = (data as Array<{ allowed: boolean; retry_after_seconds: number }> | null)?.[0];
        return row
          ? { allowed: row.allowed, retryAfterSeconds: row.retry_after_seconds }
          : { allowed: true, retryAfterSeconds: 0 };
      }
    }
  }

  return memory(limit, await clientAddress());
}

/** "Try again in 4 minutes." */
export function retryMessage(seconds: number): string {
  if (seconds < 90) return `Try again in ${seconds} seconds.`;
  return `Try again in ${Math.ceil(seconds / 60)} minutes.`;
}
