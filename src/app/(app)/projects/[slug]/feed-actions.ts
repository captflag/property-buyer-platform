"use server";

import { z } from "zod";

import { getPhotos, getUpdates, isCursor, PAGE_SIZE, type UpdatePage } from "@/lib/data/feeds";
import { getWorkspace } from "@/lib/data/workspace";
import { logError } from "@/lib/log";

import type { GalleryPhoto } from "./gallery/gallery-view";
import { toGalleryPhotos } from "./gallery/photos";

/**
 * "Load older" for the paged feeds.
 *
 * The slug and cursor come from the browser, so both are checked before use,
 * and the read runs under the caller's own session: RLS, not these checks,
 * decides whose updates can come back.
 */

const input = z.object({
  slug: z.string().min(1).max(200),
  cursor: z.string().min(1).max(200).refine(isCursor),
});

export async function loadOlderUpdates(slug: string, cursor: string): Promise<UpdatePage | null> {
  const parsed = input.safeParse({ slug, cursor });
  if (!parsed.success) return null;

  try {
    return await getUpdates(parsed.data.slug, {
      limit: PAGE_SIZE.updates,
      before: parsed.data.cursor,
      media: true,
    });
  } catch (error) {
    logError("load_older_updates_failed", error);
    return null;
  }
}

export async function loadOlderPhotos(
  slug: string,
  cursor: string,
): Promise<{ photos: GalleryPhoto[]; nextCursor: string | null } | null> {
  const parsed = input.safeParse({ slug, cursor });
  if (!parsed.success) return null;

  try {
    const [w, page] = await Promise.all([
      getWorkspace(parsed.data.slug, ["phases", "milestones"]),
      getPhotos(parsed.data.slug, { limit: PAGE_SIZE.photos, before: parsed.data.cursor }),
    ]);
    return { photos: toGalleryPhotos(page, w), nextCursor: page.nextCursor };
  } catch (error) {
    logError("load_older_photos_failed", error);
    return null;
  }
}
