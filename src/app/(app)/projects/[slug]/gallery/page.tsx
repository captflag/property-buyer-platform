import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/app-shell";
import { getPhotos, getPhotoSummary, PAGE_SIZE } from "@/lib/data/feeds";
import { getWorkspace } from "@/lib/data/workspace";

import { GalleryView } from "./gallery-view";
import { toGalleryPhoto, toGalleryPhotos } from "./photos";

export const metadata: Metadata = { title: "Photographs" };

export default async function GalleryPage({ params }: PageProps<"/projects/[slug]/gallery">) {
  const { slug } = await params;
  const [w, page, summary] = await Promise.all([
    getWorkspace(slug, ["phases", "milestones"]),
    getPhotos(slug, { limit: PAGE_SIZE.photos }),
    getPhotoSummary(slug),
  ]);

  const photos = toGalleryPhotos(page, w);

  // The first photograph ever taken against the latest makes the most
  // convincing comparison, and is the only pair guaranteed to exist without
  // curation. The first is fetched on its own, so the comparison does not
  // depend on how many pages have been loaded.
  const oldest = summary.oldest
    ? toGalleryPhoto(summary.oldest.media, summary.oldest.update, w)
    : null;
  const newest = photos[0];
  const comparison =
    oldest && newest && oldest.id !== newest.id ? { before: oldest, after: newest } : null;

  return (
    <>
      <PageHeader
        title="Photographs"
        description="Every photograph taken on site, newest first. Open one to page through them."
      />
      <GalleryView
        photos={photos}
        total={summary.total}
        nextCursor={page.nextCursor}
        phases={w.phases.map((phase) => ({ id: phase.id, name: phase.name }))}
        comparison={comparison}
        slug={slug}
      />
    </>
  );
}
