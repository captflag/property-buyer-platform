/**
 * Who receives the weekly digest, and what the email carries.
 *
 * Pure, so the rules that decide whether someone is emailed are tested
 * directly rather than trusted to a scheduler that is hard to run locally.
 */

import { formatDate } from "@/lib/format";

export type DigestFrequency = "instant" | "daily" | "weekly" | "never";

export interface DigestRecipient {
  userId: string;
  email: string;
  name: string | null;
}

/**
 * Members of a project who asked for the weekly digest by email.
 *
 * Someone with no preferences row has the table's defaults -- email on,
 * frequency "daily" -- and so is not sent the weekly email: nobody receives
 * one without having chosen it.
 */
export function digestRecipients(input: {
  projectId: string;
  members: ReadonlyArray<{ project_id: string; user_id: string }>;
  preferences: ReadonlyArray<{
    user_id: string;
    email_enabled: boolean;
    digest_frequency: string;
  }>;
  profiles: ReadonlyArray<{ id: string; email: string | null; full_name: string | null }>;
}): DigestRecipient[] {
  const preferenceOf = new Map(input.preferences.map((p) => [p.user_id, p]));
  const profileOf = new Map(input.profiles.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const recipients: DigestRecipient[] = [];

  for (const member of input.members) {
    if (member.project_id !== input.projectId || seen.has(member.user_id)) continue;
    seen.add(member.user_id);

    const preference = preferenceOf.get(member.user_id);
    if (!preference || !preference.email_enabled || preference.digest_frequency !== "weekly") {
      continue;
    }

    const profile = profileOf.get(member.user_id);
    const email = profile?.email?.trim();
    if (!email) continue;

    recipients.push({ userId: member.user_id, email, name: profile?.full_name ?? null });
  }

  return recipients;
}

/** The subject line, matching the preview on the digest page. */
export function digestSubject(projectName: string, periodEnd: string): string {
  return `${projectName}: week to ${formatDate(periodEnd, "medium")}`;
}

/** The same person, project and week always produce the same key. */
export function digestIdempotencyKey(projectId: string, userId: string, periodEnd: string): string {
  return `digest:${projectId}:${userId}:${periodEnd}`;
}

/** The plain-text body, with the way to change or stop it underneath. */
export function digestEmailBody(text: string, siteUrl: string): string {
  return `${text}\n\n--\nYou are receiving this because you chose a weekly digest.\nChange how often you hear from us: ${siteUrl}/settings\n`;
}
