/**
 * Media URL resolution.
 *
 * In demo mode there is no storage bucket, so a storage path is mapped
 * deterministically onto one of the bundled site photographs. The mapping is a
 * hash of the path rather than an index, so the same update always shows the
 * same picture across renders and reloads -- a gallery that reshuffles itself
 * on every navigation looks broken.
 *
 * With Supabase configured, `signMediaUrl` mints a short-lived signed URL
 * instead. The buckets are private, so a path on its own grants nothing.
 */

const SITE_PHOTOS = [
  "/site/modern_villa_construction.png",
  "/site/foundation_work.png",
  "/site/framing_progress.png",
  "/site/roofing_work.png",
  "/site/interior_construction.png",
  "/site/construction_progress.png",
  "/site/dashboard_hero.png",
] as const;

export const HERO_PHOTO = "/site/dashboard_hero.png";

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** A stable demo photograph for a storage path. */
export function demoPhotoFor(storagePath: string): string {
  return SITE_PHOTOS[hash(storagePath) % SITE_PHOTOS.length]!;
}

/**
 * Resolve a stored media path to something an `<img>` can load.
 * Demo paths map to bundled photos; real paths need `signMediaUrl` on the
 * server, so this returns the path unchanged and callers substitute the URL.
 */
export function resolveMediaUrl(storagePath: string, isDemo: boolean): string {
  return isDemo ? demoPhotoFor(storagePath) : storagePath;
}
