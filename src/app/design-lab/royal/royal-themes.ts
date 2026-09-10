/**
 * Royal & luxury directions.
 *
 * The brutalist and real-estate directions in the main lab are judged on a
 * slice of the dashboard. These are judged differently, because luxury is
 * mostly carried by what the dashboard does not show: photography, generous
 * space, a display face with real character, and precious-metal accents used
 * sparingly enough to stay precious.
 *
 * Each theme therefore has three layers, all expressed as tokens:
 *
 *   1. Colour    -- paper, ink, one precious metal and one deep signature
 *                   colour (sapphire, emerald, bordeaux...).
 *   2. Type      -- a display face chosen for the register it signals, over a
 *                   single quiet sans (Jost) so the display face never competes.
 *   3. Motif     -- the one ornamental idea the theme is allowed: a gilt inner
 *                   frame, a crest, marble and arches, corner brackets. One
 *                   motif per theme; two starts to look like a wedding invitation.
 *
 * Text colours were checked against their own grounds: body ink is well past
 * 7:1, secondary ink past 4.5:1, and every metal carries an ink colour that
 * passes 4.5:1 on it -- gold buttons with white labels look expensive and fail
 * contrast, so none of these do that.
 */

export type RoyalMotif = "frame" | "crest" | "marble" | "corners" | "arch";
export type RoyalDisplay = "bodoni" | "cinzel" | "cormorant" | "playfair" | "marcellus";

export interface RoyalTheme {
  id: string;
  name: string;
  tagline: string;
  rationale: string;
  strength: string;
  cost: string;
  motif: RoyalMotif;
  display: RoyalDisplay;
  /** Whether the display face has a true italic worth using for accents. */
  italic: boolean;
  vars: Record<string, string>;
  swatches: string[];
}

export const ROYAL_THEMES: RoyalTheme[] = [
  /* ------------------------------------------------------------------ */
  {
    id: "maison-noir",
    name: "Maison Noir",
    tagline: "Black lacquer, champagne gold, Didone type",
    rationale:
      "The language of a couture house or a private members' club: near-black lacquer, champagne gold used only for rules and the one action that matters, and Bodoni's hairline-and-thick contrast for every headline. Photography glows against it the way a lit room does at night.",
    strength:
      "The most unmistakably premium of the five, and the one photography flatters most — interiors look like magazine spreads.",
    cost: "A dark interface all day is heavy for dense financial tables, and Didones need size: below about 20px the hairlines disappear.",
    motif: "frame",
    display: "bodoni",
    italic: true,
    vars: {
      "--r-paper": "#0b0a08",
      "--r-surface": "#13110d",
      "--r-surface-2": "#1b1813",
      "--r-ink": "#f4ecdc",
      "--r-ink-2": "#cdbfa5",
      "--r-ink-3": "#94886f",
      "--r-line": "#2a251c",
      "--r-line-strong": "#6e5b37",
      "--r-metal": "#c9a45c",
      "--r-metal-ink": "#0b0a08",
      "--r-metal-soft": "rgba(201, 164, 92, 0.1)",
      "--r-deep": "#000000",
      "--r-deep-ink": "#f4ecdc",
      "--r-good": "#86c29b",
      "--r-warn": "#d9b665",
      "--r-bad": "#e0806f",
      "--r-display-weight": "500",
      "--r-display-tracking": "-0.01em",
      "--r-label-tracking": "0.32em",
      "--r-radius": "0px",
      "--r-arch": "0px",
      "--r-hero-ink": "#f4ecdc",
      "--r-hero-veil":
        "linear-gradient(180deg, rgba(11,10,8,0.6) 0%, rgba(11,10,8,0.12) 38%, rgba(11,10,8,0.94) 100%)",
    },
    swatches: ["#0b0a08", "#1b1813", "#c9a45c", "#f4ecdc", "#6e5b37"],
  },

  /* ------------------------------------------------------------------ */
  {
    id: "royal-sapphire",
    name: "Royal Sapphire",
    tagline: "Ivory, sapphire and gold leaf, inscribed capitals",
    rationale:
      "Borrowed from royal warrants, embassy stationery and old-bank letterheads: ivory stock, a deep sapphire for the moments of weight, gold leaf for rules and crests, and Cinzel — capitals cut from Roman inscriptions — for headings. Formal without being dark.",
    strength:
      "Reads as established and trustworthy, which matters on a screen that asks for six-figure stage payments. Light enough for all-day use.",
    cost: "Cinzel is capitals only, so long headings shout; titles have to be kept short and the crest used once, not everywhere.",
    motif: "crest",
    display: "cinzel",
    italic: false,
    vars: {
      "--r-paper": "#f8f4ea",
      "--r-surface": "#fffdf7",
      "--r-surface-2": "#f0e9d8",
      "--r-ink": "#0d1a33",
      "--r-ink-2": "#33405c",
      "--r-ink-3": "#646c82",
      "--r-line": "#e1d7c1",
      "--r-line-strong": "#b39245",
      "--r-metal": "#b39245",
      "--r-metal-ink": "#0d1a33",
      "--r-metal-soft": "#f4ebd2",
      "--r-deep": "#0f2452",
      "--r-deep-ink": "#f8f4ea",
      "--r-good": "#2c7a57",
      "--r-warn": "#9a7410",
      "--r-bad": "#a1302c",
      "--r-display-weight": "600",
      "--r-display-tracking": "0.04em",
      "--r-label-tracking": "0.3em",
      "--r-radius": "0px",
      "--r-arch": "0px",
      "--r-hero-ink": "#f8f4ea",
      "--r-hero-veil":
        "linear-gradient(180deg, rgba(10,22,52,0.62) 0%, rgba(10,22,52,0.14) 40%, rgba(10,22,52,0.9) 100%)",
    },
    swatches: ["#0f2452", "#b39245", "#f8f4ea", "#0d1a33", "#f0e9d8"],
  },

  /* ------------------------------------------------------------------ */
  {
    id: "palazzo-emerald",
    name: "Palazzo Emerald",
    tagline: "Marble, emerald lacquer, antique brass, arched frames",
    rationale:
      "An Italian palazzo: veined marble ground, emerald for depth, antique brass for fittings, and photography set into arched frames like windows onto a loggia. Cormorant Garamond gives headlines the proportions of old-style book type, with a true italic for the flourishes.",
    strength:
      "The warmest and most residential of the five — it feels like a home you are buying, not a fund you are investing in.",
    cost: "The arches and marble are ornament; they need restraint on data-dense screens, where the plain card has to carry the page.",
    motif: "marble",
    display: "cormorant",
    italic: true,
    vars: {
      "--r-paper": "#f5f3ee",
      "--r-surface": "#ffffff",
      "--r-surface-2": "#ece8de",
      "--r-ink": "#0f2a21",
      "--r-ink-2": "#3b5249",
      "--r-ink-3": "#66776f",
      "--r-line": "#ddd7ca",
      "--r-line-strong": "#a8864f",
      "--r-metal": "#a8864f",
      "--r-metal-ink": "#0b1f18",
      "--r-metal-soft": "#f1e9d8",
      "--r-deep": "#0e3b2e",
      "--r-deep-ink": "#f5f3ee",
      "--r-good": "#1e7a55",
      "--r-warn": "#9a7419",
      "--r-bad": "#9e3030",
      "--r-display-weight": "600",
      "--r-display-tracking": "-0.01em",
      "--r-label-tracking": "0.26em",
      "--r-radius": "0px",
      "--r-arch": "999px 999px 0 0",
      "--r-hero-ink": "#f5f3ee",
      "--r-hero-veil":
        "linear-gradient(180deg, rgba(8,32,25,0.55) 0%, rgba(8,32,25,0.08) 40%, rgba(8,32,25,0.88) 100%)",
    },
    swatches: ["#0e3b2e", "#a8864f", "#f5f3ee", "#ece8de", "#0f2a21"],
  },

  /* ------------------------------------------------------------------ */
  {
    id: "imperial-bordeaux",
    name: "Imperial Bordeaux",
    tagline: "Cream, bordeaux velvet, antique gold corners",
    rationale:
      "A grand heritage hotel: cream stationery, bordeaux velvet for the rich moments, antique gold picked out on the corners of each card like the brass fittings on a steamer trunk. Playfair Display carries the headlines with a confident, high-contrast italic.",
    strength:
      "The most opulent of the light themes — generous and celebratory, which suits the milestone moments of a build (keys, handover) beautifully.",
    cost: "Bordeaux sits close to the red used for problems, so critical states need their icon and label to do the work, not the colour.",
    motif: "corners",
    display: "playfair",
    italic: true,
    vars: {
      "--r-paper": "#f6eee3",
      "--r-surface": "#fffaf3",
      "--r-surface-2": "#efe3d2",
      "--r-ink": "#2b0d16",
      "--r-ink-2": "#5c3a43",
      "--r-ink-3": "#7f646a",
      "--r-line": "#e3d2bf",
      "--r-line-strong": "#b38d48",
      "--r-metal": "#b8924a",
      "--r-metal-ink": "#2b0d16",
      "--r-metal-soft": "#f3e5cb",
      "--r-deep": "#5c1528",
      "--r-deep-ink": "#f6eee3",
      "--r-good": "#2e7552",
      "--r-warn": "#9c7314",
      "--r-bad": "#b3261e",
      "--r-display-weight": "600",
      "--r-display-tracking": "-0.015em",
      "--r-label-tracking": "0.26em",
      "--r-radius": "0px",
      "--r-arch": "0px",
      "--r-hero-ink": "#f6eee3",
      "--r-hero-veil":
        "linear-gradient(180deg, rgba(48,10,20,0.6) 0%, rgba(48,10,20,0.1) 40%, rgba(48,10,20,0.9) 100%)",
    },
    swatches: ["#5c1528", "#b8924a", "#f6eee3", "#2b0d16", "#efe3d2"],
  },

  /* ------------------------------------------------------------------ */
  {
    id: "riviera-ivory",
    name: "Riviera Ivory",
    tagline: "Quiet luxury — travertine, bronze, arches, air",
    rationale:
      "The quiet end of luxury: an Aman-style resort rather than a palace. Ivory and travertine, a single bronze hairline, arched photography, and Marcellus — flared Roman capitals with a soft, classical warmth. Luxury expressed as space and calm instead of gold.",
    strength:
      "The most modern and the easiest to live with daily; it will not date, and it lets the photography of the house do all the talking.",
    cost: "The softest contrast of the five — status colours and primary actions must stay crisp, or the calm becomes vagueness.",
    motif: "arch",
    display: "marcellus",
    italic: false,
    vars: {
      "--r-paper": "#f3eee5",
      "--r-surface": "#faf7f1",
      "--r-surface-2": "#e9e1d2",
      "--r-ink": "#29231c",
      "--r-ink-2": "#574d42",
      "--r-ink-3": "#74695c",
      "--r-line": "#ded4c4",
      "--r-line-strong": "#a8875f",
      "--r-metal": "#a8875f",
      "--r-metal-ink": "#1e1914",
      "--r-metal-soft": "#efe5d5",
      "--r-deep": "#2e2720",
      "--r-deep-ink": "#f3eee5",
      "--r-good": "#4a7a5a",
      "--r-warn": "#8e6f22",
      "--r-bad": "#9a3e30",
      "--r-display-weight": "400",
      "--r-display-tracking": "0.02em",
      "--r-label-tracking": "0.3em",
      "--r-radius": "0px",
      "--r-arch": "999px 999px 0 0",
      "--r-hero-ink": "#faf7f1",
      "--r-hero-veil":
        "linear-gradient(180deg, rgba(41,35,28,0.4) 0%, rgba(41,35,28,0.04) 45%, rgba(41,35,28,0.78) 100%)",
    },
    swatches: ["#f3eee5", "#e9e1d2", "#a8875f", "#2e2720", "#29231c"],
  },
];
