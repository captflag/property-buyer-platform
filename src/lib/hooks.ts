"use client";

import * as React from "react";

/**
 * Shared client hooks.
 *
 * Everything animated in this file is gated on the user's motion preference,
 * and gated the same way: the hook returns the final value immediately rather
 * than running a shorter animation. A "reduced" animation is still an
 * animation, and the setting means "don't".
 */

/**
 * True when the user has asked for reduced motion.
 *
 * `useSyncExternalStore` rather than an effect + setState: it has separate
 * server and client snapshots by design, so there is no flash of the animated
 * state before the preference is read, and no extra render pass.
 */
export function usePrefersReducedMotion(): boolean {
  const subscribe = React.useCallback((onChange: () => void) => {
    if (typeof window === "undefined") return () => {};
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    // Assume reduced on the server. Erring this way means a user who wants
    // stillness never sees a frame of movement during hydration.
    () => true,
  );
}

/** True once mounted on the client. */
export function useMounted(): boolean {
  return React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/**
 * Count a number up to its target on mount.
 *
 * Uses requestAnimationFrame with an eased curve rather than a fixed step, so
 * the duration is honest regardless of frame rate. Returns the target value
 * immediately under reduced motion, or when the value changes after mount --
 * re-animating on every data update would be distracting rather than
 * delightful.
 */
export function useCountUp(
  target: number,
  options: { durationMs?: number; decimals?: number } = {},
): number {
  const { durationMs = 900, decimals = 0 } = options;
  const reduced = usePrefersReducedMotion();

  // Initialised to the target, not to zero. The server renders the final
  // figure, so the first client render must match it or every stat tile
  // becomes a hydration mismatch. The animation then runs from zero after
  // hydration, which is the only point at which it could be seen anyway.
  const [value, setValue] = React.useState(target);
  const hasAnimated = React.useRef(false);

  // If the figure changes after mount -- fresh data, a filter -- show the new
  // one immediately rather than re-animating. Adjusted during render, which
  // avoids the extra pass an effect would cost.
  const [seenTarget, setSeenTarget] = React.useState(target);
  if (seenTarget !== target) {
    setSeenTarget(target);
    setValue(target);
  }

  React.useEffect(() => {
    // Nothing to do when motion is reduced: state already holds the target.
    if (reduced || hasAnimated.current) return;

    hasAnimated.current = true;
    let frame = 0;
    const start = performance.now();
    const factor = 10 ** decimals;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic: quick off the mark, settling gently on the final figure.
      const eased = 1 - (1 - t) ** 3;
      setValue(Math.round(target * eased * factor) / factor);
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs, decimals, reduced]);

  return value;
}

/**
 * Report when an element first scrolls into view.
 *
 * This gates an *animation*, never visibility. The distinction matters: if the
 * observer never fires -- no IntersectionObserver, a hidden or occluded
 * container, a headless renderer -- the content is still fully rendered and
 * merely un-animated, which is the correct way for a decorative enhancement to
 * fail. Gating visibility on an observer is how charts end up permanently
 * blank in exactly the environments hardest to debug.
 *
 * Fires once. A chart that redraws itself every time it scrolls past is an
 * irritation rather than an effect.
 */
export function useInView<T extends Element>(options: { rootMargin?: string } = {}) {
  const { rootMargin = "0px 0px -10% 0px" } = options;
  const ref = React.useRef<T>(null);
  const [hasEntered, setHasEntered] = React.useState(false);

  React.useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setHasEntered(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [rootMargin]);

  return { ref, hasEntered };
}

/** Matches a media query reactively. */
export function useMediaQuery(query: string): boolean {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined") return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );

  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Locks body scroll while active -- for full-screen overlays. */
export function useScrollLock(active: boolean): void {
  React.useEffect(() => {
    if (!active) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [active]);
}

/**
 * Track an element's rendered width.
 *
 * Needed wherever geometry has to be computed in pixels rather than
 * percentages -- dependency arrows on the Gantt, for instance, where a
 * percentage-based SVG would scale the stroke non-uniformly and produce
 * wedge-shaped lines.
 *
 * Returns 0 until measured, and callers are expected to skip drawing at 0
 * rather than guess.
 */
export function useElementWidth<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);
  const [width, setWidth] = React.useState(0);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (typeof ResizeObserver === "undefined") {
      setWidth(element.getBoundingClientRect().width);
      return;
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });

    observer.observe(element);
    setWidth(element.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}
