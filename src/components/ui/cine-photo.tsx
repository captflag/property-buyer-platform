/* eslint-disable @next/next/no-img-element -- Unsplash serves its own resized,
   format-negotiated renditions through srcSet. Routing them through the Next
   image optimiser as well would do the work twice and widen the remote hosts
   the optimiser will proxy, which is deliberately limited to Supabase. */
import * as React from "react";

import { SCENES, sceneSrc, sceneSrcSet, type SceneKey } from "@/lib/scenes";
import { cn } from "@/lib/utils";

/**
 * A cinematic scene photograph. No "use client": it renders the same on the
 * server and in client components, so page bands and heroes can use it freely.
 */
export function CinePhoto({
  scene,
  sizes = "100vw",
  priority = false,
  alt,
  className,
}: {
  scene: SceneKey;
  sizes?: string;
  /** Above the fold: load eagerly and at high priority. */
  priority?: boolean;
  /** Override the scene's own description. Pass "" when purely decorative. */
  alt?: string;
  className?: string;
}) {
  const s: { id: string; alt: string; focus?: string } = SCENES[scene];

  return (
    <img
      src={sceneSrc(scene, 1600)}
      srcSet={sceneSrcSet(scene)}
      sizes={sizes}
      alt={alt ?? s.alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      className={cn("ui-photo-cine object-cover", className)}
      style={s.focus ? { objectPosition: s.focus } : undefined}
    />
  );
}
