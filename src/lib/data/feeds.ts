import "server-only";

import {
  decodeCursor,
  demoWindow,
  isUuid,
  keysetFilter,
  pageOf,
  type Window,
} from "@/lib/data/paging";
import { projectSource } from "@/lib/data/workspace";
import { createClient } from "@/lib/supabase/server";
import type { Discussion, DiscussionMessage, Update, UpdateMedia } from "@/types/database";

export { isCursor, type Window } from "@/lib/data/paging";

/**
 * Feeds: the tables that grow for as long as the build runs.
 *
 * A two-year build posts hundreds of updates and thousands of photographs,
 * and loading all of them to show the first twenty is the difference between
 * a page that stays fast in month eighteen and one that does not. Everything
 * here is read a page at a time, newest first, with a keyset cursor (see
 * `paging.ts`).
 *
 * Each function answers from the demo dataset or from Supabase under the
 * caller's own session, with identical ordering and paging, so RLS decides
 * what any feed can reach.
 */

/** Page sizes, shared by the pages and by the actions that load the next page. */
export const PAGE_SIZE = { updates: 20, photos: 48, threads: 30 } as const;

/* ------------------------------------------------------------------ updates */

export interface UpdatePage {
  updates: Update[];
  /** Media for exactly these updates. Empty unless asked for. */
  media: UpdateMedia[];
  nextCursor: string | null;
}

const publishedAt = (u: Update) => u.published_at;

/** Site updates, newest first. */
export async function getUpdates(
  slug: string | undefined,
  window: Window & { media?: boolean },
): Promise<UpdatePage> {
  const source = await projectSource(slug);

  if (source.kind === "demo") {
    const { items, nextCursor } = demoWindow(source.data.updates, publishedAt, window);
    const ids = new Set(items.map((u) => u.id));
    const media = window.media ? source.data.media.filter((m) => ids.has(m.update_id)) : [];
    return { updates: items, media, nextCursor };
  }

  const supabase = await createClient();
  if (source.kind === "empty" || !supabase) return { updates: [], media: [], nextCursor: null };

  let query = supabase
    .from("updates")
    .select("*")
    .eq("project_id", source.project.id)
    .order("published_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(window.limit + 1);
  if (window.since) query = query.gt("published_at", window.since);
  const cursor = decodeCursor(window.before);
  if (cursor) query = query.or(keysetFilter("published_at", cursor));

  const { data } = await query;
  const { items, nextCursor } = pageOf((data ?? []) as Update[], publishedAt, window.limit);

  let media: UpdateMedia[] = [];
  if (window.media && items.length > 0) {
    const { data: rows } = await supabase
      .from("update_media")
      .select("*")
      .in(
        "update_id",
        items.map((u) => u.id),
      )
      .order("sort");
    media = (rows ?? []) as UpdateMedia[];
  }

  return { updates: items, media, nextCursor };
}

/** One update, if it belongs to this project. */
export async function getUpdate(slug: string | undefined, id: string): Promise<Update | null> {
  if (!isUuid(id)) return null;
  const source = await projectSource(slug);

  if (source.kind === "demo") return source.data.updates.find((u) => u.id === id) ?? null;

  const supabase = await createClient();
  if (source.kind === "empty" || !supabase) return null;

  const { data } = await supabase
    .from("updates")
    .select("*")
    .eq("project_id", source.project.id)
    .eq("id", id)
    .maybeSingle();
  return (data as Update | null) ?? null;
}

export interface UpdateStats {
  /** Updates posted in the window. */
  count: number;
  /** Crew hours logged across them. */
  hours: number;
  /** Photographs attached to them. */
  photos: number;
}

/**
 * Activity since an instant, counted without loading the updates themselves:
 * the window is small by construction, and only two columns come back.
 */
export async function getUpdateStats(
  slug: string | undefined,
  since: string,
): Promise<UpdateStats> {
  const source = await projectSource(slug);

  if (source.kind === "demo") {
    const recent = source.data.updates.filter((u) => u.published_at >= since);
    const ids = new Set(recent.map((u) => u.id));
    return {
      count: recent.length,
      hours: recent.reduce((total, u) => total + (u.hours_worked ?? 0), 0),
      photos: source.data.media.filter((m) => m.kind === "image" && ids.has(m.update_id)).length,
    };
  }

  const supabase = await createClient();
  if (source.kind === "empty" || !supabase) return { count: 0, hours: 0, photos: 0 };

  const { data } = await supabase
    .from("updates")
    .select("id, hours_worked")
    .eq("project_id", source.project.id)
    .gte("published_at", since);
  const recent = (data ?? []) as Array<Pick<Update, "id" | "hours_worked">>;
  if (recent.length === 0) return { count: 0, hours: 0, photos: 0 };

  const { count: photos } = await supabase
    .from("update_media")
    .select("id", { count: "exact", head: true })
    .eq("kind", "image")
    .in(
      "update_id",
      recent.map((u) => u.id),
    );

  return {
    count: recent.length,
    hours: recent.reduce((total, u) => total + Number(u.hours_worked ?? 0), 0),
    photos: photos ?? 0,
  };
}

/* ------------------------------------------------------------------- photos */

/** The fields of an update a photograph needs for its caption and date. */
export type PhotoUpdate = Pick<Update, "id" | "title" | "published_at" | "milestone_id">;

export interface PhotoPage {
  media: UpdateMedia[];
  /** The updates these photographs belong to. */
  updates: PhotoUpdate[];
  nextCursor: string | null;
}

const createdAt = (m: UpdateMedia) => m.created_at;
const PHOTO_UPDATE_COLUMNS = "id, title, published_at, milestone_id";

/** Photographs, newest first. */
export async function getPhotos(slug: string | undefined, window: Window): Promise<PhotoPage> {
  const source = await projectSource(slug);

  if (source.kind === "demo") {
    const images = source.data.media.filter((m) => m.kind === "image");
    const { items, nextCursor } = demoWindow(images, createdAt, window);
    const ids = new Set(items.map((m) => m.update_id));
    return {
      media: items,
      updates: source.data.updates.filter((u) => ids.has(u.id)),
      nextCursor,
    };
  }

  const supabase = await createClient();
  if (source.kind === "empty" || !supabase) return { media: [], updates: [], nextCursor: null };

  let query = supabase
    .from("update_media")
    .select("*")
    .eq("project_id", source.project.id)
    .eq("kind", "image")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(window.limit + 1);
  const cursor = decodeCursor(window.before);
  if (cursor) query = query.or(keysetFilter("created_at", cursor));

  const { data } = await query;
  const { items, nextCursor } = pageOf((data ?? []) as UpdateMedia[], createdAt, window.limit);

  return { media: items, updates: await photoUpdates(items), nextCursor };
}

async function photoUpdates(media: UpdateMedia[]): Promise<PhotoUpdate[]> {
  const ids = [...new Set(media.map((m) => m.update_id))];
  const supabase = await createClient();
  if (!supabase || ids.length === 0) return [];
  const { data } = await supabase.from("updates").select(PHOTO_UPDATE_COLUMNS).in("id", ids);
  return (data ?? []) as PhotoUpdate[];
}

export interface PhotoSummary {
  total: number;
  /** The first photograph taken, for the then-and-now comparison. */
  oldest: { media: UpdateMedia; update: PhotoUpdate | null } | null;
}

/** How many photographs there are, and the first of them. */
export async function getPhotoSummary(slug: string | undefined): Promise<PhotoSummary> {
  const source = await projectSource(slug);

  if (source.kind === "demo") {
    const images = source.data.media
      .filter((m) => m.kind === "image")
      .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
    const first = images[0];
    return {
      total: images.length,
      oldest: first
        ? {
            media: first,
            update: source.data.updates.find((u) => u.id === first.update_id) ?? null,
          }
        : null,
    };
  }

  const supabase = await createClient();
  if (source.kind === "empty" || !supabase) return { total: 0, oldest: null };

  const [{ count }, { data: first }] = await Promise.all([
    supabase
      .from("update_media")
      .select("id", { count: "exact", head: true })
      .eq("project_id", source.project.id)
      .eq("kind", "image"),
    supabase
      .from("update_media")
      .select("*")
      .eq("project_id", source.project.id)
      .eq("kind", "image")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(1),
  ]);

  const oldest = (first?.[0] as UpdateMedia | undefined) ?? null;
  if (!oldest) return { total: count ?? 0, oldest: null };
  const [update] = await photoUpdates([oldest]);
  return { total: count ?? 0, oldest: { media: oldest, update: update ?? null } };
}

/* -------------------------------------------------------------- discussions */

export interface ThreadPage {
  discussions: Discussion[];
  /** Every message in exactly these threads, oldest first. */
  messages: DiscussionMessage[];
  nextCursor: string | null;
}

const lastMessageAt = (d: Discussion) => d.last_message_at;

/** Question threads, most recently active first, with their messages. */
export async function getThreads(slug: string | undefined, window: Window): Promise<ThreadPage> {
  const source = await projectSource(slug);

  if (source.kind === "demo") {
    const { items, nextCursor } = demoWindow(source.data.discussions, lastMessageAt, window);
    const ids = new Set(items.map((d) => d.id));
    const messages = source.data.discussionMessages
      .filter((m) => ids.has(m.discussion_id))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    return { discussions: items, messages, nextCursor };
  }

  const supabase = await createClient();
  if (source.kind === "empty" || !supabase) {
    return { discussions: [], messages: [], nextCursor: null };
  }

  let query = supabase
    .from("discussions")
    .select("*")
    .eq("project_id", source.project.id)
    .order("last_message_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(window.limit + 1);
  const cursor = decodeCursor(window.before);
  if (cursor) query = query.or(keysetFilter("last_message_at", cursor));

  const { data } = await query;
  const { items, nextCursor } = pageOf((data ?? []) as Discussion[], lastMessageAt, window.limit);
  if (items.length === 0) return { discussions: [], messages: [], nextCursor: null };

  const { data: messages } = await supabase
    .from("discussion_messages")
    .select("*")
    .in(
      "discussion_id",
      items.map((d) => d.id),
    )
    .order("created_at");

  return { discussions: items, messages: (messages ?? []) as DiscussionMessage[], nextCursor };
}

/** Messages posted after an instant, newest first -- the "since you last looked" window. */
export async function getMessagesSince(
  slug: string | undefined,
  since: string,
  limit: number = 200,
): Promise<DiscussionMessage[]> {
  const source = await projectSource(slug);

  if (source.kind === "demo") {
    return source.data.discussionMessages
      .filter((m) => m.created_at > since)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  }

  const supabase = await createClient();
  if (source.kind === "empty" || !supabase) return [];

  const { data } = await supabase
    .from("discussion_messages")
    .select("*")
    .eq("project_id", source.project.id)
    .gt("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as DiscussionMessage[];
}
