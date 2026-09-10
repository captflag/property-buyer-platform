/* eslint-disable @next/next/no-img-element -- remote editorial photography for
   this preview only. The image optimiser is deliberately restricted to
   Supabase storage, and widening it for a design comparison would let any
   Unsplash URL be proxied through production. */
import * as React from "react";

import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

import { photoUrl, ROYAL_PHOTOS, type RoyalPhoto } from "./royal-photos";
import type { RoyalDisplay, RoyalTheme } from "./royal-themes";

export interface RoyalFigures {
  projectName: string;
  city: string;
  bedrooms: number | null;
  bathrooms: number | null;
  floorArea: number | null;
  progress: number;
  planned: number;
  contractRevised: number;
  handover: string;
  nextPaymentName: string;
  nextPaymentAmount: number;
  nextPaymentDue: string;
  payments: Array<{
    name: string;
    due: string;
    amount: number;
    status: "Paid" | "Invoiced" | "Scheduled" | "Overdue";
  }>;
}

const DISPLAY_STACKS: Record<RoyalDisplay, string> = {
  bodoni: "var(--font-bodoni), 'Didot', Georgia, serif",
  cinzel: "var(--font-cinzel), 'Trajan Pro', Georgia, serif",
  cormorant: "var(--font-cormorant), Garamond, Georgia, serif",
  playfair: "var(--font-playfair), Georgia, serif",
  marcellus: "var(--font-marcellus), Georgia, serif",
};

const DISPLAY_NAMES: Record<RoyalDisplay, string> = {
  bodoni: "Bodoni Moda",
  cinzel: "Cinzel",
  cormorant: "Cormorant Garamond",
  playfair: "Playfair Display",
  marcellus: "Marcellus",
};

/**
 * One royal direction, applied to the same content as every other: a hero on
 * the villa, the collection, interiors, finishes, and the buyer's own build.
 * Identical photographs and figures in every panel, so the comparison is
 * about the design and nothing else.
 */
export function RoyalPanel({
  theme,
  f,
  priority = false,
}: {
  theme: RoyalTheme;
  f: RoyalFigures;
  /** The first panel's hero is above the fold, so it loads eagerly. */
  priority?: boolean;
}) {
  const style = {
    ...theme.vars,
    "--r-display-font": DISPLAY_STACKS[theme.display],
    "--r-body-font": "var(--font-jost), system-ui, sans-serif",
  } as React.CSSProperties;

  const accent = theme.italic ? "royal-italic" : "";

  return (
    <section
      id={theme.id}
      aria-labelledby={`${theme.id}-heading`}
      className="border-ink scroll-mt-16 border-b-2"
    >
      <Meta theme={theme} />

      <div className={`royal royal--${theme.motif}`} style={style}>
        <Hero theme={theme} f={f} accent={accent} priority={priority} />

        <section className="royal-section">
          <SectionHead
            eyebrow="The collection"
            title="Residences by Kestrel"
            accent={accent}
            glyph={theme.motif === "crest" ? "crown" : "diamond"}
          />
          <div className="mx-auto mt-10 grid max-w-6xl gap-6 md:grid-cols-2">
            <Residence
              photo={ROYAL_PHOTOS.bungalow}
              kind="Garden bungalow"
              name="The Linden Bungalow"
              spec="4 bedrooms · 4 bathrooms · 3,850 sq ft · private pool"
              price="From $2,450,000"
            />
            <Residence
              photo={ROYAL_PHOTOS.penthouse}
              kind="Penthouse flat"
              name="The Belvedere Penthouse"
              spec="3 bedrooms · 3 bathrooms · 2,900 sq ft · wraparound terrace"
              price="From $3,100,000"
            />
          </div>
        </section>

        <section className="royal-section pt-0">
          <SectionHead
            eyebrow="Interiors"
            title="Rooms, finished by hand"
            accent={accent}
            glyph={theme.motif === "crest" ? "crown" : "diamond"}
          />
          <Interiors />
        </section>

        <section className="royal-deep royal-section">
          <SectionHead
            eyebrow="Your finishes"
            title="Curated for Kestrel House"
            accent={accent}
            onDeep
            glyph={theme.motif === "crest" ? "crown" : "diamond"}
          />
          <Finishes />
        </section>

        <section className="royal-section">
          <SectionHead
            eyebrow="Your build"
            title="Where your residence stands"
            accent={accent}
            glyph={theme.motif === "crest" ? "crown" : "diamond"}
          />
          <YourBuild f={f} />
        </section>

        <section className="royal-section pt-0">
          <Specimen theme={theme} f={f} accent={accent} />
        </section>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function Meta({ theme }: { theme: RoyalTheme }) {
  return (
    <div className="bg-canvas border-line flex flex-wrap items-start justify-between gap-4 border-b px-5 py-4 sm:px-8">
      <div className="max-w-2xl">
        <h2
          id={`${theme.id}-heading`}
          className="text-ink text-lg font-semibold tracking-[-0.02em]"
        >
          {theme.name}
        </h2>
        <p className="text-ink-2 mt-0.5 text-[13px]">{theme.tagline}</p>
        <p className="text-ink-3 mt-2 text-[12px] leading-relaxed">{theme.rationale}</p>
        <dl className="mt-2.5 flex flex-col gap-1 text-[12px] leading-snug">
          <div className="flex gap-2">
            <dt className="text-good-ink shrink-0 font-semibold">Good at</dt>
            <dd className="text-ink-2">{theme.strength}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-serious-ink shrink-0 font-semibold">Costs you</dt>
            <dd className="text-ink-2">{theme.cost}</dd>
          </div>
        </dl>
      </div>
      <div className="flex flex-col items-end gap-2">
        <div className="flex gap-1">
          {theme.swatches.map((hex) => (
            <span
              key={hex}
              className="border-line size-7 border"
              style={{ backgroundColor: hex }}
              title={hex}
            />
          ))}
        </div>
        <p className="text-ink-3 text-[11px]">
          {DISPLAY_NAMES[theme.display]} over Jost · motif: {theme.motif}
        </p>
      </div>
    </div>
  );
}

function Hero({
  theme,
  f,
  accent,
  priority,
}: {
  theme: RoyalTheme;
  f: RoyalFigures;
  accent: string;
  priority: boolean;
}) {
  return (
    <header className="royal-hero">
      <img
        src={photoUrl(ROYAL_PHOTOS.villa, 2000)}
        alt={ROYAL_PHOTOS.villa.alt}
        className="royal-hero__img"
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
      />
      <div className="royal-hero__veil" aria-hidden="true" />

      <div className="royal-hero__content">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <div className="flex items-center gap-3">
            <Monogram crest={theme.motif === "crest"} />
            <div>
              <p className="royal-display text-[20px] leading-none">Kestrel</p>
              <p className="royal-label mt-1 text-[9px]">Private residences</p>
            </div>
          </div>
          <nav
            className="ml-auto hidden items-center gap-7 md:flex"
            aria-label="Preview navigation"
          >
            {["Residence", "Interiors", "Finishes", "Your build"].map((item, i) => (
              <span
                key={item}
                className={cn(
                  "text-[10.5px] tracking-[0.24em] uppercase",
                  i === 3 ? "border-b pb-1" : "opacity-80",
                )}
                style={i === 3 ? { borderColor: "var(--r-metal)" } : undefined}
              >
                {item}
              </span>
            ))}
          </nav>
          <span className="royal-chip royal-chip--hero">Private client</span>
        </div>

        <div className="max-w-3xl">
          <p className="royal-label">Private residence · {f.city}</p>
          <h3 className="royal-display mt-4 text-[clamp(46px,8cqi,104px)]">
            {f.projectName.split(" ")[0]}{" "}
            <span className={accent}>{f.projectName.split(" ").slice(1).join(" ")}</span>
          </h3>
          <p className="mt-5 max-w-lg text-[15px] leading-relaxed opacity-90">
            {f.bedrooms ?? 4} bedrooms, {f.bathrooms ?? 3} bathrooms and{" "}
            {f.floorArea?.toLocaleString("en-US") ?? "3,200"} square feet, being built for you and
            recorded here, stage by stage.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" className="royal-btn royal-btn--metal">
              View your residence
            </button>
            <button type="button" className="royal-btn royal-btn--ghost">
              Book a private viewing
            </button>
          </div>
        </div>

        <dl className="royal-hero__figures grid grid-cols-3">
          {[
            ["Completion", `${f.progress.toFixed(1)}%`],
            ["Forecast handover", f.handover],
            ["Contract value", formatCurrency(f.contractRevised, "USD")],
          ].map(([label, value]) => (
            <div key={label} className="px-4 pt-5 first:pl-0">
              <dt className="royal-label">{label}</dt>
              <dd className="royal-display royal-num mt-2 text-[clamp(20px,3cqi,34px)]">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </header>
  );
}

function Monogram({ crest }: { crest: boolean }) {
  return (
    <span className="relative grid size-12 shrink-0 place-items-center">
      <svg viewBox="0 0 48 48" className="absolute inset-0" aria-hidden="true">
        <circle cx="24" cy="24" r="23" fill="none" stroke="var(--r-metal)" strokeWidth="1" />
        <circle cx="24" cy="24" r="19.5" fill="none" stroke="var(--r-metal)" strokeWidth="0.6" />
        {crest ? (
          <path
            d="M17 13.5 L19 9 L21.5 12 L24 7.5 L26.5 12 L29 9 L31 13.5 Z"
            fill="var(--r-metal)"
          />
        ) : null}
      </svg>
      <span className="royal-display relative text-[20px]" style={{ color: "var(--r-metal)" }}>
        K
      </span>
    </span>
  );
}

function SectionHead({
  eyebrow,
  title,
  accent,
  onDeep = false,
  glyph,
}: {
  eyebrow: string;
  title: string;
  accent: string;
  onDeep?: boolean;
  glyph: "crown" | "diamond";
}) {
  const [first, ...rest] = title.split(" ");
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="royal-label">{eyebrow}</p>
      <h3 className="royal-display mt-3 text-[clamp(30px,4.6cqi,54px)]">
        {first} <span className={accent}>{rest.join(" ")}</span>
      </h3>
      <div className="royal-rule mx-auto mt-5 max-w-[220px]" aria-hidden="true">
        {glyph === "crown" ? (
          <svg viewBox="0 0 24 12" className="h-3 w-6">
            <path d="M2 11 L4 3 L8 7 L12 1 L16 7 L20 3 L22 11 Z" fill="currentColor" />
          </svg>
        ) : (
          <span
            className="block size-2 rotate-45"
            style={{ backgroundColor: onDeep ? "var(--r-metal)" : "currentColor" }}
          />
        )}
      </div>
    </div>
  );
}

function Residence({
  photo,
  kind,
  name,
  spec,
  price,
}: {
  photo: RoyalPhoto;
  kind: string;
  name: string;
  spec: string;
  price: string;
}) {
  return (
    <article className="royal-card flex flex-col p-3">
      <div className="royal-frame aspect-[4/3]">
        <img src={photoUrl(photo, 1200)} alt={photo.alt} className="royal-photo" loading="lazy" />
      </div>
      <div className="flex flex-1 flex-col gap-3 px-4 pt-6 pb-5">
        <p className="royal-label">{kind}</p>
        <h4 className="royal-display text-[28px]">{name}</h4>
        <p className="text-[13px] leading-relaxed" style={{ color: "var(--r-ink-2)" }}>
          {spec}
        </p>
        <div className="mt-auto flex items-end justify-between gap-4 pt-3">
          <p className="royal-display royal-num text-[22px]">{price}</p>
          <button type="button" className="royal-btn royal-btn--text">
            Arrange a viewing
          </button>
        </div>
      </div>
    </article>
  );
}

function Interiors() {
  const tiles: Array<{ photo: RoyalPhoto; room: string; className: string }> = [
    { photo: ROYAL_PHOTOS.living, room: "Drawing room", className: "md:col-span-4 md:row-span-2" },
    { photo: ROYAL_PHOTOS.bedroom, room: "Principal suite", className: "md:col-span-2" },
    { photo: ROYAL_PHOTOS.bathroom, room: "Marble bath", className: "md:col-span-2" },
    { photo: ROYAL_PHOTOS.dining, room: "Dining room", className: "md:col-span-3" },
    { photo: ROYAL_PHOTOS.kitchen, room: "Kitchen", className: "md:col-span-3" },
  ];

  return (
    <div className="mx-auto mt-10 grid max-w-6xl auto-rows-[220px] grid-cols-1 gap-3 md:grid-cols-6">
      {tiles.map((tile) => (
        <figure key={tile.room} className={cn("group relative", tile.className)}>
          <div className="royal-frame size-full">
            <img
              src={photoUrl(tile.photo, 1400)}
              alt={tile.photo.alt}
              className="royal-photo transition-transform duration-700 group-hover:scale-[1.03]"
              loading="lazy"
            />
          </div>
          <figcaption
            className="royal-label absolute bottom-3 left-3 px-2.5 py-1.5"
            style={{ backgroundColor: "var(--r-surface)", color: "var(--r-ink)" }}
          >
            {tile.room}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function Finishes() {
  const items: Array<{
    room: string;
    name: string;
    detail: string;
    price: string;
    due: string;
    photo?: RoyalPhoto;
    swatch?: string;
    chosen?: boolean;
  }> = [
    {
      room: "Drawing room",
      name: "Velvet sofa",
      detail: "Hand-tufted, deep-pile velvet on a solid walnut frame.",
      price: "+$4,200",
      due: "Choose by 19 Sep",
      photo: ROYAL_PHOTOS.sofa,
    },
    {
      room: "Principal bath",
      name: "Calacatta marble",
      detail: "Book-matched slabs, honed finish, walls and vanity.",
      price: "+$6,800",
      due: "Choose by 21 Sep",
      swatch: "royal-swatch--marble",
    },
    {
      room: "Throughout",
      name: "Brushed brass",
      detail: "Door furniture, taps and switch plates in unlacquered brass.",
      price: "+$1,150",
      due: "Choose by 28 Sep",
      swatch: "royal-swatch--brass",
    },
    {
      room: "Living floors",
      name: "Smoked oak herringbone",
      detail: "Wide-plank European oak, laid by hand in herringbone.",
      price: "Included",
      due: "Chosen",
      swatch: "royal-swatch--oak",
      chosen: true,
    },
  ];

  return (
    <div className="mx-auto mt-10 grid max-w-6xl gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <article
          key={item.name}
          className="flex flex-col"
          style={{
            border: "1px solid color-mix(in oklab, var(--r-metal) 45%, transparent)",
            borderRadius: "var(--r-radius)",
          }}
        >
          <div className="royal-frame aspect-[4/3]" style={{ borderRadius: 0 }}>
            {item.photo ? (
              <img
                src={photoUrl(item.photo, 900)}
                alt={item.photo.alt}
                className="royal-photo"
                style={{ borderRadius: 0 }}
                loading="lazy"
              />
            ) : (
              <div className={cn("size-full", item.swatch)} role="img" aria-label={item.name} />
            )}
          </div>
          <div className="flex flex-1 flex-col gap-2 p-5">
            <p className="royal-label">{item.room}</p>
            <h4 className="royal-display text-[22px]">{item.name}</h4>
            <p className="text-[12.5px] leading-relaxed opacity-80">{item.detail}</p>
            <div className="mt-auto flex items-center justify-between gap-3 pt-4">
              <span className="royal-display royal-num text-[18px]">{item.price}</span>
              <span
                className="royal-chip"
                style={{
                  borderColor: item.chosen
                    ? "var(--r-metal)"
                    : "color-mix(in oklab, var(--r-deep-ink) 35%, transparent)",
                  color: item.chosen ? "var(--r-metal)" : "var(--r-deep-ink)",
                }}
              >
                {item.chosen ? "✓ " : ""}
                {item.due}
              </span>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function YourBuild({ f }: { f: RoyalFigures }) {
  const R = 58;
  const circumference = 2 * Math.PI * R;
  const offset = circumference * (1 - f.progress / 100);

  return (
    <div className="mx-auto mt-10 grid max-w-6xl gap-5 lg:grid-cols-[0.9fr_1.6fr]">
      <div className="flex flex-col gap-5">
        <div className="royal-card flex flex-col items-center gap-5 px-6 py-8 text-center">
          <p className="royal-label">Overall completion</p>
          <div className="relative size-[160px]">
            <svg viewBox="0 0 140 140" className="size-full -rotate-90" aria-hidden="true">
              <circle cx="70" cy="70" r={R} fill="none" stroke="var(--r-line)" strokeWidth="2" />
              <circle
                cx="70"
                cy="70"
                r={R}
                fill="none"
                stroke="var(--r-metal)"
                strokeWidth="3"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
              />
            </svg>
            <span className="royal-display royal-num absolute inset-0 grid place-items-center text-[40px]">
              {f.progress.toFixed(1)}%
            </span>
          </div>
          <div className="w-full">
            <div className="royal-meter">
              <div className="royal-meter__fill" style={{ width: `${f.planned}%` }} />
            </div>
            <p className="mt-3 text-[12px]" style={{ color: "var(--r-ink-2)" }}>
              The programme expects {f.planned.toFixed(1)}% by today
            </p>
          </div>
        </div>

        <div className="royal-deep flex flex-col gap-2 px-6 py-6">
          <p className="royal-label">Next stage payment</p>
          <p className="royal-display royal-num text-[34px]">
            {formatCurrency(f.nextPaymentAmount, "USD")}
          </p>
          <p className="text-[13px] opacity-85">
            {f.nextPaymentName} · {f.nextPaymentDue}
          </p>
          <div className="mt-3">
            <button type="button" className="royal-btn royal-btn--metal">
              Review &amp; approve
            </button>
          </div>
        </div>
      </div>

      <div className="royal-card flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="royal-label">Payment schedule</p>
            <h4 className="royal-display mt-2 text-[26px]">Stage by stage</h4>
          </div>
          <span className="royal-chip royal-chip--metal">Escrow protected</span>
        </div>

        <div className="overflow-x-auto">
          <table className="royal-table">
            <thead>
              <tr>
                <th>Stage</th>
                <th>Due</th>
                <th style={{ textAlign: "right" }}>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {f.payments.map((p) => (
                <tr key={p.name}>
                  <td style={{ fontWeight: 500 }}>{p.name}</td>
                  <td style={{ color: "var(--r-ink-3)" }}>{p.due}</td>
                  <td className="royal-num" style={{ textAlign: "right", fontWeight: 500 }}>
                    {formatCurrency(p.amount, "USD")}
                  </td>
                  <td>
                    <span
                      className={cn(
                        "royal-chip",
                        p.status === "Paid" && "royal-chip--good",
                        p.status === "Invoiced" && "royal-chip--warn",
                        p.status === "Overdue" && "royal-chip--bad",
                      )}
                    >
                      {p.status === "Paid" ? "✓ " : p.status === "Overdue" ? "! " : ""}
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="block">
            <span className="royal-label">Ask your site manager</span>
            <input
              className="royal-input mt-1"
              placeholder="When will the marble arrive?"
              readOnly
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="royal-btn royal-btn--deep">
              Send
            </button>
            <button type="button" className="royal-btn royal-btn--ghost">
              Book a visit
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="royal-chip royal-chip--good">✓ Inspection passed</span>
          <span className="royal-chip royal-chip--warn">▲ Decision due</span>
          <span className="royal-chip royal-chip--bad">■ Blocked</span>
          <span className="royal-chip">◇ Not started</span>
        </div>
      </div>
    </div>
  );
}

function Specimen({ theme, f, accent }: { theme: RoyalTheme; f: RoyalFigures; accent: string }) {
  return (
    <div className="border-t pt-10" style={{ borderColor: "var(--r-line)" }}>
      <p className="royal-label">Type specimen</p>
      <p className="royal-display mt-4 text-[clamp(40px,7cqi,76px)]">{f.projectName}</p>
      <p className={cn("royal-display mt-2 text-[26px]", accent)}>
        The principal suite is plastered and drying
      </p>
      <p className="mt-4 max-w-xl text-[14px] leading-relaxed" style={{ color: "var(--r-ink-2)" }}>
        The Calacatta slabs for the principal bath were selected at the quarry this week and are
        booked for templating once the walls are dry. Your site manager has photographed each slab
        so you can approve the veining before it is cut.
      </p>
      <p className="royal-label mt-4">
        {theme.name} · {DISPLAY_NAMES[theme.display]} &amp; Jost
      </p>
    </div>
  );
}
