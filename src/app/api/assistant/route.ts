import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { answerQuestion } from "@/lib/ai/assistant";
import { ASSISTANT_RECENT_UPDATES, ASSISTANT_TABLES } from "@/lib/ai/context";
import { getUpdates } from "@/lib/data/feeds";
import { getWorkspace } from "@/lib/data/workspace";
import { logError } from "@/lib/log";
import { LIMITS, retryMessage, takeRateLimit } from "@/lib/rate-limit";

const requestSchema = z.object({
  question: z.string().min(1).max(2000),
  slug: z.string().max(200).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(8000),
      }),
    )
    .max(20)
    .optional(),
});

/**
 * Assistant endpoint.
 *
 * The workspace is loaded server-side under the caller's own session, so RLS
 * decides what the assistant can see. The client never sends project data up --
 * it sends a question, and grounding is assembled here. That means a user
 * cannot widen the assistant's view by tampering with the request body.
 */
export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { question, slug, history } = parsed.data;

  // Each question can be a paid model call, so it is counted before any work.
  const limit = await takeRateLimit(LIMITS.assistant);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: `You have asked a lot of questions in a short time. ${retryMessage(limit.retryAfterSeconds)}`,
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  try {
    const [workspace, recent] = await Promise.all([
      getWorkspace(slug, ASSISTANT_TABLES),
      getUpdates(slug, { limit: ASSISTANT_RECENT_UPDATES }),
    ]);

    if (!workspace.project.id) {
      return NextResponse.json(
        { error: "No project is available to answer questions about." },
        { status: 404 },
      );
    }

    const answer = await answerQuestion(
      question,
      { ...workspace, updates: recent.updates },
      history ?? [],
    );
    return NextResponse.json(answer);
  } catch (error) {
    logError("assistant_request_failed", error);
    return NextResponse.json(
      { error: "The assistant could not answer that just now. Please try again." },
      { status: 500 },
    );
  }
}
