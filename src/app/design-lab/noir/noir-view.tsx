/* eslint-disable @next/next/no-img-element -- remote editorial photography for
   this preview only. The image optimiser is deliberately restricted to
   Supabase storage; widening it for a design study would let any Unsplash URL
   be proxied through production. */
import * as React from "react";

import { cn } from "@/lib/utils";

import { NOIR, noirUrl, type NoirPhoto } from "./noir-photos";

export type NoirTone = "good" | "warn" | "critical" | "open";

export interface NoirData {
  projectName: string;
  buyerName: string;
  address: string;
  coords: string | null;
  siteTime: string;
  day: number;
  totalDays: number;
  week: number;
  progress: number;
  planned: number;
  contractValue: string;
  changesNote: string;
  contractDate: string;
  forecastDate: string | null;
  slipDays: number | null;
  delayReasons: Array<{ label: string; detail: string }>;
  residence: {
    headline: string;
    description: string;
    floorArea: string | null;
    rows: Array<[string, string]>;
  };
  stages: Array<{
    n: number;
    name: string;
    progress: number;
    state: "done" | "current" | "upcoming";
  }>;
  currentStage: number;
  nextPayment: { name: string; amount: string; due: string } | null;
  payments: Array<{
    n: number;
    name: string;
    share: string;
    date: string;
    amount: string;
    tone: NoirTone;
    status: string;
  }>;
  decisions: Array<{
    id: string;
    name: string;
    choice: string;
    delta: string;
    deadline: string;
    tone: NoirTone;
    status: string;
    thumb: NoirPhoto | null;
  }>;
  decisionSummary: { open: number; decided: number; total: number; impact: string };
}

const NAV = ["Overview", "Residence", "Decisions", "Payments", "Documents"];

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Noir Editorial, applied to Kestrel House.
 *
 * Black and white bands on a broken twelve-column grid. Photographs overlap
 * text blocks by exactly one column, so the grid is broken on purpose and
 * never by accident; the oversized type is always a real figure from the
 * build -- the floor area, the slip, the open decisions, the completion.
 */
export function NoirView({ d }: { d: NoirData }) {
  return (
    <div className="noir">
      <Hero d={d} />
      <Residence d={d} />
      <Interiors />
      <Programme d={d} />
      <Decisions d={d} />
      <Build d={d} />
      <Colophon />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Photo({
  photo,
  width,
  className,
  eager = false,
  children,
}: {
  photo: NoirPhoto;
  width: number;
  className?: string;
  eager?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("noir-frame", className)}>
      <img
        src={noirUrl(photo, width)}
        alt={photo.alt}
        className="noir-photo"
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
      />
      {children}
    </div>
  );
}

function Caption({ title, note }: { title: string; note: string }) {
  return (
    <figcaption className="noir-caption">
      <strong>{title}</strong>
      <span>{note}</span>
    </figcaption>
  );
}

/* ---- Hero ------------------------------------------------------------------ */

function Hero({ d }: { d: NoirData }) {
  const slipping = d.slipDays != null && d.slipDays > 0;
  const [first, ...rest] = d.projectName.split(" ");
  const remainder = rest.join(" ");
  const firstName = d.buyerName.split(" ")[0];

  return (
    <header className="noir-band noir-dark noir-hero">
      <div className="noir-grid pt-5">
        <div className="noir-runline">
          <span className="noir-wordmark col-span-6 uppercase lg:col-span-3">Kestrel</span>
          <nav className="noir-nav hidden lg:col-span-6 lg:flex" aria-label="Preview navigation">
            {NAV.map((item, i) => (
              <span key={item} aria-current={i === 0 ? "page" : undefined}>
                {item}
              </span>
            ))}
          </nav>
          <span className="col-span-6 text-right lg:col-span-3">
            Private client · {d.buyerName}
          </span>
        </div>
      </div>

      <div className="noir-grid noir-hero__grid">
        <figure className="noir-hero__photo col-span-12 lg:col-span-8 lg:col-start-5 lg:row-span-3 lg:row-start-1">
          <Photo photo={NOIR.hero} width={2000} eager className="noir-hero__frame">
            <div className="noir-grain" aria-hidden="true" />
          </Photo>
        </figure>

        <h1 className="noir-hero__word col-span-12 -mt-[0.35em] lg:row-start-2 lg:mt-0">
          {first}
          {remainder ? <span className="sr-only"> {remainder}</span> : null}
        </h1>

        <div className="noir-card col-span-12 flex flex-col gap-5 self-end lg:col-span-4 lg:col-start-2 lg:row-start-3">
          {remainder ? (
            <p className="noir-hero__rest" aria-hidden="true">
              {remainder}
            </p>
          ) : null}
          <p className="noir-body">
            A private residence at {d.address}, being built for {firstName} and recorded here stage
            by stage — every payment, decision and photograph.
          </p>
        </div>
      </div>

      <div className="noir-grid">
        <dl className="noir-figures">
          <Figure
            className="col-span-12 sm:col-span-4 lg:col-span-3"
            label="Complete"
            value={d.progress.toFixed(1)}
            unit="%"
            note={`Programme expects ${d.planned.toFixed(1)}%`}
          />
          <Figure
            className="col-span-12 sm:col-span-4 lg:col-span-4 lg:col-start-5"
            label="Forecast handover"
            value={d.forecastDate ?? d.contractDate}
            note={slipping ? `${d.slipDays} days past contract` : "On the contract date"}
            gold={slipping}
          />
          <Figure
            className="col-span-12 sm:col-span-4 lg:col-span-3 lg:col-start-10"
            label="Contract value"
            value={d.contractValue}
            note={d.changesNote}
          />
        </dl>

        <p className="noir-runline">
          <span className="col-span-6 lg:col-span-2">
            Day {d.day} of {d.totalDays}
          </span>
          <span className="col-span-6 lg:col-span-2">Week {d.week}</span>
          <span className="col-span-6 lg:col-span-2">
            Stage {pad(d.currentStage)} of {pad(d.stages.length)}
          </span>
          <span className="col-span-6 lg:col-span-2">{d.coords ?? d.address}</span>
          <span className="col-span-12 lg:col-span-4 lg:text-right">Site time {d.siteTime}</span>
        </p>
      </div>
    </header>
  );
}

function Figure({
  label,
  value,
  unit,
  note,
  gold = false,
  className,
}: {
  label: string;
  value: string;
  unit?: string;
  note: string;
  gold?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("noir-fig", className)}>
      <dt className="noir-label">{label}</dt>
      <dd className="noir-fig__value">
        {value}
        {unit ? <span className="noir-fig__unit">{unit}</span> : null}
      </dd>
      <dd className={cn("noir-label", gold && "noir-gold-text")}>{note}</dd>
    </div>
  );
}

/* ---- Residence (white band) ---------------------------------------------------- */

function Residence({ d }: { d: NoirData }) {
  const r = d.residence;

  return (
    <section className="noir-band noir-light noir-section" aria-labelledby="noir-residence">
      <div className="noir-grid">
        <div className="noir-runline">
          <span className="col-span-12 lg:col-span-3">The residence</span>
          <span className="col-span-12 lg:col-span-6">{d.address}</span>
          <span className="col-span-12 lg:col-span-3 lg:text-right">
            {r.floorArea ? `${r.floorArea} sq ft interior` : "Interior area to be confirmed"}
          </span>
        </div>
      </div>

      <div className="noir-grid gap-y-10 pt-12">
        {r.floorArea ? (
          <p className="noir-giant col-span-12 lg:row-start-1" aria-hidden="true">
            {r.floorArea}
            <span className="noir-giant__unit">sq ft</span>
          </p>
        ) : null}

        <figure className="noir-residence__photo col-span-12 lg:col-span-7 lg:col-start-6 lg:row-span-2 lg:row-start-1">
          <Photo photo={NOIR.residence} width={1600} className="aspect-[4/3]" />
          <Caption title="Reference" note="The finished elevation, after dark" />
        </figure>

        <div className="noir-card col-span-12 flex flex-col gap-7 self-start lg:col-span-6 lg:col-start-1 lg:row-start-2">
          <h2 id="noir-residence" className="noir-h2">
            {r.headline}
          </h2>
          <p className="noir-body">{r.description}</p>
          <dl className="noir-dl">
            {r.rows.map(([term, value]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

/* ---- Interiors (black band, collage) ------------------------------------------- */

function Interiors() {
  return (
    <section className="noir-band noir-dark noir-section" aria-labelledby="noir-interiors">
      <p className="noir-vertical hidden lg:block" aria-hidden="true">
        Interiors
      </p>

      <div className="noir-grid">
        <div className="noir-runline">
          <span className="col-span-12 lg:col-span-4 lg:col-start-2">Reference interiors</span>
          <span className="col-span-12 lg:col-span-4">Graded to one palette</span>
          <span className="col-span-12 lg:col-span-3 lg:text-right">
            Not photographs of Kestrel House
          </span>
        </div>
      </div>

      <div className="noir-grid gap-y-10 pt-12">
        <div className="col-span-12 flex flex-col gap-6 self-start lg:col-span-4 lg:col-start-2 lg:row-start-1">
          <h2 id="noir-interiors" className="noir-h2">
            The specification, in low light.
          </h2>
          <p className="noir-body">
            Mood references for the finishes you are choosing. The progress photographs from site
            live in Updates.
          </p>
        </div>

        <figure className="col-span-12 lg:col-span-7 lg:col-start-6 lg:row-span-2 lg:row-start-1">
          <Photo photo={NOIR.living} width={1600} className="aspect-[4/3]" />
          <Caption title="Drawing room" note="Marble fireplace, limewash" />
        </figure>

        <figure className="noir-collage__kitchen z-10 col-span-12 sm:col-span-6 lg:col-span-4 lg:col-start-3 lg:row-span-2 lg:row-start-2">
          <Photo photo={NOIR.kitchen} width={900} className="aspect-[4/5]" />
          <Caption title="Kitchen" note="Black oak, Nero Marquina" />
        </figure>

        <figure className="noir-collage__bedroom z-10 col-span-12 sm:col-span-6 lg:col-span-3 lg:col-start-8 lg:row-start-3">
          <Photo photo={NOIR.bedroom} width={800} className="aspect-[4/5]" />
          <Caption title="Principal bedroom" note="Linen, full blackout" />
        </figure>

        <figure className="noir-collage__stair col-span-12 sm:col-span-6 lg:col-span-2 lg:col-start-11 lg:row-start-3">
          <Photo photo={NOIR.stair} width={600} className="aspect-[3/4]" />
          <Caption title="Stair" note="Oak treads" />
        </figure>
      </div>
    </section>
  );
}

/* ---- Programme (navy band) ------------------------------------------------------ */

function Programme({ d }: { d: NoirData }) {
  const slipping = d.slipDays != null && d.slipDays > 0;

  return (
    <section className="noir-band noir-navy noir-section" aria-labelledby="noir-programme">
      <div className="noir-grid">
        <div className="noir-runline">
          <span className="col-span-12 lg:col-span-3">Programme</span>
          <span className="col-span-6 lg:col-span-3">Contract · {d.contractDate}</span>
          <span className="col-span-6 lg:col-span-3">
            Forecast · {d.forecastDate ?? d.contractDate}
          </span>
          <span className="col-span-12 lg:col-span-3 lg:text-right">
            Day {d.day} of {d.totalDays}
          </span>
        </div>
      </div>

      <div className="noir-grid gap-y-10 pt-12">
        <p className="noir-giant col-span-12 lg:col-span-8 lg:row-start-1" aria-hidden="true">
          {slipping ? `+${d.slipDays}` : "0"}
          <span className="noir-giant__unit">days</span>
        </p>

        <figure className="noir-programme__photo z-10 col-span-6 lg:col-span-3 lg:col-start-6 lg:row-start-1">
          <Photo photo={NOIR.programme} width={800} className="aspect-[3/4]" />
        </figure>

        <div className="col-span-12 flex flex-col gap-8 self-end lg:col-span-4 lg:col-start-9 lg:row-start-1">
          <h2 id="noir-programme" className="noir-h2">
            {slipping
              ? `Forecast completion is ${d.slipDays} days past your contract date.`
              : "Forecast completion is on your contract date."}
          </h2>
          {d.delayReasons.length > 0 ? (
            <ul className="noir-reasons">
              {d.delayReasons.slice(0, 3).map((reason) => (
                <li key={reason.label}>
                  <strong>{reason.label}</strong>
                  {reason.detail}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/* ---- Decisions (white band) ------------------------------------------------------ */

function Decisions({ d }: { d: NoirData }) {
  const s = d.decisionSummary;

  return (
    <section className="noir-band noir-light noir-section" aria-labelledby="noir-decisions">
      <div className="noir-grid">
        <div className="noir-runline">
          <span className="col-span-12 lg:col-span-3">Decisions</span>
          <span className="col-span-6 lg:col-span-3">
            {s.decided} of {s.total} decided
          </span>
          <span className="col-span-6 lg:col-span-6 lg:text-right">
            {s.impact} against the standard specification
          </span>
        </div>
      </div>

      <div className="noir-grid gap-y-12 pt-12">
        <div className="col-span-12 flex flex-col gap-6 lg:col-span-4">
          <p className="noir-giant noir-giant--emerald" aria-hidden="true">
            {pad(s.open)}
          </p>
          <h2 id="noir-decisions" className="noir-h2">
            <span className="sr-only">{s.open} </span>
            Finishes still to choose.
          </h2>
          <p className="noir-body">
            Each date is when the work that needs the choice starts, less the supplier&apos;s lead
            time. Miss it and the standard option is fitted.
          </p>
          <div>
            <button type="button" className="noir-btn">
              Open selections
            </button>
          </div>
        </div>

        <div className="noir-table-wrap col-span-12 lg:col-span-7 lg:col-start-6">
          <table className="noir-table">
            <thead>
              <tr>
                <th scope="col">Decision</th>
                <th scope="col">Your choice</th>
                <th scope="col" className="is-right">
                  Against standard
                </th>
                <th scope="col">Needed by</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {d.decisions.map((row) => (
                <tr key={row.id}>
                  <td>
                    <span className="flex items-center gap-4">
                      <span className="noir-frame noir-thumb">
                        {row.thumb ? (
                          <img
                            src={noirUrl(row.thumb, 128, 64 / 44)}
                            alt=""
                            className="noir-photo"
                            loading="lazy"
                          />
                        ) : null}
                      </span>
                      <span>{row.name}</span>
                    </span>
                  </td>
                  <td style={{ color: row.choice === "Undecided" ? "var(--fg-3)" : "var(--fg-2)" }}>
                    {row.choice}
                  </td>
                  <td className="noir-num is-right">{row.delta}</td>
                  <td className="noir-num">{row.deadline}</td>
                  <td>
                    <span className={cn("noir-status", `noir-status--${row.tone}`)}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/* ---- Build (black band) ------------------------------------------------------------ */

function Build({ d }: { d: NoirData }) {
  const variance = d.progress - d.planned;

  return (
    <section className="noir-band noir-dark noir-section" aria-labelledby="noir-build">
      <div className="noir-grid">
        <div className="noir-runline">
          <span className="col-span-12 lg:col-span-3">Build progress</span>
          <span className="col-span-6 lg:col-span-3">
            Stage {pad(d.currentStage)} of {pad(d.stages.length)}
          </span>
          <span className="col-span-6 lg:col-span-6 lg:text-right">
            Plan {d.planned.toFixed(1)}% · {Math.abs(variance).toFixed(1)} points{" "}
            {variance < 0 ? "behind" : "ahead"}
          </span>
        </div>
      </div>

      <h2 id="noir-build" className="sr-only">
        Build progress: {d.progress.toFixed(1)} percent complete
      </h2>

      <div className="noir-grid gap-y-10 pt-12">
        <p
          className="noir-giant noir-giant--bleed col-span-12 lg:col-span-9 lg:col-start-4 lg:row-start-1"
          aria-hidden="true"
        >
          {d.progress.toFixed(1)}
        </p>

        {d.nextPayment ? (
          <div className="noir-card noir-light z-10 col-span-12 flex flex-col gap-4 self-end lg:col-span-4 lg:col-start-1 lg:row-start-1">
            <p className="noir-label">Next stage payment</p>
            <p className="noir-fig__value">{d.nextPayment.amount}</p>
            <p className="text-[15px]" style={{ color: "var(--fg-2)" }}>
              {d.nextPayment.name} · due {d.nextPayment.due}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <button type="button" className="noir-btn noir-btn--gold">
                Review payment
              </button>
              <button type="button" className="noir-btn">
                Invoice
              </button>
            </div>
          </div>
        ) : null}

        <div className="col-span-12 flex flex-col gap-3 lg:col-span-9 lg:col-start-4">
          <div
            className="noir-meter"
            role="img"
            aria-label={`${d.progress.toFixed(1)} percent complete against ${d.planned.toFixed(1)} percent planned`}
          >
            <div className="noir-meter__fill" style={{ width: `${d.progress}%` }} />
            <div className="noir-meter__mark" style={{ left: `${d.planned}%` }} />
          </div>
          <p className="noir-label">% complete · gold mark is the plan for today</p>
        </div>

        <ol
          className="noir-stages col-span-12 pt-10"
          aria-label="Build stages"
          style={{ "--stage-count": String(d.stages.length) } as React.CSSProperties}
        >
          {d.stages.map((stage) => (
            <li key={stage.n} className={cn("noir-stage", `noir-stage--${stage.state}`)}>
              <div className="noir-stage__bar">
                <div className="noir-stage__fill" style={{ width: `${stage.progress}%` }} />
              </div>
              <p className="noir-num text-[11px]" style={{ color: "var(--fg-3)" }}>
                {pad(stage.n)}
              </p>
              <p className="mt-1 text-[14px] leading-snug">{stage.name}</p>
              <p
                className={cn(
                  "noir-num mt-1 text-[11px]",
                  stage.state === "current" && "noir-gold-text",
                )}
                style={stage.state === "current" ? undefined : { color: "var(--fg-3)" }}
              >
                {stage.state === "done"
                  ? "Complete"
                  : stage.state === "current"
                    ? `${Math.round(stage.progress)}% built`
                    : "Upcoming"}
              </p>
            </li>
          ))}
        </ol>

        <div className="col-span-12 flex flex-col gap-6 pt-10">
          <p className="noir-label">Stage payments</p>
          <div className="noir-table-wrap">
            <table className="noir-table">
              <thead>
                <tr>
                  <th scope="col">No.</th>
                  <th scope="col">Stage</th>
                  <th scope="col" className="is-right">
                    Share
                  </th>
                  <th scope="col">Date</th>
                  <th scope="col" className="is-right">
                    Amount
                  </th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {d.payments.map((p) => (
                  <tr key={p.n}>
                    <td className="noir-num" style={{ color: "var(--fg-3)" }}>
                      {pad(p.n)}
                    </td>
                    <td>{p.name}</td>
                    <td className="noir-num is-right" style={{ color: "var(--fg-2)" }}>
                      {p.share}
                    </td>
                    <td className="noir-num" style={{ color: "var(--fg-2)" }}>
                      {p.date}
                    </td>
                    <td className="noir-num is-right">{p.amount}</td>
                    <td>
                      <span className={cn("noir-status", `noir-status--${p.tone}`)}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="col-span-12 flex flex-col gap-6 pt-6 lg:col-span-5">
          <label className="noir-field">
            <span className="noir-label">Ask your site manager</span>
            <input type="text" placeholder="When is the marble being templated?" />
          </label>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="noir-btn noir-btn--gold">
              Send question
            </button>
            <button type="button" className="noir-btn">
              Book a site visit
            </button>
          </div>
        </div>

        <div className="col-span-12 flex flex-col gap-5 pt-6 lg:col-span-5 lg:col-start-8">
          <p className="noir-label">How states read</p>
          <div className="flex flex-wrap gap-x-7 gap-y-3">
            <span className="noir-status noir-status--good">Paid</span>
            <span className="noir-status noir-status--warn">Due this week</span>
            <span className="noir-status noir-status--critical">Overdue</span>
            <span className="noir-status noir-status--open">Upcoming</span>
          </div>
          <p className="noir-body text-[14px]">
            Emerald means done, gold means act now, an inverted chip means late. Every state is a
            mark and a word, so none of them depends on colour alone.
          </p>
        </div>
      </div>
    </section>
  );
}

function Colophon() {
  return (
    <footer className="noir-band noir-dark pb-14">
      <div className="noir-grid">
        <div className="noir-runline">
          <span className="col-span-12 lg:col-span-3">Colophon</span>
          <span className="col-span-12 lg:col-span-6">
            Schibsted Grotesk &amp; DM Mono · twelve columns, broken by one
          </span>
          <span className="col-span-12 lg:col-span-3 lg:text-right">Photography · Unsplash</span>
        </div>
      </div>
    </footer>
  );
}
