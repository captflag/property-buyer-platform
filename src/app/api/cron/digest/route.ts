import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { runWeeklyDigest } from "@/lib/data/digest-run";
import { isSupabaseConfigured } from "@/lib/env";
import { logError, logEvent } from "@/lib/log";

export const dynamic = "force-dynamic";
/** The platform's ceiling for this function; the run itself stops well inside it. */
export const maxDuration = 60;

/** How long one run may spend before it stops and reports `complete: false`. */
const RUN_BUDGET_MS = 45_000;

function authorised(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Send this week's digest.
 *
 * Called by a scheduler, never by a browser. Vercel Cron sends
 * `Authorization: Bearer $CRON_SECRET` on its own; any other scheduler (a
 * GitHub Actions cron, a system crontab running curl) sends the same header.
 * Safe to call more than once -- anyone already sent this week's digest is
 * skipped -- so a run that reports `complete: false` is simply called again.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not set, so scheduled jobs are switched off." },
      { status: 503 },
    );
  }
  if (!authorised(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "The digest needs a database and SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 },
    );
  }

  try {
    const report = await runWeeklyDigest({ budgetMs: RUN_BUDGET_MS });
    logEvent("digest_run", { ...report });
    return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logError("digest_run_failed", error);
    return NextResponse.json(
      { error: "The digest run failed; see the server log." },
      { status: 500 },
    );
  }
}
