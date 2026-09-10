import { ArrowRight, Banknote, CalendarRange, FileText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { CinePhoto } from "@/components/ui/cine-photo";
import type { SceneKey } from "@/lib/scenes";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: { absolute: "Kestrel — Your home, built in the open" },
};

const NAV = [
  { href: "#residences", label: "Residences" },
  { href: "#platform", label: "The platform" },
  { href: "#assistant", label: "Assistant" },
];

/** Oppenheim-style tabs across the foot of the hero: what Kestrel shows you. */
const TABS = [
  { href: "#platform", label: "Schedule" },
  { href: "#platform", label: "Money" },
  { href: "#platform", label: "Quality" },
  { href: "#platform", label: "Documents" },
];

/** Figures from the demo project -- real numbers from the seeded build. */
const FIGURES = [
  { label: "Complete", value: "55.4", unit: "%", note: "Programme expects 59.4%" },
  { label: "Forecast slip", value: "+28", unit: "days", note: "Explained, not hidden" },
  { label: "Contract value", value: "$706,300", unit: "", note: "Every change accounted for" },
];

const RESIDENCES: Array<{
  scene: SceneKey;
  name: string;
  place: string;
  stage: string;
  spec: string;
}> = [
  {
    scene: "windowsDusk",
    name: "Kestrel House",
    place: "Austin, Texas",
    stage: "In construction · 55% complete",
    spec: "4 bed · 3.5 bath · 2,840 sq ft",
  },
  {
    scene: "pathwayDusk",
    name: "The Linden",
    place: "Westlake Hills, Texas",
    stage: "Handed over",
    spec: "5 bed · 5 bath · 4,100 sq ft",
  },
  {
    scene: "concreteNight",
    name: "Belvedere",
    place: "Barton Creek, Texas",
    stage: "Foundations",
    spec: "4 bed · 4 bath · 3,650 sq ft",
  },
];

const ROWS: Array<{
  scene: SceneKey;
  icon: typeof CalendarRange;
  kicker: string;
  lead: string;
  accent: string;
  body: string;
}> = [
  {
    scene: "fireplace",
    icon: CalendarRange,
    kicker: "Schedule",
    lead: "A programme you can",
    accent: "interrogate.",
    body: "A real critical-path model, not a picture of one. See which stages have float, which do not, and exactly what a two-week window delay does to your completion date — with the forecast shown as a range, never a date the maths cannot support.",
  },
  {
    scene: "penthouse",
    icon: Banknote,
    kicker: "Money",
    lead: "Every dollar,",
    accent: "in the open.",
    body: "Stage payments, draw requests and change orders, with the revised contract value always visible. Budget against committed and actual spend, category by category, and a lender pack that prints itself.",
  },
  {
    scene: "bath",
    icon: ShieldCheck,
    kicker: "Quality & finishes",
    lead: "Tracked from",
    accent: "first fix.",
    body: "Choose finishes against real deadlines, report a snag from your phone, and watch inspections and defects close out — so the handover list is live all build long, not assembled the week before.",
  },
];

export default function LandingPage() {
  return (
    // The landing page is a night scene whatever the reader's theme: the
    // `dark` class re-points every token inside it at the dark palette.
    <div className="dark bg-canvas text-ink flex min-h-dvh flex-col">
      {/* ---- Hero ------------------------------------------------------- */}
      <header className="relative isolate">
        <div className="relative isolate flex min-h-[86svh] flex-col overflow-hidden">
          <CinePhoto
            scene="villaDusk"
            priority
            sizes="100vw"
            className="animate-slow-drift absolute inset-0 -z-20 size-full"
          />
          {/* Three shades, each with one job: dark behind the menu; a left-side
            shade behind the headline that fades out before it reaches the
            house; and a fall-off into the black band below, so the photograph
            and the wordmark band meet without a seam. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(0,0,0,0.8)_0%,rgba(0,0,0,0.55)_28%,rgba(0,0,0,0.14)_52%,transparent_68%),linear-gradient(180deg,rgba(0,0,0,0.55)_0%,transparent_22%,transparent_62%,rgba(10,10,10,1)_100%)]"
          />

          <nav
            aria-label="Main"
            className="mx-auto flex w-full max-w-[1440px] items-center gap-6 px-5 py-5 sm:px-10"
          >
            <Link
              href="/"
              className="text-[13px] font-semibold tracking-[0.42em] text-white uppercase"
            >
              Kestrel
            </Link>
            <ul className="ml-6 hidden items-center gap-8 md:flex">
              {NAV.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="text-[12px] tracking-[0.18em] text-white/80 uppercase transition-colors hover:text-white"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="ml-auto flex items-center gap-2">
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="hidden text-white/85 sm:inline-flex"
              >
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild variant="primary" size="sm">
                <Link href="/dashboard">
                  Open the demo
                  <ArrowRight />
                </Link>
              </Button>
            </div>
          </nav>

          <div className="mx-auto mt-auto flex w-full max-w-[1440px] flex-col gap-10 px-5 pb-12 sm:px-10">
            <div className="flex flex-wrap items-end justify-between gap-8">
              <div className="max-w-xl [text-shadow:0_1px_28px_rgba(0,0,0,0.45)]">
                <p className="ui-label text-[11px] text-white/75">
                  For people having a house built
                </p>
                <h1 className="mt-4 text-[clamp(34px,4.4vw,60px)] leading-[1] tracking-[-0.035em] text-white">
                  Your home, <span className="ui-accent">built in the open.</span>
                </h1>
                <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/80">
                  The schedule, the money and the finishes your builder works from — updated as the
                  work happens, with the reasoning shown.
                </p>
              </div>

              <ul className="grid w-full grid-cols-2 gap-px sm:w-auto sm:grid-cols-4">
                {TABS.map((tab) => (
                  <li key={tab.label}>
                    <a
                      href={tab.href}
                      className="flex h-14 items-center justify-center border border-white/15 bg-black/45 px-7 text-[11px] tracking-[0.24em] text-white uppercase backdrop-blur-md transition-colors hover:border-white/40 hover:bg-black/65"
                    >
                      {tab.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* The wordmark on its own black band, directly under the photograph:
            fitted to the column edge to edge, with the house left uncovered. */}
        <div className="mx-auto w-full max-w-[1440px] px-5 pt-2 pb-10 sm:px-10">
          <FittedWordmark className="text-ink" />
        </div>
      </header>

      <main className="flex-1">
        {/* ---- Statement ------------------------------------------------ */}
        <section className="mx-auto w-full max-w-[1440px] px-5 py-24 sm:px-10">
          <div className="ui-runline grid grid-cols-12 gap-x-4 gap-y-1">
            <span className="col-span-12 sm:col-span-4">The idea</span>
            <span className="hidden sm:col-span-5 sm:block">
              Schedule · Money · Quality · Documents
            </span>
            <span className="col-span-12 sm:col-span-3 sm:text-right">Demo · no sign-up</span>
          </div>

          <div className="mt-14 grid gap-12 lg:grid-cols-12">
            <h2 className="text-ink text-[clamp(38px,5.4vw,84px)] leading-[0.98] tracking-[-0.045em] lg:col-span-8">
              Know exactly where your build is —{" "}
              <span className="ui-accent text-ink-2">without having to ask.</span>
            </h2>
            <p className="text-ink-2 max-w-md text-[16px] leading-relaxed lg:col-span-4 lg:self-end">
              Most buyers find out their house is late when it is already late. Kestrel shows the
              same picture your builder works from, as the work happens.
            </p>
          </div>

          <dl className="mt-16 grid gap-10 sm:grid-cols-3">
            {FIGURES.map((figure) => (
              <div key={figure.label} className="border-line flex flex-col gap-3 border-l pl-5">
                <dt className="ui-label text-ink-3 text-[10.5px]">{figure.label}</dt>
                <dd className="ui-display text-ink text-[clamp(44px,5vw,76px)] leading-none tracking-[-0.055em]">
                  {figure.value}
                  {figure.unit ? (
                    <span className="text-ink-3 ml-1.5 text-[0.36em] tracking-normal">
                      {figure.unit}
                    </span>
                  ) : null}
                </dd>
                <dd className="ui-label text-ink-2 text-[10.5px]">{figure.note}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ---- Featured residences ----------------------------------------- */}
        <section id="residences" className="border-line-strong scroll-mt-4 border-t">
          <div className="mx-auto w-full max-w-[1440px] px-5 py-24 sm:px-10">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <h2 className="text-ink text-[clamp(40px,5vw,76px)] leading-[0.95] tracking-[-0.045em]">
                Featured <span className="ui-accent">residences</span>
              </h2>
              <p className="ui-label text-ink-3 max-w-xs text-[10.5px] leading-relaxed">
                Example projects · photography is illustrative
              </p>
            </div>

            <ul className="mt-12 grid gap-5 md:grid-cols-3">
              {RESIDENCES.map((home) => (
                <li key={home.name}>
                  <Link
                    href="/dashboard"
                    className="group border-line relative block aspect-[4/5] overflow-hidden border"
                  >
                    <CinePhoto
                      scene={home.scene}
                      sizes="(min-width: 768px) 33vw, 100vw"
                      className="absolute inset-0 size-full transition-transform duration-[1400ms] ease-out group-hover:scale-[1.04]"
                    />
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,rgba(0,0,0,0.85)_100%)]"
                    />
                    <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-6 text-white">
                      <span className="ui-label text-[10px] text-white/70">{home.stage}</span>
                      <span className="text-[28px] leading-none tracking-[-0.035em]">
                        {home.name}
                      </span>
                      <span className="flex flex-wrap justify-between gap-2 text-[13px] text-white/75">
                        <span>{home.place}</span>
                        <span className="ui-label text-[10px]">{home.spec}</span>
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---- Platform: alternating full-bleed scenes ------------------------ */}
        <section id="platform" aria-label="The platform" className="border-line-strong border-t">
          {ROWS.map((row, index) => (
            <article
              key={row.kicker}
              className="border-line grid border-b lg:min-h-[560px] lg:grid-cols-2"
            >
              <div
                className={`group relative min-h-[320px] overflow-hidden ${index % 2 === 1 ? "lg:order-2" : ""}`}
              >
                <CinePhoto
                  scene={row.scene}
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="absolute inset-0 size-full transition-transform duration-[1400ms] ease-out group-hover:scale-[1.03]"
                />
              </div>
              <div className="flex flex-col justify-center gap-6 px-5 py-16 sm:px-10 lg:px-16">
                <p className="ui-label text-ink-3 flex items-center gap-2 text-[10.5px]">
                  <row.icon className="size-4" strokeWidth={1.5} aria-hidden="true" />
                  {row.kicker}
                </p>
                <h2 className="text-ink text-[clamp(36px,4.2vw,64px)] leading-[0.98] tracking-[-0.045em]">
                  {row.lead} <span className="ui-accent">{row.accent}</span>
                </h2>
                <p className="text-ink-2 max-w-lg text-[16px] leading-relaxed">{row.body}</p>
              </div>
            </article>
          ))}

          <div className="mx-auto grid w-full max-w-[1440px] gap-10 px-5 py-20 sm:px-10 md:grid-cols-3">
            {[
              {
                icon: FileText,
                title: "Documents that stay findable",
                body: "Permits, drawings, certificates and warranties — versioned, searchable, acknowledged.",
              },
              {
                icon: CalendarRange,
                title: "Site visits, booked properly",
                body: "Escorted sessions in the site's own time zone, confirmed by the site manager.",
              },
              {
                icon: ArrowRight,
                title: "A move-in plan that moves",
                body: "Every task timed against the forecast handover, so it slips when the build does.",
              },
            ].map((item) => (
              <div key={item.title} className="border-line flex flex-col gap-3 border-t pt-6">
                <item.icon className="text-ink size-5" strokeWidth={1.5} aria-hidden="true" />
                <h3 className="text-ink text-[20px] leading-snug tracking-[-0.02em]">
                  {item.title}
                </h3>
                <p className="text-ink-2 text-[14px] leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---- Assistant ----------------------------------------------------- */}
        <section id="assistant" className="border-line-strong scroll-mt-4 border-t">
          <div className="mx-auto grid w-full max-w-[1440px] gap-12 px-5 py-24 sm:px-10 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <p className="ui-label text-ink-3 text-[10.5px]">Grounded assistant</p>
              <h2 className="text-ink mt-5 text-[clamp(36px,4vw,60px)] leading-[0.98] tracking-[-0.045em]">
                Ask about your build. <span className="ui-accent">Get the sources.</span>
              </h2>
              <p className="text-ink-2 mt-6 max-w-md text-[16px] leading-relaxed">
                Answers come from your project&apos;s own records and cite the entries they used.
                When the records do not say, neither does the assistant.
              </p>
            </div>
            <figure className="border-line-strong flex flex-col gap-6 border-t-4 pt-8 lg:col-span-6 lg:col-start-7">
              <blockquote className="ui-accent text-ink text-[clamp(28px,3vw,42px)] leading-[1.1]">
                &ldquo;Why has the completion date moved?&rdquo;
              </blockquote>
              <p className="text-ink-2 text-[16px] leading-relaxed">
                Two things have moved it. A wet fortnight in April cost four working days on
                external work, and the rear dormer window units were short-delivered with a
                fourteen-day remake. The windows sit on the critical path, so that delay passes
                straight through to the finish date.
              </p>
              <figcaption className="flex flex-wrap gap-2">
                {["Weather log", "Issue #1", "Windows & external doors"].map((cite) => (
                  <span
                    key={cite}
                    className="ui-label border-line text-ink-2 border px-2.5 py-1 text-[10px]"
                  >
                    {cite}
                  </span>
                ))}
              </figcaption>
            </figure>
          </div>
        </section>

        {/* ---- Call to action over a scene ------------------------------------- */}
        <section className="relative isolate overflow-hidden">
          <CinePhoto
            scene="houseGlow"
            alt=""
            sizes="100vw"
            className="absolute inset-0 -z-20 size-full"
          />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-black/55" />
          <div className="mx-auto flex min-h-[520px] w-full max-w-[1440px] flex-col items-start justify-end gap-8 px-5 py-20 sm:px-10">
            <h2 className="max-w-3xl text-[clamp(44px,6vw,96px)] leading-[0.95] tracking-[-0.05em] text-white">
              Start with a live <span className="ui-accent">project.</span>
            </h2>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="primary" size="lg">
                <Link href="/dashboard">
                  Explore the demo
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="secondary" size="lg" className="text-white">
                <Link href="/signup">Create an account</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* ---- Footer with the wordmark as its floor ------------------------------ */}
      <footer className="border-line-strong overflow-hidden border-t">
        <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-start justify-between gap-8 px-5 pt-14 sm:px-10">
          <p className="text-ink-2 max-w-xs text-[14px] leading-relaxed">
            Transparent construction reporting for the person whose home is being built.
          </p>
          <ul className="ui-label text-ink-2 flex flex-wrap gap-x-8 gap-y-3 text-[10.5px]">
            <li>
              <Link href="/dashboard" className="hover:text-ink">
                Demo
              </Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-ink">
                Sign in
              </Link>
            </li>
            <li>
              <Link href="/signup" className="hover:text-ink">
                Create an account
              </Link>
            </li>
          </ul>
        </div>
        <div className="mx-auto mt-12 w-full max-w-[1440px] px-5 sm:px-10">
          <FittedWordmark className="text-surface-3" />
        </div>
        <p className="ui-label text-ink-3 mx-auto w-full max-w-[1440px] px-5 py-5 text-[10px] sm:px-10">
          Demo data is fictional · Photography from Unsplash
        </p>
      </footer>
    </div>
  );
}

/**
 * The wordmark, set to fill its column exactly.
 *
 * Sized in container units rather than viewport units: "KESTREL" in Schibsted
 * Grotesk 800 advances 4.66em, or 4.52em at -0.02em tracking (measured), so
 * 100cqi / 4.52 = 22.1cqi fills the column -- 21.5cqi leaves a 3% margin.
 * Because it is measured against its own column, it cannot overflow however
 * wide the window is, which viewport units inside a max-width column could.
 */
function FittedWordmark({ className }: { className?: string }) {
  return (
    <div className="[container-type:inline-size]">
      <p
        aria-hidden="true"
        className={cn(
          "ui-giant text-center text-[length:21.5cqi] leading-[0.8] tracking-[-0.02em] uppercase select-none",
          className,
        )}
      >
        Kestrel
      </p>
    </div>
  );
}
