"use client";

import { Clock, Cloud, HardHat, Thermometer, Users } from "lucide-react";
import Image from "next/image";
import * as React from "react";

import { StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/misc";
import { formatDateTime, formatRelative } from "@/lib/format";
import { AskAboutLink } from "@/components/widgets/ask-about";
import { useLightbox, type LightboxImage } from "@/components/widgets/lightbox";
import { resolveMediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";
import type { Milestone, Profile, Update, UpdateMedia } from "@/types/database";

/**
 * One construction update.
 *
 * The site-conditions row (crew, hours, weather, temperature) is the part that
 * makes an update feel like a record rather than a marketing post. It is also
 * what lets a buyer connect "three people on site for 21 hours" with a week
 * where little visibly changed.
 */
export function UpdateCard({
  update,
  media,
  author,
  milestone,
  now,
  isDemo,
  slug,
  className,
}: {
  update: Update;
  media: UpdateMedia[];
  author: Profile | undefined;
  milestone: Milestone | undefined;
  now: Date;
  isDemo: boolean;
  /** When given, the card offers "Ask about this" for the update. */
  slug?: string;
  className?: string;
}) {
  const photos = media.filter((m) => m.kind === "image");

  return (
    <Card id={update.id} className={cn("overflow-hidden", className)} interactive>
      <article>
        <div className="flex flex-col gap-3 py-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge kind="work" value={update.status} />
            {milestone ? (
              <span className="text-ink-3 text-[11px]">
                <span className="sr-only">Milestone: </span>
                {milestone.name}
              </span>
            ) : null}
            <time
              dateTime={update.published_at}
              className="text-ink-3 ml-auto text-[11px]"
              title={formatDateTime(update.published_at)}
            >
              {formatRelative(update.published_at, now)}
            </time>
          </div>

          <h3 className="text-ink text-[15px] leading-snug font-semibold tracking-[-0.01em]">
            {update.title}
          </h3>

          <p className="text-ink-2 text-[13px] leading-relaxed">{update.body}</p>

          {photos.length > 0 ? (
            <PhotoGrid
              photos={photos}
              title={update.title}
              isDemo={isDemo}
              takenAt={update.published_at}
            />
          ) : null}
        </div>

        <div className="border-line flex flex-wrap items-center gap-x-4 gap-y-2 border-t py-3">
          <span className="flex items-center gap-1.5">
            <Avatar name={author?.full_name} size="xs" />
            <span className="text-ink-2 text-[11px] font-medium">
              {author?.full_name ?? "Site team"}
            </span>
          </span>

          <span className="bg-line h-3 w-px" aria-hidden="true" />

          {update.crew_size != null ? (
            <Metric icon={Users} label="Crew" value={`${update.crew_size}`} />
          ) : null}
          {update.hours_worked != null ? (
            <Metric icon={Clock} label="Hours worked" value={`${update.hours_worked}h`} />
          ) : null}
          {update.weather ? <Metric icon={Cloud} label="Weather" value={update.weather} /> : null}
          {update.temperature_c != null ? (
            <Metric icon={Thermometer} label="Temperature" value={`${update.temperature_c}°C`} />
          ) : null}
          {update.progress_delta != null ? (
            <Metric
              icon={HardHat}
              label="Progress added"
              value={`+${update.progress_delta}%`}
              tone="good"
            />
          ) : null}
          {slug ? (
            <AskAboutLink slug={slug} kind="update" id={update.id} className="ml-auto" />
          ) : null}
        </div>
      </article>
    </Card>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: typeof Users;
  label: string;
  value: string;
  tone?: "default" | "good";
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-1 text-[11px]",
        tone === "good" ? "text-good-ink font-medium" : "text-ink-3",
      )}
    >
      <Icon className="size-3" strokeWidth={2} aria-hidden="true" />
      <span className="sr-only">{label}: </span>
      {value}
    </span>
  );
}

/**
 * Photo grid.
 *
 * Opens the shared lightbox rather than a per-photo dialog, so arrow keys move
 * between every photograph on the update instead of trapping the reader in one
 * of them.
 */
function PhotoGrid({
  photos,
  title,
  isDemo,
  takenAt,
}: {
  photos: UpdateMedia[];
  title: string;
  isDemo: boolean;
  takenAt: string;
}) {
  const images: LightboxImage[] = React.useMemo(
    () =>
      photos.map((photo, index) => ({
        id: photo.id,
        src: resolveMediaUrl(photo.storage_path, isDemo),
        alt: photo.caption ?? `Site photograph ${index + 1} for: ${title}`,
        caption: photo.caption ?? title,
        takenAt,
      })),
    [photos, isDemo, title, takenAt],
  );

  const lightbox = useLightbox(images);

  return (
    <>
      <ul
        className={cn(
          "mt-1 grid gap-1.5",
          photos.length === 1 ? "grid-cols-1" : photos.length === 2 ? "grid-cols-2" : "grid-cols-3",
        )}
      >
        {images.map((image, index) => (
          <li key={image.id}>
            <button
              type="button"
              onClick={() => lightbox.open(index)}
              className={cn(
                "group bg-surface-3 border-line relative block w-full overflow-hidden border",
                photos.length === 1 ? "aspect-[16/9]" : "aspect-[4/3]",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2",
              )}
            >
              <Image
                src={image.src}
                alt={image.alt}
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
              <span className="sr-only">Open photograph {index + 1} in the viewer</span>
            </button>
          </li>
        ))}
      </ul>

      {lightbox.element}
    </>
  );
}
