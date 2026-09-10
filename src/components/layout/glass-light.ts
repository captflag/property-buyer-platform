import * as React from "react";

/**
 * Dynamic light for glass surfaces.
 *
 * Tracks the pointer and writes its position, relative to whichever glass
 * surface it is over, into `--mx` / `--my` on that element. The stylesheet
 * turns those into a specular bloom and a brighter rim that follow the
 * pointer, so the glass reads as a material catching light rather than a
 * flat tint. At rest the variables fall back to a fixed light from above.
 *
 * One passive listener for the whole app, coalesced to one write per frame,
 * and nothing at all when the reader prefers reduced motion or is on touch,
 * where there is no hover to follow.
 */
export function useGlassLight(): void {
  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let pending: PointerEvent | null = null;
    let lit: HTMLElement | null = null;

    const apply = () => {
      frame = 0;
      const event = pending;
      if (!event) return;

      const target =
        event.target instanceof Element
          ? (event.target.closest(".ui-card, .ui-glass, .ui-glass-button") as HTMLElement | null)
          : null;

      if (lit && lit !== target) {
        lit.style.removeProperty("--mx");
        lit.style.removeProperty("--my");
      }
      lit = target;
      if (!target) return;

      const rect = target.getBoundingClientRect();
      target.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      target.style.setProperty("--my", `${event.clientY - rect.top}px`);
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      pending = event;
      if (!frame) frame = requestAnimationFrame(apply);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
}
