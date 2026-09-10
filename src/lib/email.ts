import "server-only";

import { logError } from "@/lib/log";

/**
 * Outgoing email, through Resend's HTTP API.
 *
 * One `fetch` rather than an SDK: the surface needed is a single endpoint,
 * and any provider with an HTTP API can replace it by changing this file.
 * Without `RESEND_API_KEY` and `DIGEST_FROM_EMAIL` nothing is sent and the
 * caller is told it was a dry run -- a deployment without email still runs
 * the scheduler end to end, which is how it is tested before going live.
 */

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  /** Resend drops a repeat of the same key, a second guard against double sends. */
  idempotencyKey: string;
}

export type SendResult =
  | { status: "sent"; id: string | null }
  | { status: "dry-run" }
  | { status: "failed"; error: string };

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.DIGEST_FROM_EMAIL);
}

export async function sendEmail(email: OutgoingEmail): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.DIGEST_FROM_EMAIL;
  if (!key || !from) return { status: "dry-run" };

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": email.idempotencyKey,
      },
      body: JSON.stringify({ from, to: [email.to], subject: email.subject, text: email.text }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      return { status: "failed", error: `${response.status} ${detail}` };
    }

    const body = (await response.json()) as { id?: string };
    return { status: "sent", id: body.id ?? null };
  } catch (error) {
    logError("email_send_failed", error);
    return { status: "failed", error: error instanceof Error ? error.message : String(error) };
  }
}
