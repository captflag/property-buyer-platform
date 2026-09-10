"use client";

import { X } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * First-run tour.
 *
 * Points at four things a buyer would otherwise have to discover: where
 * progress lives, that the schedule shows float, that money is itemised, and
 * that the assistant answers from their own records.
 *
 * Three rules it follows that most tours do not:
 *   - It is skippable from the first frame, and Escape ends it.
 *   - It never blocks the page. The spotlight is `pointer-events: none`, so a
 *     reader who ignores it can still use the app underneath.
 *   - It runs once. Seen state is stored locally, and a failure to store it is
 *     treated as "already seen" rather than showing the tour on every visit --
 *     an unskippable tour is far worse than a missed one.
 */

interface Step {
  /** Matches a `data-tour` attribute in the page. */
  target: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    target: "progress",
    title: "Where your build stands",
    body: "The headline figure is milestone progress weighted by how much of the build each milestone represents — not a count of finished tasks. The number beneath it is where the programme expects you to be today.",
  },
  {
    target: "nav-timeline",
    title: "The schedule, with its slack",
    body: "Every milestone shows how many days it can slip before your completion date moves. Anything marked critical has none — a day lost there is a day lost on the whole build.",
  },
  {
    target: "nav-selections",
    title: "Decisions, with their deadlines",
    body: "Worktops, tiles, flooring and the rest each have a deadline tied to the work that needs them. Every open decision says what happens if it passes — usually the standard option is fitted.",
  },
  {
    target: "nav-finance",
    title: "Money, itemised",
    body: "Budget against what has been spent and what has been ordered but not yet invoiced. Committed orders count against the budget, because they are going to land.",
  },
  {
    target: "nav-assistant",
    title: "Ask about anything here",
    body: "The assistant answers from your project's own records and cites the entries it used. If it does not know something, it says so rather than guessing.",
  },
];

const STORAGE_KEY = "kestrel.tour.seen.v1";

function hasSeenTour(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // Private windows, blocked site data, embedded contexts. Treat storage
    // failure as "seen": showing an unskippable tour forever is the worse bug.
    return true;
  }
}

function markSeen(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Nothing to do -- the tour simply may reappear next visit.
  }
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function OnboardingTour() {
  const [active, setActive] = React.useState(false);
  const [step, setStep] = React.useState(0);
  const [rect, setRect] = React.useState<Rect | null>(null);

  // Start only after mount, and only on a wide viewport: the tour points at
  // sidebar items that are behind a drawer on a phone, where highlighting
  // something invisible would be nonsense.
  React.useEffect(() => {
    if (hasSeenTour()) return;
    if (window.matchMedia("(max-width: 1023px)").matches) return;

    const timer = setTimeout(() => setActive(true), 700);
    return () => clearTimeout(timer);
  }, []);

  const current = STEPS[step];

  // Track the target's position, including while the page scrolls or resizes.
  React.useEffect(() => {
    if (!active || !current) return;

    const measure = () => {
      const element = document.querySelector<HTMLElement>(`[data-tour="${current.target}"]`);
      if (!element) {
        setRect(null);
        return;
      }
      const box = element.getBoundingClientRect();
      setRect({ top: box.top, left: box.left, width: box.width, height: box.height });
    };

    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [active, current]);

  const finish = React.useCallback(() => {
    markSeen();
    setActive(false);
  }, []);

  React.useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
      if (event.key === "ArrowRight") setStep((s) => Math.min(s + 1, STEPS.length - 1));
      if (event.key === "ArrowLeft") setStep((s) => Math.max(s - 1, 0));
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [active, finish]);

  if (!active || !current) return null;

  const padding = 6;
  const spotlight = rect
    ? {
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      }
    : null;

  // Place the card beside the target where there is room, otherwise below it.
  const cardStyle: React.CSSProperties = spotlight
    ? spotlight.left + spotlight.width + 340 < window.innerWidth
      ? { top: spotlight.top, left: spotlight.left + spotlight.width + 14 }
      : { top: spotlight.top + spotlight.height + 14, left: Math.max(16, spotlight.left) }
    : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  return (
    <div className="pointer-events-none fixed inset-0 z-[95]">
      {/* Dimmer with a hole cut for the target. Four panels rather than a mask
          so it stays crisp at any zoom level. */}
      {spotlight ? (
        <>
          <Dim style={{ top: 0, left: 0, right: 0, height: Math.max(0, spotlight.top) }} />
          <Dim
            style={{
              top: spotlight.top + spotlight.height,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />
          <Dim
            style={{
              top: spotlight.top,
              left: 0,
              width: Math.max(0, spotlight.left),
              height: spotlight.height,
            }}
          />
          <Dim
            style={{
              top: spotlight.top,
              left: spotlight.left + spotlight.width,
              right: 0,
              height: spotlight.height,
            }}
          />
          <span aria-hidden="true" className="border-accent absolute border-2" style={spotlight} />
        </>
      ) : (
        <Dim style={{ inset: 0 }} />
      )}

      <div
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
        className={cn("ui-panel pointer-events-auto absolute w-[min(21rem,calc(100vw-2rem))] p-4")}
        style={cardStyle}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="ui-label text-ink-3 text-[9px]">
            Step {step + 1} of {STEPS.length}
          </p>
          <button
            type="button"
            onClick={finish}
            className="text-ink-3 hover:text-ink -mt-1 -mr-1 p-1"
            aria-label="Skip the tour"
          >
            <X className="size-3.5" />
          </button>
        </div>

        <h2 id="tour-title" className="ui-display text-ink mt-1.5 text-[16px]">
          {current.title}
        </h2>
        <p className="text-ink-2 mt-1.5 text-[13px] leading-relaxed">{current.body}</p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex gap-1" aria-hidden="true">
            {STEPS.map((s, i) => (
              <span key={s.target} className={cn("h-1 w-5", i === step ? "bg-brand" : "bg-line")} />
            ))}
          </div>

          <div className="flex gap-2">
            {step > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={finish}>
                Skip
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button variant="primary" size="sm" onClick={() => setStep((s) => s + 1)}>
                Next
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={finish}>
                Got it
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Dim({ style }: { style: React.CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      className="bg-overlay absolute transition-opacity duration-200"
      style={style}
    />
  );
}
