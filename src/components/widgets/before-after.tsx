"use client";

import Image from "next/image";
import * as React from "react";

import { formatDate } from "@/lib/format";
import { clamp, cn } from "@/lib/utils";

/**
 * Before / after comparison slider.
 *
 * Two photographs of the same viewpoint at different dates, with a draggable
 * divider. This is the single most convincing way to show a month of progress
 * on a building -- far more than a percentage.
 *
 * It is a real `role="slider"` rather than a div with a mousedown handler, so
 * the divider is operable with arrow keys, has a stated range, and announces
 * its position. Pointer events (not mouse events) so it works with touch and
 * pen without a second code path.
 */
export function BeforeAfter({
  before,
  after,
  beforeLabel,
  afterLabel,
  className,
}: {
  before: { src: string; alt: string; date?: string | null };
  after: { src: string; alt: string; date?: string | null };
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
}) {
  const [position, setPosition] = React.useState(50);
  const [dragging, setDragging] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const updateFromPointer = React.useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    setPosition(clamp(((clientX - rect.left) / rect.width) * 100, 0, 100));
  }, []);

  const onPointerDown = (event: React.PointerEvent) => {
    // Capture on the container so the drag survives the pointer leaving the
    // element -- without this, a fast drag detaches and the divider sticks.
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    updateFromPointer(event.clientX);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!dragging) return;
    updateFromPointer(event.clientX);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const step = event.shiftKey ? 10 : 2;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setPosition((p) => clamp(p - step, 0, 100));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setPosition((p) => clamp(p + step, 0, 100));
    } else if (event.key === "Home") {
      event.preventDefault();
      setPosition(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setPosition(100);
    }
  };

  return (
    <figure className={cn("m-0 flex flex-col gap-2", className)}>
      <div
        ref={containerRef}
        className="border-line relative aspect-[16/10] w-full touch-none overflow-hidden border select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
        {/* After sits underneath, fully visible */}
        <Image src={after.src} alt={after.alt} fill sizes="100vw" className="object-cover" />

        {/* Before is clipped to the divider */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        >
          <Image src={before.src} alt={before.alt} fill sizes="100vw" className="object-cover" />
        </div>

        {/* Corner labels */}
        <span className="ui-label bg-ink/80 absolute top-2 left-2 px-1.5 py-0.5 text-[9px] text-white">
          {beforeLabel ?? "Before"}
          {before.date ? ` · ${formatDate(before.date, "short")}` : ""}
        </span>
        <span className="ui-label bg-ink/80 absolute top-2 right-2 px-1.5 py-0.5 text-[9px] text-white">
          {afterLabel ?? "After"}
          {after.date ? ` · ${formatDate(after.date, "short")}` : ""}
        </span>

        {/* Divider */}
        <div
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-white"
          style={{ left: `${position}%` }}
        />

        <div
          role="slider"
          tabIndex={0}
          aria-label="Reveal the earlier photograph"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(position)}
          aria-valuetext={`${Math.round(position)}% showing the earlier photograph`}
          onKeyDown={onKeyDown}
          className={cn(
            "absolute top-1/2 grid size-9 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize place-items-center",
            "border-2 border-white bg-white/20 backdrop-blur-sm",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
          )}
          style={{ left: `${position}%` }}
        >
          <span aria-hidden="true" className="text-[13px] leading-none font-bold text-white">
            ‹›
          </span>
        </div>
      </div>

      <figcaption className="text-ink-3 text-[11px]">
        Drag the divider, or focus it and use the arrow keys, to compare the two dates.
      </figcaption>
    </figure>
  );
}
