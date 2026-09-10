/**
 * Design lab themes.
 *
 * Four complete directions for the interface, each expressed purely as CSS
 * custom properties. That is the point of the exercise: if a direction can be
 * described entirely by tokens, adopting it is a token swap rather than a
 * rewrite. Anything a theme needs that is not in this list is a gap in the
 * token system, not a reason to hard-code.
 *
 * Structural tokens (radius, border weight, shadow, letter-spacing, case) carry
 * as much of the character as the colours do -- brutalism is mostly geometry.
 *
 * Every `series` array has been run through the colourblind-separation
 * validator against that theme's own paper colour. The UI accents are allowed
 * to be as loud as they like; the chart series are not, because a chart whose
 * categories collapse under deuteranopia is broken regardless of how good it
 * looks. Where a series colour falls below 3:1 against the paper, the charts
 * carry direct labels and a table view -- which this app already does.
 */

export type ThemeFamily = "brutalist" | "real-estate";

export interface LabTheme {
  id: string;
  /** Which comparison group this belongs to. */
  family: ThemeFamily;
  name: string;
  tagline: string;
  rationale: string;
  /** What this direction is genuinely good and bad at. */
  strength: string;
  cost: string;
  /** Font stack applied to headings within the panel. */
  displayFont: "archivo" | "space" | "inter" | "mono" | "fraunces";
  vars: Record<string, string>;
  series: string[];
  /** Shown as swatches under the theme name. */
  swatches: string[];
}

export const THEMES: LabTheme[] = [
  /* ------------------------------------------------------------------ */
  {
    id: "site-notice",
    family: "brutalist",
    name: "Site Notice",
    tagline: "Hazard tape, stencil caps, hard black rules",
    rationale:
      "Borrows from the visual language already on the building site — safety signage, plant hire livery, spray-marked hoarding. It is the only direction here that is about construction rather than about design trends, so it will not read as a template someone downloaded.",
    strength:
      "Instantly legible hierarchy, and the yellow does real work flagging attention rather than just decorating.",
    cost: "The uppercase headings need discipline — used on body copy they become unreadable.",
    displayFont: "archivo",
    vars: {
      "--lab-paper": "#FFFDF5",
      "--lab-surface": "#FFFFFF",
      "--lab-surface-2": "#F4F1E6",
      "--lab-ink": "#0A0A0A",
      "--lab-ink-2": "#3D3A32",
      "--lab-ink-3": "#736E60",
      "--lab-line": "#0A0A0A",
      "--lab-line-soft": "#D6D0BE",

      "--lab-accent": "#FFD400",
      "--lab-accent-ink": "#0A0A0A",
      "--lab-accent-2": "#FF5C00",
      "--lab-accent-2-ink": "#FFFFFF",
      "--lab-accent-3": "#1E3A5F",
      "--lab-accent-3-ink": "#FFFFFF",

      "--lab-good": "#00806B",
      "--lab-warn": "#E3A400",
      "--lab-bad": "#D6262B",

      "--lab-radius": "0px",
      "--lab-radius-chip": "0px",
      "--lab-border": "2px",
      "--lab-border-strong": "3px",
      "--lab-shadow": "4px 4px 0 #0A0A0A",
      "--lab-shadow-sm": "3px 3px 0 #0A0A0A",
      "--lab-heading-weight": "900",
      "--lab-heading-tracking": "-0.01em",
      "--lab-heading-case": "uppercase",
      "--lab-label-case": "uppercase",
      "--lab-label-tracking": "0.08em",
    },
    series: ["#1E5FA8", "#FF5C00", "#00806B", "#E3A400", "#B5179E"],
    swatches: ["#FFD400", "#FF5C00", "#1E3A5F", "#0A0A0A", "#F4F1E6"],
  },

  /* ------------------------------------------------------------------ */
  {
    id: "blueprint",
    family: "brutalist",
    name: "Blueprint",
    tagline: "Drafting grid, hairlines, dimension ticks",
    rationale:
      "Treats the dashboard as a technical drawing: a visible measurement grid, hairline rules instead of boxes, monospaced numerals, and annotation marks borrowed from architectural drafting. Severe through precision rather than through weight.",
    strength:
      "Feels authoritative with dense numeric data, and the grid gives every element somewhere honest to sit.",
    cost: "Hairlines are fragile on low-quality screens, and the restraint means less immediate visual punch.",
    displayFont: "mono",
    vars: {
      "--lab-paper": "#F2F7FF",
      "--lab-surface": "#FFFFFF",
      "--lab-surface-2": "#E7F0FF",
      "--lab-ink": "#062B5B",
      "--lab-ink-2": "#2E5585",
      "--lab-ink-3": "#7A96BC",
      "--lab-line": "#0047D9",
      "--lab-line-soft": "#C3D8F5",

      "--lab-accent": "#0047D9",
      "--lab-accent-ink": "#FFFFFF",
      "--lab-accent-2": "#FF4D3D",
      "--lab-accent-2-ink": "#FFFFFF",
      "--lab-accent-3": "#C6FF00",
      "--lab-accent-3-ink": "#062B5B",

      "--lab-good": "#1BAF8A",
      "--lab-warn": "#C77800",
      "--lab-bad": "#FF4D3D",

      "--lab-radius": "0px",
      "--lab-radius-chip": "0px",
      "--lab-border": "1px",
      "--lab-border-strong": "2px",
      "--lab-shadow": "none",
      "--lab-shadow-sm": "none",
      "--lab-heading-weight": "700",
      "--lab-heading-tracking": "-0.02em",
      "--lab-heading-case": "none",
      "--lab-label-case": "uppercase",
      "--lab-label-tracking": "0.14em",
    },
    series: ["#0047D9", "#FF4D3D", "#1BAF8A", "#C77800", "#8B3FD9"],
    swatches: ["#0047D9", "#FF4D3D", "#C6FF00", "#062B5B", "#E7F0FF"],
  },

  /* ------------------------------------------------------------------ */
  {
    id: "concrete-pop",
    family: "brutalist",
    name: "Concrete Pop",
    tagline: "Fat black outlines, offset shadows, saturated blocks",
    rationale:
      "The loudest option: 3px black outlines, 6px hard offset shadows, and flat saturated colour blocks. Maximum energy and the clearest 'a person chose this' signal — but it is also the most recognisable current trend, so it dates fastest.",
    strength:
      "Nothing about it looks generated. Components read as physical objects you could pick up.",
    cost: "Hard to sustain across dense financial tables, and in two years it will look precisely of its moment.",
    displayFont: "space",
    vars: {
      "--lab-paper": "#FFFFFF",
      "--lab-surface": "#FFFFFF",
      "--lab-surface-2": "#F5F2FF",
      "--lab-ink": "#0B0B0F",
      "--lab-ink-2": "#3A3A46",
      "--lab-ink-3": "#6E6E80",
      "--lab-line": "#0B0B0F",
      "--lab-line-soft": "#DCDCE6",

      "--lab-accent": "#FF2E88",
      "--lab-accent-ink": "#FFFFFF",
      "--lab-accent-2": "#0066FF",
      "--lab-accent-2-ink": "#FFFFFF",
      "--lab-accent-3": "#C6FF3D",
      "--lab-accent-3-ink": "#0B0B0F",

      "--lab-good": "#12B886",
      "--lab-warn": "#E09000",
      "--lab-bad": "#FF2E88",

      "--lab-radius": "6px",
      "--lab-radius-chip": "999px",
      "--lab-border": "3px",
      "--lab-border-strong": "3px",
      "--lab-shadow": "6px 6px 0 #0B0B0F",
      "--lab-shadow-sm": "4px 4px 0 #0B0B0F",
      "--lab-heading-weight": "700",
      "--lab-heading-tracking": "-0.03em",
      "--lab-heading-case": "none",
      "--lab-label-case": "uppercase",
      "--lab-label-tracking": "0.06em",
    },
    series: ["#0066FF", "#FF2E88", "#E09000", "#12B886", "#7C3AED"],
    swatches: ["#FF2E88", "#0066FF", "#C6FF3D", "#0B0B0F", "#F5F2FF"],
  },

  /* ------------------------------------------------------------------ */
  {
    id: "swiss-severe",
    family: "brutalist",
    name: "Swiss Severe",
    tagline: "Extreme type scale, ruled lines, one screaming accent",
    rationale:
      "Editorial brutalism: no radius, no shadow, no boxes. Structure comes from ruled lines and a violent contrast between enormous headline type and small dense text. One accent is allowed to shout; everything else is black on off-white.",
    strength:
      "Ages best of the four, handles dense tables effortlessly, and reads as expensive rather than trendy.",
    cost: "Least immediately 'fun', and needs real typographic care — sloppy spacing shows instantly.",
    displayFont: "archivo",
    vars: {
      "--lab-paper": "#FAFAF8",
      "--lab-surface": "#FFFFFF",
      "--lab-surface-2": "#F0F0EC",
      "--lab-ink": "#000000",
      "--lab-ink-2": "#2E2E2B",
      "--lab-ink-3": "#7A7A73",
      "--lab-line": "#000000",
      "--lab-line-soft": "#D8D8D0",

      "--lab-accent": "#FF3B00",
      "--lab-accent-ink": "#FFFFFF",
      "--lab-accent-2": "#0033FF",
      "--lab-accent-2-ink": "#FFFFFF",
      "--lab-accent-3": "#000000",
      "--lab-accent-3-ink": "#FFFFFF",

      "--lab-good": "#12A594",
      "--lab-warn": "#B58900",
      "--lab-bad": "#FF3B00",

      "--lab-radius": "0px",
      "--lab-radius-chip": "0px",
      "--lab-border": "1px",
      "--lab-border-strong": "4px",
      "--lab-shadow": "none",
      "--lab-shadow-sm": "none",
      "--lab-heading-weight": "800",
      "--lab-heading-tracking": "-0.045em",
      "--lab-heading-case": "none",
      "--lab-label-case": "uppercase",
      "--lab-label-tracking": "0.1em",
    },
    series: ["#0033FF", "#FF3B00", "#12A594", "#B58900", "#8E24AA"],
    swatches: ["#FF3B00", "#0033FF", "#000000", "#FAFAF8", "#F0F0EC"],
  },
  /* ================================================================== */
  /* Real estate                                                        */
  /* ================================================================== */
  {
    id: "broadsheet",
    family: "real-estate",
    name: "Property Broadsheet",
    tagline: "Cream stock, editorial serif, brass rules",
    rationale:
      "The language of a high-end property brochure rather than a software dashboard: warm paper, a serif display face with real character, hairline rules and a brass accent. Severe through typographic discipline rather than heavy borders \u2014 the restraint is what signals expense.",
    strength:
      "Makes a $706,000 contract feel like an asset rather than a line item, and photography sits beautifully against the cream.",
    cost: "Serif headings need generous spacing; cramped into a dense table they lose their advantage entirely.",
    displayFont: "fraunces",
    vars: {
      "--lab-paper": "#FBF7EF",
      "--lab-surface": "#FFFFFF",
      "--lab-surface-2": "#F3EDE0",
      "--lab-ink": "#1A1712",
      "--lab-ink-2": "#4A4238",
      "--lab-ink-3": "#8A7F6D",
      "--lab-line": "#1A1712",
      "--lab-line-soft": "#DED4C0",

      "--lab-accent": "#B8860B",
      "--lab-accent-ink": "#FFFFFF",
      "--lab-accent-2": "#1F5AA8",
      "--lab-accent-2-ink": "#FFFFFF",
      "--lab-accent-3": "#C1440E",
      "--lab-accent-3-ink": "#FFFFFF",

      "--lab-good": "#1E8A6E",
      "--lab-warn": "#B8860B",
      "--lab-bad": "#C1440E",

      "--lab-radius": "0px",
      "--lab-radius-chip": "0px",
      "--lab-border": "1px",
      "--lab-border-strong": "3px",
      "--lab-shadow": "none",
      "--lab-shadow-sm": "none",
      "--lab-heading-weight": "700",
      "--lab-heading-tracking": "-0.02em",
      "--lab-heading-case": "none",
      "--lab-label-case": "uppercase",
      "--lab-label-tracking": "0.16em",
    },
    series: ["#1F5AA8", "#C1440E", "#1E8A6E", "#B8860B", "#7A3E9D"],
    swatches: ["#B8860B", "#C1440E", "#1F5AA8", "#1A1712", "#F3EDE0"],
  },

  /* ------------------------------------------------------------------ */
  {
    id: "terracotta",
    family: "real-estate",
    name: "Terracotta Works",
    tagline: "Materials board \u2014 clay, sage, ochre, oak",
    rationale:
      "Built from the actual palette of the house being constructed: terracotta, clay render, sage, brass and limestone. It reads as a materials board an architect hands you rather than a software theme, and it is warm without being soft \u2014 the edges stay hard.",
    strength:
      "Bright and distinctive with none of the coldness of a typical dashboard, and it ties the interface to the building itself.",
    cost: "Warm palettes make red status colours work harder \u2014 the critical state needs care not to blend into the terracotta.",
    displayFont: "archivo",
    vars: {
      "--lab-paper": "#FFF4EC",
      "--lab-surface": "#FFFFFF",
      "--lab-surface-2": "#FBE7DA",
      "--lab-ink": "#2A1810",
      "--lab-ink-2": "#5C4436",
      "--lab-ink-3": "#94786A",
      "--lab-line": "#2A1810",
      "--lab-line-soft": "#E8CDBB",

      "--lab-accent": "#E2571F",
      "--lab-accent-ink": "#FFFFFF",
      "--lab-accent-2": "#12946D",
      "--lab-accent-2-ink": "#FFFFFF",
      "--lab-accent-3": "#F2C879",
      "--lab-accent-3-ink": "#2A1810",

      "--lab-good": "#12946D",
      "--lab-warn": "#C99A00",
      "--lab-bad": "#B3301A",

      "--lab-radius": "3px",
      "--lab-radius-chip": "3px",
      "--lab-border": "2px",
      "--lab-border-strong": "3px",
      "--lab-shadow": "4px 4px 0 #2A1810",
      "--lab-shadow-sm": "3px 3px 0 #2A1810",
      "--lab-heading-weight": "800",
      "--lab-heading-tracking": "-0.025em",
      "--lab-heading-case": "none",
      "--lab-label-case": "uppercase",
      "--lab-label-tracking": "0.1em",
    },
    series: ["#1B5E9B", "#E2571F", "#12946D", "#C99A00", "#9B4D8C"],
    swatches: ["#E2571F", "#12946D", "#F2C879", "#2A1810", "#FBE7DA"],
  },

  /* ------------------------------------------------------------------ */
  {
    id: "land-registry",
    family: "real-estate",
    name: "Land Registry",
    tagline: "Parchment, ledger rules, estate green and gold",
    rationale:
      "A property is a legal and financial instrument before it is a building, so this borrows from title deeds: parchment stock, ruled ledger lines, engraved-feeling serif numerals, estate green with oxblood and gold. It handles money more convincingly than anything else here.",
    strength:
      "The payment schedule and contract figures look authoritative \u2014 a document you would sign, not a screen you would skim.",
    cost: "Can read as old-fashioned if the photography and spacing are not kept deliberately contemporary.",
    displayFont: "fraunces",
    vars: {
      "--lab-paper": "#F7F4E9",
      "--lab-surface": "#FFFDF6",
      "--lab-surface-2": "#EDE8D6",
      "--lab-ink": "#16281E",
      "--lab-ink-2": "#3E5245",
      "--lab-ink-3": "#7C8A7E",
      "--lab-line": "#16281E",
      "--lab-line-soft": "#D2CDB6",

      "--lab-accent": "#1D6B4F",
      "--lab-accent-ink": "#F7F4E9",
      "--lab-accent-2": "#A03232",
      "--lab-accent-2-ink": "#F7F4E9",
      "--lab-accent-3": "#B08420",
      "--lab-accent-3-ink": "#16281E",

      "--lab-good": "#1D8A63",
      "--lab-warn": "#B08420",
      "--lab-bad": "#A03232",

      "--lab-radius": "0px",
      "--lab-radius-chip": "0px",
      "--lab-border": "1px",
      "--lab-border-strong": "3px",
      "--lab-shadow": "none",
      "--lab-shadow-sm": "none",
      "--lab-heading-weight": "600",
      "--lab-heading-tracking": "-0.015em",
      "--lab-heading-case": "none",
      "--lab-label-case": "uppercase",
      "--lab-label-tracking": "0.18em",
    },
    series: ["#2C5F9E", "#A03232", "#1D8A63", "#B08420", "#6B4E9E"],
    swatches: ["#1D6B4F", "#B08420", "#A03232", "#16281E", "#EDE8D6"],
  },

  /* ------------------------------------------------------------------ */
  {
    id: "show-home",
    family: "real-estate",
    name: "Show Home",
    tagline: "Bright, generous, optimistic developer energy",
    rationale:
      "The brightest option: crisp white, a confident marine blue, coral and fresh lime, on softly rounded cards that still carry a firm 2px outline and a hard shadow. It is what a new-build developer's brand looks like when the developer actually hired a designer.",
    strength:
      "Welcoming rather than severe, which suits a nervous first-time buyer considerably better than hazard tape does.",
    cost: "The friendliest of the eight, so also the closest to conventional \u2014 it needs those hard shadows to stay distinctive.",
    displayFont: "space",
    vars: {
      "--lab-paper": "#FFFFFF",
      "--lab-surface": "#FFFFFF",
      "--lab-surface-2": "#EDF6FA",
      "--lab-ink": "#0E2430",
      "--lab-ink-2": "#3A5462",
      "--lab-ink-3": "#7793A2",
      "--lab-line": "#0E2430",
      "--lab-line-soft": "#CFE0E8",

      "--lab-accent": "#0A7CBF",
      "--lab-accent-ink": "#FFFFFF",
      "--lab-accent-2": "#FF6B3D",
      "--lab-accent-2-ink": "#FFFFFF",
      "--lab-accent-3": "#B8E04B",
      "--lab-accent-3-ink": "#0E2430",

      "--lab-good": "#12A594",
      "--lab-warn": "#D99400",
      "--lab-bad": "#E04A2F",

      "--lab-radius": "10px",
      "--lab-radius-chip": "999px",
      "--lab-border": "2px",
      "--lab-border-strong": "2px",
      "--lab-shadow": "5px 5px 0 #0E2430",
      "--lab-shadow-sm": "3px 3px 0 #0E2430",
      "--lab-heading-weight": "700",
      "--lab-heading-tracking": "-0.03em",
      "--lab-heading-case": "none",
      "--lab-label-case": "uppercase",
      "--lab-label-tracking": "0.08em",
    },
    series: ["#0A7CBF", "#FF6B3D", "#12A594", "#D99400", "#7C5CD6"],
    swatches: ["#0A7CBF", "#FF6B3D", "#B8E04B", "#0E2430", "#EDF6FA"],
  },
];
