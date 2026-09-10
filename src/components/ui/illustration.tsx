import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Line illustrations for empty states.
 *
 * Drawn rather than downloaded, in the same drafting language as the rest of
 * the theme: hairline strokes, no fills beyond a wash, everything on a visible
 * measure. They are `aria-hidden` throughout -- the empty state's own text is
 * the accessible content, and a decorative drawing announcing itself would just
 * be noise to a screen reader.
 *
 * `currentColor` everywhere, so they inherit whatever ink the caller sets and
 * work unmodified in both themes.
 */

interface IllustrationProps {
  className?: string;
  /** Rendered size in pixels. */
  size?: number;
}

function Frame({
  children,
  className,
  size = 96,
  viewBox = "0 0 120 96",
}: IllustrationProps & { children: React.ReactNode; viewBox?: string }) {
  return (
    <svg
      viewBox={viewBox}
      width={size}
      height={(size * 96) / 120}
      className={cn("text-ink-3", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** A house elevation on a drafting grid. The default for "nothing here yet". */
export function HouseIllustration(props: IllustrationProps) {
  return (
    <Frame {...props}>
      <g opacity={0.28}>
        {[12, 24, 36, 48, 60, 72, 84].map((y) => (
          <line key={y} x1={6} y1={y} x2={114} y2={y} strokeWidth={0.5} />
        ))}
        {[18, 36, 54, 72, 90, 108].map((x) => (
          <line key={x} x1={x} y1={6} x2={x} y2={90} strokeWidth={0.5} />
        ))}
      </g>

      {/* Elevation */}
      <path d="M30 78V44l30-20 30 20v34" />
      <path d="M24 46 60 21l36 25" strokeWidth={1.5} />
      <line x1={22} y1={78} x2={98} y2={78} strokeWidth={1.5} />

      {/* Openings */}
      <rect x={40} y={52} width={12} height={12} />
      <rect x={68} y={52} width={12} height={12} />
      <path d="M54 78V64h12v14" />

      {/* Dimension line -- the drafting tell */}
      <g opacity={0.55}>
        <line x1={30} y1={86} x2={90} y2={86} strokeWidth={0.75} />
        <line x1={30} y1={83} x2={30} y2={89} strokeWidth={0.75} />
        <line x1={90} y1={83} x2={90} y2={89} strokeWidth={0.75} />
      </g>
    </Frame>
  );
}

/** A stack of deeds with a seal. For document-shaped emptiness. */
export function DocumentsIllustration(props: IllustrationProps) {
  return (
    <Frame {...props}>
      <g opacity={0.4}>
        <rect x={26} y={18} width={54} height={68} />
        <rect x={32} y={13} width={54} height={68} />
      </g>
      <rect x={38} y={8} width={54} height={68} fill="var(--surface)" />

      {[20, 28, 36, 44, 52].map((y) => (
        <line key={y} x1={46} y1={y} x2={84} y2={y} strokeWidth={0.75} opacity={0.7} />
      ))}
      <line x1={46} y1={60} x2={70} y2={60} strokeWidth={0.75} opacity={0.7} />

      {/* Wax seal */}
      <circle cx={78} cy={64} r={8} strokeWidth={1.5} />
      <circle cx={78} cy={64} r={4} strokeWidth={0.75} opacity={0.6} />
    </Frame>
  );
}

/** A ledger with a rule and a tick. For finance-shaped emptiness. */
export function LedgerIllustration(props: IllustrationProps) {
  return (
    <Frame {...props}>
      <rect x={20} y={14} width={80} height={68} />
      <line x1={20} y1={28} x2={100} y2={28} strokeWidth={1.5} />
      <line x1={74} y1={14} x2={74} y2={82} strokeWidth={0.75} opacity={0.6} />

      {[38, 48, 58, 68].map((y, i) => (
        <g key={y} opacity={0.7}>
          <line x1={28} y1={y} x2={62 - i * 6} y2={y} strokeWidth={0.75} />
          <line x1={80} y1={y} x2={94} y2={y} strokeWidth={0.75} />
        </g>
      ))}

      <path d="M84 74l4 4 8-9" strokeWidth={1.75} className="text-good" stroke="currentColor" />
    </Frame>
  );
}

/** A magnifier over a plan. For "no results". */
export function SearchIllustration(props: IllustrationProps) {
  return (
    <Frame {...props}>
      <rect x={16} y={16} width={68} height={62} opacity={0.55} />
      {[28, 38, 48, 58].map((y) => (
        <line key={y} x1={24} y1={y} x2={70} y2={y} strokeWidth={0.6} opacity={0.45} />
      ))}

      <circle cx={76} cy={56} r={20} strokeWidth={1.75} fill="var(--surface)" fillOpacity={0.9} />
      <line x1={90} y1={70} x2={104} y2={84} strokeWidth={2.5} />
      <path d="M68 56h16M76 48v16" strokeWidth={0.9} opacity={0.5} />
    </Frame>
  );
}

/** A crane and a partial frame. For "work not started". */
export function SiteIllustration(props: IllustrationProps) {
  return (
    <Frame {...props}>
      <line x1={12} y1={82} x2={108} y2={82} strokeWidth={1.5} />

      {/* Crane */}
      <line x1={30} y1={82} x2={30} y2={20} strokeWidth={1.5} />
      <line x1={18} y1={20} x2={72} y2={20} strokeWidth={1.5} />
      <line x1={30} y1={20} x2={18} y2={30} strokeWidth={0.75} opacity={0.6} />
      <line x1={30} y1={20} x2={54} y2={30} strokeWidth={0.75} opacity={0.6} />
      <line x1={60} y1={20} x2={60} y2={40} strokeWidth={0.75} />
      <rect x={54} y={40} width={12} height={10} />

      {/* Part-built frame */}
      <g opacity={0.75}>
        <rect x={78} y={54} width={24} height={28} />
        <line x1={78} y1={68} x2={102} y2={68} strokeWidth={0.75} />
        <line x1={90} y1={54} x2={90} y2={82} strokeWidth={0.75} />
      </g>

      {/* Uprights waiting */}
      <g opacity={0.35}>
        <line x1={42} y1={82} x2={42} y2={66} />
        <line x1={52} y1={82} x2={52} y2={70} />
      </g>
    </Frame>
  );
}

export const ILLUSTRATIONS = {
  house: HouseIllustration,
  documents: DocumentsIllustration,
  ledger: LedgerIllustration,
  search: SearchIllustration,
  site: SiteIllustration,
} as const;

export type IllustrationName = keyof typeof ILLUSTRATIONS;
