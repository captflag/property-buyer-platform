"use client";

import * as React from "react";

/**
 * Sticky jump-nav for the theme panels.
 *
 * Uses IntersectionObserver rather than scroll maths so the active state stays
 * correct however the reader arrives at a panel -- scrolling, an anchor link,
 * or the browser restoring a position on reload.
 */
export interface NavGroup {
  title: string;
  themes: Array<{ id: string; name: string }>;
}

export function LabNav({ groups }: { groups: NavGroup[] }) {
  const themes = React.useMemo(() => groups.flatMap((g) => g.themes), [groups]);
  const [active, setActive] = React.useState(themes[0]?.id ?? "");

  React.useEffect(() => {
    const sections = themes
      .map((t) => document.getElementById(t.id))
      .filter((el): el is HTMLElement => el !== null);

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // The panel occupying the most of the viewport wins, so a short panel
        // scrolling past a tall one does not steal the highlight.
        const best = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (best) setActive(best.target.id);
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.15, 0.4, 0.75] },
    );

    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [themes]);

  return (
    <nav
      aria-label="Jump to a theme"
      className="bg-surface/95 border-line sticky top-0 z-40 border-b backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-5 py-2.5 sm:px-8">
        {groups.map((group) => (
          <React.Fragment key={group.title}>
            <span className="text-ink-3 text-[10px] font-semibold tracking-wider uppercase">
              {group.title}
            </span>
            {group.themes.map((theme) => (
              <a
                key={theme.id}
                href={`#${theme.id}`}
                aria-current={active === theme.id ? "true" : undefined}
                className="lab-nav-btn"
              >
                {theme.name}
              </a>
            ))}
          </React.Fragment>
        ))}
      </div>
    </nav>
  );
}
