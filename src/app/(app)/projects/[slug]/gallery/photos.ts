import "server-only";

import type { PhotoPage, PhotoUpdate } from "@/lib/data/feeds";
import type { Workspace } from "@/lib/data/workspace";
import { resolveMediaUrl } from "@/lib/media";
import type { UpdateMedia } from "@/types/database";

import type { GalleryPhoto } from "./gallery-view";

type PhotoContext = Workspace<"phases" | "milestones">;

/** One photograph, captioned and filed under the phase its update belongs to. */
export function toGalleryPhoto(
  media: UpdateMedia,
  update: PhotoUpdate | null | undefined,
  w: PhotoContext,
): GalleryPhoto {
  const milestone = update?.milestone_id
    ? w.milestones.find((m) => m.id === update.milestone_id)
    : undefined;
  const phase = milestone?.phase_id ? w.phases.find((p) => p.id === milestone.phase_id) : undefined;

  return {
    id: media.id,
    src: resolveMediaUrl(media.storage_path, w.isDemo),
    alt: media.caption ?? `Site photograph: ${update?.title ?? "progress"}`,
    caption: media.caption ?? update?.title ?? "Site photograph",
    takenAt: update?.published_at ?? media.created_at,
    phaseId: phase?.id ?? null,
    phaseName: phase?.name ?? "General",
  };
}

/** A page of photographs, newest first. */
export function toGalleryPhotos(
  page: Pick<PhotoPage, "media" | "updates">,
  w: PhotoContext,
): GalleryPhoto[] {
  const updateById = new Map(page.updates.map((u) => [u.id, u]));
  return page.media
    .map((media) => toGalleryPhoto(media, updateById.get(media.update_id), w))
    .sort((a, b) => (a.takenAt > b.takenAt ? -1 : 1));
}
