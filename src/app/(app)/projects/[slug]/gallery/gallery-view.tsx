"use client";

import Image from "next/image";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle, CardToolbar } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { BeforeAfter } from "@/components/widgets/before-after";
import { useLightbox, type LightboxImage } from "@/components/widgets/lightbox";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

import { loadOlderPhotos } from "../feed-actions";

export interface GalleryPhoto {
  id: string;
  src: string;
  alt: string;
  caption: string;
  takenAt: string;
  phaseId: string | null;
  phaseName: string;
}

/**
 * Every photograph taken on the project, filterable by phase.
 *
 * Photographs are the one thing a buyer will look at without being prompted,
 * and until now they were buried one update at a time. Collecting them and
 * ordering them by date turns the feed into a record of the build.
 *
 * They arrive a page at a time, newest first. The phase filter and the
 * lightbox work over the pages loaded so far, and the running count says how
 * many that is out of the whole set -- so a filter showing three photographs
 * never reads as "only three exist".
 */
export function GalleryView({
  photos: initialPhotos,
  total,
  nextCursor: initialCursor,
  phases,
  comparison,
  slug,
}: {
  photos: GalleryPhoto[];
  /** Every photograph on the project, loaded or not. */
  total: number;
  nextCursor: string | null;
  /** The project's phases, in programme order. */
  phases: Array<{ id: string; name: string }>;
  comparison: { before: GalleryPhoto; after: GalleryPhoto } | null;
  slug: string;
}) {
  const [photos, setPhotos] = React.useState(initialPhotos);
  const [cursor, setCursor] = React.useState(initialCursor);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [isLoading, startLoading] = React.useTransition();
  const [phaseId, setPhaseId] = React.useState<string | "all">("all");

  // A fresh server render replaces whatever was paged in on top of the last one.
  const [seenServerPhotos, setSeenServerPhotos] = React.useState(initialPhotos);
  if (seenServerPhotos !== initialPhotos) {
    setSeenServerPhotos(initialPhotos);
    setPhotos(initialPhotos);
    setCursor(initialCursor);
  }

  const loadOlder = () => {
    if (!cursor) return;
    setLoadError(null);
    startLoading(async () => {
      const page = await loadOlderPhotos(slug, cursor);
      if (!page) {
        setLoadError("Older photographs could not be loaded. Try again.");
        return;
      }
      setPhotos((current) => {
        const seen = new Set(current.map((p) => p.id));
        return [...current, ...page.photos.filter((p) => !seen.has(p.id))];
      });
      setCursor(page.nextCursor);
    });
  };

  const phaseCounts = React.useMemo(
    () =>
      phases
        .map((phase) => ({
          ...phase,
          count: photos.filter((p) => p.phaseId === phase.id).length,
        }))
        .filter((phase) => phase.count > 0),
    [phases, photos],
  );

  const visible = React.useMemo(
    () => (phaseId === "all" ? photos : photos.filter((p) => p.phaseId === phaseId)),
    [photos, phaseId],
  );

  const images: LightboxImage[] = React.useMemo(
    () =>
      visible.map((photo) => ({
        id: photo.id,
        src: photo.src,
        alt: photo.alt,
        caption: photo.caption,
        takenAt: photo.takenAt,
      })),
    [visible],
  );

  const lightbox = useLightbox(images);

  // Group by month so the grid reads as a timeline rather than a pile.
  //
  // Each group carries the index its first photograph occupies in the flat
  // list. That is computed here rather than with a counter mutated while
  // rendering: the lightbox needs a stable index into `images`, and a
  // render-time counter is not one.
  const groups = React.useMemo(() => {
    const map = new Map<string, GalleryPhoto[]>();
    for (const photo of visible) {
      const month = photo.takenAt.slice(0, 7);
      const bucket = map.get(month) ?? [];
      bucket.push(photo);
      map.set(month, bucket);
    }

    const months = [...map.entries()].sort(([a], [b]) => (a > b ? -1 : 1));

    // Prefix sum without an accumulator captured by the callback. Quadratic in
    // the number of months, which is a handful -- clarity wins over the
    // constant factor here.
    return months.map(([month, items], index) => ({
      month,
      items,
      startIndex: months.slice(0, index).reduce((sum, [, group]) => sum + group.length, 0),
    }));
  }, [visible]);

  return (
    <div className="flex flex-col gap-6">
      {comparison ? (
        <Card>
          <CardToolbar>
            <div>
              <CardTitle as="h2">Then and now</CardTitle>
              <CardDescription>
                The same view, {formatDate(comparison.before.takenAt, "medium")} against{" "}
                {formatDate(comparison.after.takenAt, "medium")}
              </CardDescription>
            </div>
          </CardToolbar>
          <CardContent>
            <BeforeAfter
              before={{
                src: comparison.before.src,
                alt: comparison.before.alt,
                date: comparison.before.takenAt,
              }}
              after={{
                src: comparison.after.src,
                alt: comparison.after.alt,
                date: comparison.after.takenAt,
              }}
            />
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={phaseId === "all" ? "subtle" : "ghost"}
          size="sm"
          onClick={() => setPhaseId("all")}
          aria-pressed={phaseId === "all"}
        >
          All phases
          <span className="text-ink-3 ml-1 text-[11px]">{photos.length}</span>
        </Button>
        {phaseCounts.map((phase) => (
          <Button
            key={phase.id}
            variant={phaseId === phase.id ? "subtle" : "ghost"}
            size="sm"
            onClick={() => setPhaseId(phase.id)}
            aria-pressed={phaseId === phase.id}
          >
            {phase.name}
            <span className="text-ink-3 ml-1 text-[11px]">{phase.count}</span>
          </Button>
        ))}
      </div>

      <p aria-live="polite" className="text-ink-3 text-[12px]">
        {visible.length} photograph{visible.length === 1 ? "" : "s"}
        {cursor ? ` · ${photos.length} of ${total} loaded` : ""}
      </p>

      {visible.length === 0 ? (
        <EmptyState
          illustration="site"
          title="No photographs from this phase yet"
          description={
            cursor
              ? "None among the photographs loaded so far. Load older ones to look further back."
              : "Site adds photographs with each update. They will appear here as the work progresses."
          }
        />
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map(({ month, items, startIndex }) => {
            return (
              <section key={month} aria-labelledby={`month-${month}`}>
                <h3
                  id={`month-${month}`}
                  className="ui-label text-ink-3 border-line mb-3 border-b pb-1.5 text-[10px]"
                >
                  {formatDate(`${month}-01`, "medium")}
                </h3>

                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {items.map((photo, i) => (
                    <li key={photo.id}>
                      <button
                        type="button"
                        onClick={() => lightbox.open(startIndex + i)}
                        className={cn(
                          "group bg-surface-3 border-line relative block aspect-[4/3] w-full overflow-hidden border",
                          "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2",
                        )}
                      >
                        <Image
                          src={photo.src}
                          alt={photo.alt}
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                        />
                        <span className="bg-ink/75 absolute inset-x-0 bottom-0 truncate px-2 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                          {photo.phaseName}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {cursor ? (
        <div className="flex flex-col items-center gap-2">
          <Button variant="secondary" onClick={loadOlder} disabled={isLoading}>
            {isLoading ? "Loading…" : "Load older photographs"}
          </Button>
          {loadError ? (
            <p role="alert" className="text-critical-ink text-[12px]">
              {loadError}
            </p>
          ) : null}
        </div>
      ) : null}

      {lightbox.element}
    </div>
  );
}
