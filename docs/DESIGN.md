# Design system — Noir Editorial

Classic monochrome — deep black and crisp white — punctuated by emerald, navy and metallic gold. A Swiss grotesk set at structural sizes, ruled with editorial lines, on a grid that is broken on purpose.

A house being built is a sequence of facts: dates, sums, square feet, stages. The interface treats those facts as its graphic material. The oversized type on a page is always one of them.

The direction was developed in the design lab: `/design-lab/noir` is the full study, and `/design-lab` and `/design-lab/royal` keep the thirteen directions it was chosen from.

## The three groups of tokens

Everything lives in `src/app/globals.css`:

| Group | What it holds | Who may change it |
|---|---|---|
| **Colour** | surfaces, ink, accent, status | the theme |
| **Structure** | radius, border weight, shadow, tracking, case | the theme |
| **Chart series** | the categorical palette | only after re-validation |

No component hard-codes a radius, a border width or a shadow, so changing direction is a token-block edit.

## Colour

### Roles

| Role | Meaning |
|---|---|
| **Ink** (black / white) | everything, including the "brand" — progress fills, the active item, links |
| **Gold** (metallic) | the primary action on a screen, and what needs acting on |
| **Emerald** | complete, passed, paid |
| **Navy** | high severity, at risk |
| **Crimson** | blocked, overdue, failed |

Crimson is the one semantic colour outside the palette. A safety signal should not depend on the reader decoding an inversion, so it gets a hue of its own — deep and restrained, and never used for anything else.

### Surfaces and ink

| Token | Light | Dark |
|---|---|---|
| `--canvas` / `--surface` | `#ffffff` / `#ffffff` | `#0a0a0a` / `#121212` |
| `--surface-2` / `--surface-3` | `#f5f5f5` / `#ebebeb` | `#1a1a1a` / `#242424` |
| `--ink` / `--ink-2` / `--ink-3` | `#0a0a0a` / `#474747` / `#6b6b6b` | `#fafafa` / `#b3b3b3` / `#8f8f8f` |
| `--line` / `--line-strong` | `#e2e2e2` / `#0a0a0a` | `#2a2a2a` / `#fafafa` |
| `--brand` | `#0a0a0a` | `#fafafa` |
| `--accent` (gold) | `#a8832f` | `#d4b36c` |

In light mode the canvas and card surface are the same white: cards separate by rule, not by tint. Dark mode steps the surfaces up in near-neutral greys so a card still reads as a card without borrowing colour.

**Dark is the default.** The direction is a night scene first; crisp white is one click away in the theme menu.

### Gold that passes contrast

The primary button is a metallic gradient (`--gold-metal`) with dark ink (`--gold-ink`). Gold with a white label looks richer and fails contrast; on a screen that asks for six-figure stage payments, that is not a trade worth making. The darkest stop was lifted to `#9a7836` so the label clears 4.5:1 on every stop of the gradient.

### Status

| Role | Light | Dark | Used for |
|---|---|---|---|
| good | `#0f7a55` | `#34b17f` | complete, passed, paid, resolved |
| warning | `#a8832f` | `#d4b36c` | due, invoiced, medium severity |
| serious | `#1d3566` | `#8fa8e0` | high severity, at risk, over budget |
| critical | `#b3261e` | `#f07a6e` | blocked, overdue, failed |

Every status is shipped with an icon and a text label (`StatusBadge`), so none of them depends on colour — which also keeps them legible in greyscale print and forced-colours mode. Each status ink passes 4.5:1 on its own subtle fill and on the card surface, in both themes.

### Chart series

Fixed order, never cycled, never extended past eight:

| Slot | Hue | Light | Dark |
|---|---|---|---|
| 1 | navy | `#2c5f9e` | `#5a93de` |
| 2 | burnt orange | `#c25a18` | `#d9743e` |
| 3 | green | `#1d8a63` | `#2fa87a` |
| 4 | gold | `#b08420` | `#b88a28` |
| 5 | rose | `#c56b93` | `#d98cc0` |
| 6 | sky / olive | `#2b8cbe` | `#8fb339` |
| 7 | violet | `#6b4e9e` | `#9a83de` |
| 8 | oxblood | `#a03232` | `#d06565` |

The palette already carried navy, gold and green, so it stays close to the one validated for the previous direction. Re-validating it against the new surfaces found two problems the earlier check had missed, because it only compared neighbouring slots:

- Slots 3 and 6 were both greens, ΔE 6.1 apart — indistinguishable **with full colour vision** whenever a chart shows six or more phases. Slot 6 is now a sky blue in light and an olive in dark.
- In dark mode, slots 4 and 5 fell to ΔE 7.4 under tritanopia. Slot 5 was lifted.

```
Light (surface #ffffff):
  [PASS] Lightness band       L 0.48–0.64
  [PASS] Chroma floor         min 0.112
  [PASS] CVD separation       worst adjacent ΔE 8.2 (tritan)
  [PASS] Normal-vision floor  adjacent ≥ 30.1, any pair ≥ 16.8
  [PASS] Contrast vs surface  ≥ 3.41:1

Dark (surface #121212):
  [PASS] Lightness band       L 0.63–0.73
  [PASS] Chroma floor         min 0.114
  [PASS] CVD separation       worst adjacent ΔE 10.3 (tritan)
  [PASS] Normal-vision floor  adjacent ≥ 31.6, any pair ≥ 16.5
  [PASS] Contrast vs surface  ≥ 5.11:1
```

Every chart also renders through `ChartFrame`, which supplies direct labels and a table view, so no reading ever depends on telling two colours apart.

## Typography

- **Schibsted Grotesk** for everything from body copy to structural figures — 400 and 500 for reading, 600 for emphasis, 800 for oversized type.
- **Cormorant Garamond italic** (`.ui-accent`) for one or two accent words inside a grotesk headline — "Featured *residences*", "Your home, *built in the open*". Display sizes only, never running text.
- **DM Mono** for labels, running lines, chart ticks and anything that is a measurement. `.ui-label` is set in mono: labels are categories and units, not prose, and the typewriter register is what makes them read as a slate.

Headings are light-to-medium weight at large sizes with tight tracking (`-0.035em` to `-0.05em`). Luxury comes from size and restraint, not from weight.

### Structural type

`.ui-giant` sets a figure at 800 weight, line-height 0.78, tracking `-0.07em`, large enough to act as architecture on the page. The rule that keeps it from being decoration: **it is always a real figure from the build** — the project name, the floor area, the slip in days, the open decisions, the completion — and the same figure always appears nearby in readable form, so the giant version can be `aria-hidden`.

Where structural type crosses a photograph it uses `mix-blend-mode: difference`, so it inverts over the image and stays correct on both a black and a white ground.

## Layout

A twelve-column grid, broken deliberately:

- A photograph and a text block **overlap by exactly one column** — never by accident, and never by more.
- Offsets are only applied from `lg` up. Below that, everything stacks into a single column with no overlap.
- Each band or page section opens with a **running line** (`.ui-runline`): mono facts between a strong rule above and a hairline below.
- Page titles hang from a 4px rule (`PageHeader`), set at structural size with the standfirst below.

1600px maximum with a 240px sidebar that becomes a drawer below `lg`. Wide content — Gantt charts, tables — scrolls inside its own container; the page body never scrolls horizontally.

## Cinematic photography

The interface is monochrome; the photography is not. Warm light — architecture at dusk, lit interiors — is what makes a page feel like a home rather than a ledger, so scene photography keeps its colour.

- **The landing page** (`/`) is a dedicated cinematic page: a full-bleed dusk hero with the navigation over it, the wordmark set across the full width and cropped by the frame, featured residences, alternating full-bleed image and text rows, and a footer that uses the wordmark as its floor. It always renders with the dark tokens.
- **Page bands.** `PageHeader` takes a `scene` and becomes a photographic band with the title set large over a dark veil. Scenes are chosen per page (`src/lib/scenes.ts`): a kitchen for selections, a penthouse for finance, a marble bath for quality. Utility pages — settings, the digest, the site console — keep the plain editorial head.
- **The dashboard hero** is a dusk scene with the project name across it and **the real site photograph pinned over the corner**, captioned with the date of the latest update. The scene sets the mood; it never stands in for the buyer's house.
- **Evidence photography** — site updates, the gallery, snag photos — is shown exactly as taken. A buyer checking a brick colour or a crack needs the real one.

Scene photography is from Unsplash, served by Unsplash's image CDN at the width each slot needs. To remove the third-party dependency, place the same files in `/public` and point `sceneSrc` at them.

## Component primitives

| Class | Used by |
|---|---|
| `.ui-card` | a section: a rule above and space around it — no fill, no outline |
| `.ui-card--raised` | the one panel on a page (`<Card raised>`, `<StatTile raised>`) |
| `.ui-panel` | dialogs, dropdowns, popovers, tooltips |
| `.ui-control` | inputs, selects, textareas |
| `.ui-chip` | badges and status pills |
| `.ui-rule` | the heavy editorial rule under a heading |
| `.ui-runline` | the ruled running line that opens a section |
| `.ui-label` | mono, tracked, uppercase labels |
| `.ui-display` | headings and figures |
| `.ui-giant` | structural type |
| `.ui-gold` | the metallic primary action |
| `.ui-photo-mono` | decorative black-and-white photography |

**Sections are glass.** Every app page sits on an ambient scene — its own photograph at 640px, blurred to colour, with slow emerald, navy and gold light drifting through it — and each section is a pane of frosted glass over that scene: a live `backdrop-filter` blur, a translucent gradient fill, a lit top edge and a soft shadow for depth. Dynamic light comes from `useGlassLight`, one passive pointer listener coalesced to a frame, which writes the pointer's position into `--mx` / `--my` on the pane beneath it; the stylesheet turns that into a specular bloom and a brightening rim. At rest the light sits at the top left, like a window.

Buttons are capsules (secondary buttons are glass, the primary is liquid gold), fields are recessed glass, and menus and dialogs use denser glass so nothing behind them competes. Glass never blurs glass. Under `prefers-reduced-transparency`, or where `backdrop-filter` is unsupported, every pane becomes a solid surface of the same shape; under `prefers-reduced-motion` the light stays fixed and the ambient drift stops.

The note below describes the editorial rules the glass replaced, kept for the reasoning:

**Sections were unboxed.** Twenty identical outlined boxes on a page flatten every hierarchy and read as an admin template. A section is a rule, a title and space; its content sits flush with the rule, and no section nests a box inside another. A box is reserved for the single thing a page most needs acted on — `raised` gives it a quiet panel with a gold hairline. Section titles are 22–24px grotesk with the last word in the italic serif (`CardTitle` does this automatically; pass `accent={false}` to opt out). Status figures colour their own rule rather than carrying a rail on a box.

Buttons are square, tracked uppercase, and invert on hover (ink fills, text flips) — the same black/white exchange the page is built on. Only the primary variant is gold.

`rounded-full` is kept only where the element is a *mark* rather than a surface — status dots, the unread count, legend swatches, avatars. A dot stays a dot; surfaces follow `--radius-card`.

## Accessibility

- **Focus** — one `:focus-visible` ring, navy in light and gold in dark, never removed.
- **Contrast** — every text token passes 4.5:1 on the surfaces it sits on, in both themes; status marks and borders pass 3:1.
- **Charts** — `role="img"` with a description stating the finding, plus a table view.
- **Headings** — `CardTitle` takes an `as` prop so the document outline stays correct.
- **Forms** — `Field` wires label, hint and error through `aria-describedby`.
- **Forced colours** — chart marks keep an explicit stroke.
- **Motion** — every animation, including the hero's slow drift and the gold sheen, is switched off under `prefers-reduced-motion`.
