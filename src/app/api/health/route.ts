import { NextResponse } from "next/server";

import { isAiConfigured, isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Health check, for uptime monitors and container orchestrators.
 *
 * 200 when the app can serve requests; 503 when a configured database cannot
 * be reached, so a load balancer stops sending traffic to an instance that
 * would only render errors. It reports what is connected and never a key, a
 * count or a record.
 */
export async function GET() {
  const started = Date.now();
  let database: "demo" | "ok" | "unreachable" = "demo";

  if (isSupabaseConfigured()) {
    try {
      // Anonymous, so RLS returns nothing -- this measures reachability only.
      const response = await fetch(`${supabaseUrl}/rest/v1/projects?select=id&limit=1`, {
        headers: { apikey: supabaseAnonKey },
        cache: "no-store",
        signal: AbortSignal.timeout(3_000),
      });
      database = response.ok ? "ok" : "unreachable";
    } catch {
      database = "unreachable";
    }
  }

  const healthy = database !== "unreachable";
  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      database,
      assistant: isAiConfigured() ? "model" : "local",
      checkedInMs: Date.now() - started,
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? process.env.APP_VERSION ?? null,
    },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
