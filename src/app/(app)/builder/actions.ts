"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getWorkspace } from "@/lib/data/workspace";
import { logError } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";

/**
 * Server actions for the build team.
 *
 * Every action validates its input with Zod before touching the database, and
 * every one re-checks authorisation server-side. The client hides controls the
 * user cannot use, but hiding a button is a courtesy, not a permission -- the
 * check that matters is here, backed by RLS underneath.
 *
 * In demo mode there is no database, so actions return a clear "not saved"
 * result rather than pretending to succeed. Silently discarding a write would
 * be worse than refusing it.
 */

export interface ActionResult {
  ok: boolean;
  message: string;
  demo?: boolean;
}

const postUpdateSchema = z.object({
  title: z.string().trim().min(4, "Give the update a title of at least 4 characters.").max(200),
  body: z.string().trim().min(20, "Write at least a couple of sentences.").max(8000),
  milestoneId: z.string().uuid().optional().or(z.literal("")),
  status: z.enum(["not_started", "in_progress", "blocked", "completed", "cancelled"]),
  crewSize: z.coerce.number().int().min(0).max(500).optional(),
  hoursWorked: z.coerce.number().min(0).max(9999).optional(),
  weather: z.string().trim().max(60).optional(),
  temperatureC: z.coerce.number().min(-60).max(60).optional(),
  progressDelta: z.coerce.number().min(-100).max(100).optional(),
  // Which site the update is for. RLS, not this field, decides whether the
  // caller may post there.
  projectSlug: z.string().trim().min(1).max(200).optional(),
});

export async function postUpdate(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = postUpdateSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    milestoneId: formData.get("milestoneId") ?? "",
    status: formData.get("status") ?? "in_progress",
    crewSize: formData.get("crewSize") || undefined,
    hoursWorked: formData.get("hoursWorked") || undefined,
    weather: formData.get("weather") || undefined,
    temperatureC: formData.get("temperatureC") || undefined,
    progressDelta: formData.get("progressDelta") || undefined,
    projectSlug: formData.get("projectSlug") || undefined,
  });

  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return { ok: false, message: first ?? "Please check the form and try again." };
  }

  const supabase = await createClient();
  const workspace = await getWorkspace(parsed.data.projectSlug, ["members"]);

  if (!supabase) {
    return {
      ok: false,
      demo: true,
      message:
        "Running in demo mode, so this update was not saved. Connect a Supabase project and it will post for real.",
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "You need to be signed in to post an update." };
  }

  const membership = workspace.members.find((m) => m.user_id === user.id);
  if (!membership || (membership.role !== "builder" && membership.role !== "inspector")) {
    return { ok: false, message: "Only the build team can post site updates." };
  }

  const { error } = await supabase.from("updates").insert({
    project_id: workspace.project.id,
    milestone_id: parsed.data.milestoneId || null,
    author_id: user.id,
    title: parsed.data.title,
    body: parsed.data.body,
    status: parsed.data.status,
    crew_size: parsed.data.crewSize ?? null,
    hours_worked: parsed.data.hoursWorked ?? null,
    weather: parsed.data.weather ?? null,
    temperature_c: parsed.data.temperatureC ?? null,
    progress_delta: parsed.data.progressDelta ?? null,
    is_published: true,
  });

  if (error) {
    logError("post_update_failed", error, { projectId: workspace.project.id });
    return { ok: false, message: "Could not post the update. Please try again." };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/projects/${workspace.project.slug}/updates`);
  revalidatePath("/builder");

  return { ok: true, message: "Update posted. Everyone on the project has been notified." };
}

const progressSchema = z.object({
  milestoneId: z.string().uuid(),
  progress: z.coerce.number().min(0).max(100),
  status: z.enum(["not_started", "in_progress", "blocked", "completed", "cancelled"]),
});

export async function updateMilestoneProgress(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = progressSchema.safeParse({
    milestoneId: formData.get("milestoneId"),
    progress: formData.get("progress"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return { ok: false, message: "That progress value is not valid." };
  }

  const supabase = await createClient();
  const workspace = await getWorkspace(undefined, ["members"]);

  if (!supabase) {
    return {
      ok: false,
      demo: true,
      message: "Demo mode — progress was not saved.",
    };
  }

  const { milestoneId, progress, status } = parsed.data;

  // Completing a milestone stamps its actual finish; reopening one clears it,
  // so the schedule maths never sees a finished date on unfinished work.
  const patch: Record<string, unknown> = { progress_percent: progress, status };
  if (status === "completed") {
    patch.actual_end = new Date().toISOString().slice(0, 10);
  } else {
    patch.actual_end = null;
  }

  const { error } = await supabase.from("milestones").update(patch).eq("id", milestoneId);

  if (error) {
    logError("milestone_progress_failed", error, { milestoneId });
    return { ok: false, message: "Could not save that change." };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/projects/${workspace.project.slug}/timeline`);
  revalidatePath("/builder");

  return { ok: true, message: "Milestone updated." };
}

const drawDecisionSchema = z.object({
  drawId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(1000).optional(),
});

export async function decideDrawRequest(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = drawDecisionSchema.safeParse({
    drawId: formData.get("drawId"),
    decision: formData.get("decision"),
    note: formData.get("note") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, message: "That decision could not be recorded." };
  }

  const supabase = await createClient();
  const workspace = await getWorkspace(undefined, ["members"]);

  if (!supabase) {
    return { ok: false, demo: true, message: "Demo mode — the decision was not saved." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "You need to be signed in." };

  const { error } = await supabase
    .from("draw_requests")
    .update({
      status: parsed.data.decision,
      decided_at: new Date().toISOString(),
      decided_by: user.id,
      decision_note: parsed.data.note ?? null,
    })
    .eq("id", parsed.data.drawId);

  if (error) {
    logError("draw_decision_failed", error, { drawId: parsed.data.drawId });
    return { ok: false, message: "Could not record that decision." };
  }

  revalidatePath(`/projects/${workspace.project.slug}/finance`);
  revalidatePath("/builder");

  return {
    ok: true,
    message: `Draw request ${parsed.data.decision}.`,
  };
}
