"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Image from "next/image";
import * as React from "react";

import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Full-screen photograph viewer.
 *
 * Built on a native dialog rather than Radix here because it needs the whole
 * viewport, its own key handling, and a backdrop that is part of the design
 * rather than a scrim over a card.
 *
 * The keyboard contract is the point of it:
 *   Left / Right   previous / next
 *   Home / End     first / last
 *   Escape         close
 * Focus is trapped inside while open, and returns to the trigger on close.
 * A gallery you can only operate with a mouse is not a gallery, it is a
 * screenshot.
 */

export interface LightboxImage {
  id: string;
  src: string;
  alt: string;
  caption?: string | null;
  takenAt?: string | null;
}

export function Lightbox({
  images,
  index,
  onIndexChange,
  onClose,
}: {
  images: LightboxImage[];
  index: number;
  onIndexChange: (next: number) => void;
  onClose: () => void;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);

  const count = images.length;
  const current = images[index];

  const go = React.useCallback(
    (delta: number) => {
      if (count === 0) return;
      // Wrap rather than stop: at the last photo, "next" returning to the
      // first is less surprising than a dead key.
      onIndexChange((index + delta + count) % count);
    },
    [index, count, onIndexChange],
  );

  React.useEffect(() => {
    closeRef.current?.focus();
  }, []);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case "Escape":
          event.preventDefault();
          onClose();
          break;
        case "ArrowRight":
          event.preventDefault();
          go(1);
          break;
        case "ArrowLeft":
          event.preventDefault();
          go(-1);
          break;
        case "Home":
          event.preventDefault();
          onIndexChange(0);
          break;
        case "End":
          event.preventDefault();
          onIndexChange(count - 1);
          break;
        case "Tab": {
          // Manual focus trap: the dialog is not a Radix primitive, so the
          // cycle has to be closed by hand or Tab escapes to the page behind.
          const focusable = containerRef.current?.querySelectorAll<HTMLElement>(
            'button, [href], [tabindex]:not([tabindex="-1"])',
          );
          if (!focusable || focusable.length === 0) return;
          const first = focusable[0]!;
          const last = focusable[focusable.length - 1]!;
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
          break;
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [go, onClose, onIndexChange, count]);

  // Lock the page behind so the backdrop does not scroll under the photo.
  React.useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  if (!current) return null;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Photograph ${index + 1} of ${count}`}
      className="fixed inset-0 z-[90] flex flex-col bg-[color-mix(in_oklab,var(--ink)_94%,transparent)]"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
        <p className="ui-label text-[10px] text-white/70">
          {index + 1} / {count}
        </p>
        {current.takenAt ? (
          <p className="text-[12px] text-white/60">{formatDate(current.takenAt, "long")}</p>
        ) : null}

        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="ml-auto p-2 text-white/70 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          aria-label="Close viewer"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* Stage */}
      <div className="relative min-h-0 flex-1">
        <Image
          key={current.id}
          src={current.src}
          alt={current.alt}
          fill
          sizes="100vw"
          priority
          className="object-contain"
        />

        {count > 1 ? (
          <>
            <NavButton side="left" onClick={() => go(-1)} />
            <NavButton side="right" onClick={() => go(1)} />
          </>
        ) : null}
      </div>

      {/* Caption + thumbnails */}
      <div className="flex flex-col gap-3 px-4 py-4 sm:px-6">
        {current.caption ? (
          <p className="mx-auto max-w-2xl text-center text-[13px] leading-relaxed text-white/80">
            {current.caption}
          </p>
        ) : null}

        {count > 1 ? (
          <div className="flex scrollbar-thin justify-center gap-2 overflow-x-auto pb-1">
            {images.map((image, i) => (
              <button
                key={image.id}
                type="button"
                onClick={() => onIndexChange(i)}
                aria-label={`Show photograph ${i + 1}`}
                aria-current={i === index ? "true" : undefined}
                className={cn(
                  "relative size-14 shrink-0 overflow-hidden transition-opacity",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-white",
                  i === index ? "opacity-100 ring-2 ring-white" : "opacity-45 hover:opacity-80",
                )}
              >
                <Image src={image.src} alt="" fill sizes="56px" className="object-cover" />
              </button>
            ))}
          </div>
        ) : null}

        <p className="text-center text-[10px] text-white/40">Arrow keys to move · Esc to close</p>
      </div>
    </div>
  );
}

function NavButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous photograph" : "Next photograph"}
      className={cn(
        "absolute top-1/2 -translate-y-1/2 p-3 text-white/60 transition-colors hover:text-white",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-white",
        side === "left" ? "left-1 sm:left-4" : "right-1 sm:right-4",
      )}
    >
      <Icon className="size-7" strokeWidth={1.5} />
    </button>
  );
}

/**
 * Manages lightbox open/index state for a set of images.
 * Kept as a hook so a page can open the viewer from a grid, a carousel or a
 * table row without duplicating the plumbing.
 */
export function useLightbox(images: LightboxImage[]) {
  const [index, setIndex] = React.useState<number | null>(null);

  const open = React.useCallback((at: number) => setIndex(at), []);
  const close = React.useCallback(() => setIndex(null), []);

  const element =
    index === null ? null : (
      <Lightbox images={images} index={index} onIndexChange={setIndex} onClose={close} />
    );

  return { open, close, element, isOpen: index !== null };
}
