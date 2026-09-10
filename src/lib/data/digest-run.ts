import "server-only";

import { DERIVE_TABLES, deriveProject } from "@/lib/data/derived";
import { loadTables, type Workspace } from "@/lib/data/workspace";
import { composeDigest, digestToText, digestWindowStart } from "@/lib/domain/digest";
import {
  digestEmailBody,
  digestIdempotencyKey,
  digestRecipients,
  digestSubject,
} from "@/lib/domain/digest-delivery";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { siteUrl } from "@/lib/env";
import { toDateString } from "@/lib/format";
import { logError } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/server";
import type { Project, Update } from "@/types/database";

/**
 * The weekly digest, sent.
 *
 * Runs as the service role, because it composes for projects nobody is
 * signed in to -- which is also why each project's data is read with an
 * explicit project id and nothing else. It works through active projects a
 * batch at a time, composes each digest once and sends it to every member
 * who chose the weekly email.
 *
 * A run stops when its time budget is spent and reports `complete: false`.
 * Calling it again carries on: people already sent this week's digest are
 * skipped, so re-runs, retries and overlapping triggers are all safe.
 */

const PROJECT_BATCH = 25;
const ACTIVE_STATUSES = ["planning", "in_progress", "on_hold"];
const DIGEST_TABLES = [...DERIVE_TABLES, "payments"] as const;

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

export interface DigestRunReport {
  periodEnd: string;
  mode: "send" | "dry-run";
  /** Projects with at least one recipient still to send to. */
  projectsComposed: number;
  sent: number;
  /** Recipients who would have been emailed, in a dry run. */
  wouldSend: number;
  /** Recipients this week's digest had already reached. */
  alreadySent: number;
  failed: number;
  /** False when the time budget ran out first; call again to carry on. */
  complete: boolean;
}

export async function runWeeklyDigest(options: {
  budgetMs: number;
  asOf?: Date;
}): Promise<DigestRunReport> {
  const admin = createAdminClient();
  if (!admin) throw new Error("The digest scheduler needs SUPABASE_SERVICE_ROLE_KEY.");

  const asOf = options.asOf ?? new Date();
  const periodEnd = toDateString(asOf);
  const deadline = Date.now() + options.budgetMs;
  const dryRun = !isEmailConfigured();
  const report: DigestRunReport = {
    periodEnd,
    mode: dryRun ? "dry-run" : "send",
    projectsComposed: 0,
    sent: 0,
    wouldSend: 0,
    alreadySent: 0,
    failed: 0,
    complete: false,
  };

  let after: string | null = null;
  while (Date.now() < deadline) {
    let query = admin
      .from("projects")
      .select("*")
      .in("status", ACTIVE_STATUSES)
      .order("id")
      .limit(PROJECT_BATCH);
    if (after) query = query.gt("id", after);

    const { data, error } = await query;
    if (error) throw error;
    const projects = (data ?? []) as Project[];
    if (projects.length === 0) {
      report.complete = true;
      break;
    }
    after = projects[projects.length - 1]!.id;

    const ids = projects.map((p) => p.id);
    const [{ data: members }, { data: delivered }] = await Promise.all([
      admin.from("project_members").select("project_id, user_id").in("project_id", ids),
      admin
        .from("digest_deliveries")
        .select("project_id, user_id")
        .eq("period_end", periodEnd)
        .in("project_id", ids),
    ]);
    const userIds = [...new Set((members ?? []).map((m: { user_id: string }) => m.user_id))];
    if (userIds.length === 0) continue;

    const [{ data: preferences }, { data: profiles }] = await Promise.all([
      admin
        .from("notification_preferences")
        .select("user_id, email_enabled, digest_frequency")
        .in("user_id", userIds),
      admin.from("profiles").select("id, email, full_name").in("id", userIds),
    ]);
    const done = new Set(
      (delivered ?? []).map(
        (d: { project_id: string; user_id: string }) => `${d.project_id}:${d.user_id}`,
      ),
    );

    for (const project of projects) {
      if (Date.now() >= deadline) return report;

      const recipients = digestRecipients({
        projectId: project.id,
        members: members ?? [],
        preferences: preferences ?? [],
        profiles: profiles ?? [],
      });
      const pending = recipients.filter((r) => !done.has(`${project.id}:${r.userId}`));
      report.alreadySent += recipients.length - pending.length;
      if (pending.length === 0) continue;

      const digest = await composeFor(admin, project, asOf);
      report.projectsComposed += 1;
      const subject = digestSubject(project.name, digest.periodEnd);
      const text = digestEmailBody(digestToText(digest, siteUrl), siteUrl);

      for (const recipient of pending) {
        if (dryRun) {
          report.wouldSend += 1;
          continue;
        }

        const key = { project_id: project.id, user_id: recipient.userId, period_end: periodEnd };

        // Claim before sending: of two overlapping runs, only one inserts.
        const { error: claimError } = await admin.from("digest_deliveries").insert(key);
        if (claimError) {
          if (claimError.code === "23505") {
            report.alreadySent += 1;
            continue;
          }
          throw claimError;
        }

        const result = await sendEmail({
          to: recipient.email,
          subject,
          text,
          idempotencyKey: digestIdempotencyKey(project.id, recipient.userId, periodEnd),
        });

        if (result.status === "sent") {
          await admin
            .from("digest_deliveries")
            .update({
              status: "sent",
              provider_id: result.id,
              updated_at: new Date().toISOString(),
            })
            .match(key);
          report.sent += 1;
        } else {
          // Release the claim so the next run tries this person again.
          await admin.from("digest_deliveries").delete().match(key);
          report.failed += 1;
          logError(
            "digest_send_failed",
            result.status === "failed" ? result.error : "email switched off mid-run",
            { projectId: project.id, userId: recipient.userId },
          );
        }
      }
    }
  }

  return report;
}

/** One project's digest, from the same tables and derivations as the digest page. */
async function composeFor(admin: Admin, project: Project, asOf: Date) {
  const [tables, { data: updates }] = await Promise.all([
    loadTables(admin, project.id, DIGEST_TABLES),
    admin
      .from("updates")
      .select("*")
      .eq("project_id", project.id)
      .gt("published_at", digestWindowStart(asOf))
      .order("published_at", { ascending: false })
      .limit(200),
  ]);

  const w: Workspace<(typeof DIGEST_TABLES)[number]> = {
    ...tables,
    organization: null,
    project,
    isDemo: false,
    now: asOf.toISOString(),
  };
  const d = deriveProject(w, null);

  return composeDigest({
    projectName: project.name,
    slug: project.slug,
    currency: project.currency,
    asOf,
    snapshots: w.snapshots,
    updates: (updates ?? []) as Update[],
    milestones: w.milestones,
    payments: w.payments,
    issues: w.issues,
    selections: d.selections,
    delay: d.delay,
  });
}
