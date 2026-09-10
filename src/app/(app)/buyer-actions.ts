"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getWorkspace, type TableKey } from "@/lib/data/workspace";
import { availableSlots, VISIT_PURPOSES } from "@/lib/domain/visits";
import { LIMITS, retryMessage, takeRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

/**
 * Server actions for the buyer-experience features.
 *
 * The pattern throughout: validate with Zod, resolve the caller from the
 * session (never from the request body), then let the database enforce the
 * rule -- RLS for plain inserts, SECURITY DEFINER functions where a buyer may
 * change only part of a row. The checks here exist to give a clear message;
 * the checks that actually protect the data are the ones in the migration.
 *
 * In demo mode nothing persists. Actions say so with `demo: true`, and the
 * interface keeps its optimistic state so the demonstration stays usable.
 */

export interface ActionResult {
  ok: boolean;
  message: string;
  demo?: boolean;
}

const DEMO: ActionResult = {
  ok: false,
  demo: true,
  message: "Demo mode — this change is shown but not saved.",
};

/** The caller, a client under their session, and the project tables the action reads. */
async function context<const K extends TableKey = never>(tables: readonly K[] = []) {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const workspace = await getWorkspace(undefined, tables);
  return { supabase, user, workspace };
}

function revalidateProject(slug: string, ...pages: string[]) {
  revalidatePath("/dashboard");
  for (const page of pages) revalidatePath(`/projects/${slug}/${page}`);
}

/* -------------------------------------------------------------- selections */

const chooseSchema = z.object({
  categoryId: z.string().uuid(),
  optionId: z.string().uuid(),
  notes: z.string().trim().max(1000).optional(),
});

export async function chooseSelection(input: z.input<typeof chooseSchema>): Promise<ActionResult> {
  const parsed = chooseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That choice could not be recorded." };

  const ctx = await context();
  if (!ctx) return DEMO;
  if (!ctx.user) return { ok: false, message: "You need to be signed in to make a choice." };

  const { error } = await ctx.supabase.rpc("choose_selection", {
    p_category_id: parsed.data.categoryId,
    p_option_id: parsed.data.optionId,
    p_notes: parsed.data.notes ?? null,
  });

  if (error) {
    // The function raises a readable message for the one case a buyer can
    // actually hit -- a selection the build team has already confirmed.
    return {
      ok: false,
      message: error.message.includes("change order")
        ? "The build team has already confirmed this one. A change now needs a change order."
        : "That choice could not be recorded. Please try again.",
    };
  }

  revalidateProject(ctx.workspace.project.slug, "selections");
  return { ok: true, message: "Choice recorded. The build team has been notified." };
}

/* ------------------------------------------------------ since you last looked */

export async function markProjectSeen(): Promise<ActionResult> {
  const ctx = await context();
  if (!ctx) return DEMO;
  if (!ctx.user) return { ok: false, message: "You need to be signed in." };

  const { error } = await ctx.supabase.rpc("mark_project_seen", {
    p_project_id: ctx.workspace.project.id,
  });
  if (error) return { ok: false, message: "Could not update. Please try again." };

  revalidatePath("/dashboard");
  return { ok: true, message: "You're all caught up." };
}

/* ------------------------------------------------------------------- snags */

const SNAG_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const SNAG_MAX_BYTES = 10 * 1024 * 1024;

const snagSchema = z.object({
  title: z.string().trim().min(4, "Give the snag a short title.").max(160),
  room: z.string().trim().min(1, "Choose the room.").max(80),
  description: z.string().trim().max(2000).optional(),
  severity: z.enum(["low", "medium", "high"]),
});

export async function reportSnag(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = snagSchema.safeParse({
    title: formData.get("title"),
    room: formData.get("room"),
    description: formData.get("description") || undefined,
    severity: formData.get("severity") ?? "medium",
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? "Check the form.",
    };
  }

  const photo = formData.get("photo");
  const hasPhoto = photo instanceof File && photo.size > 0;
  if (hasPhoto) {
    if (!SNAG_IMAGE_TYPES.includes(photo.type)) {
      return { ok: false, message: "Photos need to be JPEG, PNG, WebP or AVIF." };
    }
    if (photo.size > SNAG_MAX_BYTES) {
      return { ok: false, message: "That photo is over 10 MB. Try a smaller one." };
    }
  }

  const ctx = await context();
  if (!ctx) return DEMO;
  if (!ctx.user) return { ok: false, message: "You need to be signed in to report a snag." };

  const limit = await takeRateLimit(LIMITS.snag);
  if (!limit.allowed) {
    return {
      ok: false,
      message: `That is a lot of snags in a short time. ${retryMessage(limit.retryAfterSeconds)}`,
    };
  }

  const projectId = ctx.workspace.project.id;
  const photoPaths: string[] = [];

  if (hasPhoto) {
    // The path is derived from the session, never from the form, so the
    // storage policy's "<project>/snags/<your id>/" rule cannot be spoofed.
    const extension = photo.type.split("/")[1] ?? "jpg";
    const path = `${projectId}/snags/${ctx.user.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await ctx.supabase.storage
      .from("project-media")
      .upload(path, photo, { contentType: photo.type, upsert: false });
    if (uploadError) return { ok: false, message: "The photo could not be uploaded." };
    photoPaths.push(path);
  }

  const { error } = await ctx.supabase.from("issues").insert({
    project_id: projectId,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    room: parsed.data.room,
    location: parsed.data.room,
    severity: parsed.data.severity,
    status: "open",
    reported_by: ctx.user.id,
    raised_by_buyer: true,
    photo_paths: photoPaths,
  });

  if (error) return { ok: false, message: "The snag could not be saved. Please try again." };

  revalidateProject(ctx.workspace.project.slug, "quality");
  return { ok: true, message: "Snag reported. The site team has been notified." };
}

/* --------------------------------------------------------------- questions */

const questionSchema = z.object({
  discussionId: z.string().uuid().optional(),
  subjectKind: z.enum([
    "milestone",
    "update",
    "document",
    "selection",
    "issue",
    "payment",
    "photo",
    "general",
  ]),
  subjectId: z.string().uuid().nullable().optional(),
  subjectLabel: z.string().trim().max(200).nullable().optional(),
  title: z.string().trim().min(3).max(160).optional(),
  body: z.string().trim().min(1, "Write a message first.").max(4000),
});

export async function postQuestion(input: z.input<typeof questionSchema>): Promise<ActionResult> {
  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? "Check your message.",
    };
  }

  const ctx = await context();
  if (!ctx) return DEMO;
  if (!ctx.user) return { ok: false, message: "You need to be signed in to ask a question." };

  const limit = await takeRateLimit(LIMITS.question);
  if (!limit.allowed) {
    return {
      ok: false,
      message: `That is a lot of messages in a short time. ${retryMessage(limit.retryAfterSeconds)}`,
    };
  }

  const projectId = ctx.workspace.project.id;
  let discussionId = parsed.data.discussionId;

  if (!discussionId) {
    const { data, error } = await ctx.supabase
      .from("discussions")
      .insert({
        project_id: projectId,
        subject_kind: parsed.data.subjectKind,
        subject_id: parsed.data.subjectId ?? null,
        subject_label: parsed.data.subjectLabel ?? null,
        title: parsed.data.title ?? parsed.data.body.slice(0, 80),
        created_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error || !data) return { ok: false, message: "Your question could not be posted." };
    discussionId = data.id as string;
  }

  const { error } = await ctx.supabase.from("discussion_messages").insert({
    discussion_id: discussionId,
    project_id: projectId,
    author_id: ctx.user.id,
    body: parsed.data.body,
  });
  if (error) return { ok: false, message: "Your message could not be posted." };

  revalidateProject(ctx.workspace.project.slug, "questions");
  return { ok: true, message: "Sent. You'll be notified when the build team replies." };
}

/* ------------------------------------------------------------- site visits */

const visitSchema = z.object({
  startsAt: z.string().datetime(),
  purpose: z.enum(VISIT_PURPOSES),
  attendees: z.coerce.number().int().min(1).max(6),
  notes: z.string().trim().max(500).optional(),
});

export async function requestSiteVisit(input: z.input<typeof visitSchema>): Promise<ActionResult> {
  const parsed = visitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Choose a time and a reason for the visit." };

  const ctx = await context(["siteVisits"]);
  if (!ctx) return DEMO;
  if (!ctx.user) return { ok: false, message: "You need to be signed in to book a visit." };

  const limit = await takeRateLimit(LIMITS.visit);
  if (!limit.allowed) {
    return {
      ok: false,
      message: `That is a lot of visit requests in a short time. ${retryMessage(limit.retryAfterSeconds)}`,
    };
  }

  // Re-derive the offer server-side. A slot the client shows might have been
  // taken a moment ago, or a tampered request might name any time at all; the
  // only times that may be booked are ones the rules would offer right now.
  const offered = availableSlots({
    asOf: new Date(),
    timeZone: ctx.workspace.project.timezone,
    existing: ctx.workspace.siteVisits,
  });
  const requested = new Date(parsed.data.startsAt).getTime();
  if (!offered.some((slot) => new Date(slot.startsAt).getTime() === requested)) {
    return { ok: false, message: "That time is no longer available. Please pick another." };
  }

  const { error } = await ctx.supabase.from("site_visits").insert({
    project_id: ctx.workspace.project.id,
    requested_by: ctx.user.id,
    starts_at: parsed.data.startsAt,
    purpose: parsed.data.purpose,
    attendees: parsed.data.attendees,
    notes: parsed.data.notes ?? null,
    status: "requested",
  });

  if (error) {
    // The partial unique index catches a race between two buyers.
    return error.code === "23505"
      ? { ok: false, message: "Someone booked that slot just now. Please pick another." }
      : { ok: false, message: "The visit could not be requested. Please try again." };
  }

  revalidateProject(ctx.workspace.project.slug, "visits");
  return { ok: true, message: "Visit requested. The site manager will confirm it." };
}

export async function cancelSiteVisit(visitId: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(visitId).success) {
    return { ok: false, message: "That visit could not be found." };
  }
  const ctx = await context();
  if (!ctx) return DEMO;
  if (!ctx.user) return { ok: false, message: "You need to be signed in." };

  const { error } = await ctx.supabase
    .from("site_visits")
    .update({ status: "cancelled" })
    .eq("id", visitId);
  if (error) return { ok: false, message: "The visit could not be cancelled." };

  revalidateProject(ctx.workspace.project.slug, "visits");
  return { ok: true, message: "Visit cancelled." };
}

const decisionSchema = z.object({
  visitId: z.string().uuid(),
  decision: z.enum(["confirmed", "declined"]),
  note: z.string().trim().max(500).optional(),
});

/** Build team only -- enforced by the site_visits_update_writer policy. */
export async function decideSiteVisit(
  input: z.input<typeof decisionSchema>,
): Promise<ActionResult> {
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That decision could not be recorded." };

  const ctx = await context();
  if (!ctx) return DEMO;
  if (!ctx.user) return { ok: false, message: "You need to be signed in." };

  const { error } = await ctx.supabase
    .from("site_visits")
    .update({ status: parsed.data.decision, builder_note: parsed.data.note ?? null })
    .eq("id", parsed.data.visitId);
  if (error) return { ok: false, message: "The decision could not be recorded." };

  revalidateProject(ctx.workspace.project.slug, "visits");
  revalidatePath("/builder");
  return { ok: true, message: `Visit ${parsed.data.decision}.` };
}

/* --------------------------------------------------------------- move plan */

const toggleSchema = z.object({
  templateKey: z.string().max(80).optional(),
  taskId: z.string().uuid().optional(),
  done: z.boolean(),
});

export async function toggleMoveTask(input: z.input<typeof toggleSchema>): Promise<ActionResult> {
  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success || (!parsed.data.templateKey && !parsed.data.taskId)) {
    return { ok: false, message: "That task could not be updated." };
  }

  const ctx = await context();
  if (!ctx) return DEMO;
  if (!ctx.user) return { ok: false, message: "You need to be signed in." };

  const doneAt = parsed.data.done ? new Date().toISOString() : null;
  const { error } = parsed.data.templateKey
    ? await ctx.supabase.from("move_tasks").upsert(
        {
          project_id: ctx.workspace.project.id,
          user_id: ctx.user.id,
          template_key: parsed.data.templateKey,
          done_at: doneAt,
        },
        { onConflict: "project_id,user_id,template_key" },
      )
    : await ctx.supabase
        .from("move_tasks")
        .update({ done_at: doneAt })
        .eq("id", parsed.data.taskId!);

  if (error) return { ok: false, message: "That task could not be updated." };
  revalidateProject(ctx.workspace.project.slug, "move-in");
  return { ok: true, message: parsed.data.done ? "Marked as done." : "Marked as not done." };
}

const addTaskSchema = z.object({
  title: z.string().trim().min(3, "Give the task a name.").max(160),
  category: z.enum(["Finance", "Home", "Services", "Admin", "Moving", "Family"]),
  daysBefore: z.coerce.number().int().min(-120).max(365),
});

export async function addMoveTask(input: z.input<typeof addTaskSchema>): Promise<ActionResult> {
  const parsed = addTaskSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? "Check the task.",
    };
  }

  const ctx = await context();
  if (!ctx) return DEMO;
  if (!ctx.user) return { ok: false, message: "You need to be signed in." };

  const { error } = await ctx.supabase.from("move_tasks").insert({
    project_id: ctx.workspace.project.id,
    user_id: ctx.user.id,
    title: parsed.data.title,
    category: parsed.data.category,
    days_before: parsed.data.daysBefore,
  });
  if (error) return { ok: false, message: "The task could not be added." };

  revalidateProject(ctx.workspace.project.slug, "move-in");
  return { ok: true, message: "Task added to your plan." };
}
