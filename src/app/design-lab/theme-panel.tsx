import * as React from "react";

import { formatCurrency } from "@/lib/format";
import { scale } from "@/lib/utils";

import type { LabTheme } from "./themes";

/**
 * One theme, applied to a representative slice of the real interface.
 *
 * Every panel renders exactly the same components with exactly the same data,
 * because a fair comparison is the entire point -- if one direction gets a
 * prettier chart or fewer table rows, the comparison is about the content
 * rather than the design.
 */

export interface LabFigures {
  projectName: string;
  address: string;
  progress: number;
  planned: number;
  variance: number;
  contractRevised: number;
  budgeted: number;
  spent: number;
  committed: number;
  health: number;
  nextPaymentName: string;
  nextPaymentAmount: number;
  nextPaymentDue: string;
  openIssues: number;
  daysToTarget: number;
  curve: Array<{ planned: number; actual: number }>;
  gantt: Array<{ name: string; start: number; span: number; progress: number; critical: boolean }>;
  budget: Array<{ name: string; used: number; total: number; over: boolean }>;
  todayPct: number;
}

const FONT_NAMES: Record<LabTheme["displayFont"], string> = {
  archivo: "Archivo",
  space: "Space Grotesk",
  inter: "Inter",
  mono: "JetBrains Mono",
  fraunces: "Fraunces",
};

const FONT_STACKS: Record<LabTheme["displayFont"], string> = {
  archivo: "var(--font-archivo), system-ui, sans-serif",
  space: "var(--font-space), system-ui, sans-serif",
  inter: "var(--font-inter), system-ui, sans-serif",
  mono: "var(--font-jetbrains), ui-monospace, monospace",
  fraunces: "var(--font-fraunces), Georgia, serif",
};

export function ThemePanel({ theme, f }: { theme: LabTheme; f: LabFigures }) {
  const style = {
    ...theme.vars,
    "--lab-display-font": FONT_STACKS[theme.displayFont],
  } as React.CSSProperties;

  return (
    <section
      id={theme.id}
      aria-labelledby={`${theme.id}-heading`}
      className="border-ink scroll-mt-16 border-b-2"
    >
      {/* ---- Meta strip, in the app's own theme so it never competes ---- */}
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

        <div className="flex flex-col gap-2">
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
          <div className="flex gap-1">
            {theme.series.map((hex) => (
              <span
                key={hex}
                className="border-line size-4 border"
                style={{ backgroundColor: hex }}
                title={`chart series ${hex}`}
              />
            ))}
          </div>
          <p className="text-ink-3 max-w-[13rem] text-right text-[10px] leading-tight">
            Top: interface. Bottom: chart series, colourblind-validated against this paper.
          </p>
        </div>
      </div>

      {/* ---- The theme itself ------------------------------------------ */}
      <div
        className={`lab-panel px-5 py-8 sm:px-8 ${theme.id === "blueprint" ? "lab-panel--grid" : ""}`}
        style={style}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <AppBar theme={theme} f={f} />

          <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
            <Hero f={f} />
            <div className="grid grid-cols-2 gap-4">
              <Stat
                label="Spent to date"
                value={formatCurrency(f.spent, "USD", { compact: true })}
                sub={`${formatCurrency(f.committed, "USD", { compact: true })} committed`}
              />
              <Stat
                label="Next payment"
                value={formatCurrency(f.nextPaymentAmount, "USD", { compact: true })}
                sub={f.nextPaymentDue}
                tone="accent"
              />
              <Stat
                label="Days to target"
                value={`${f.daysToTarget}`}
                sub="Forecast 28 days late"
                tone="warn"
              />
              <Stat
                label="Open issues"
                value={`${f.openIssues}`}
                sub="1 high severity"
                tone="bad"
              />
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <Curve theme={theme} f={f} />
            <Budget theme={theme} f={f} />
          </div>

          <Gantt theme={theme} f={f} />

          <Components theme={theme} />
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function AppBar({ theme, f }: { theme: LabTheme; f: LabFigures }) {
  return (
    <header
      className="lab-card flex flex-wrap items-center gap-3 px-4 py-3"
      style={{ background: "var(--lab-ink)", color: "var(--lab-paper)" }}
    >
      <span
        className="lab-display grid size-9 shrink-0 place-items-center text-[17px]"
        style={{
          background: "var(--lab-accent)",
          color: "var(--lab-accent-ink)",
          borderRadius: "var(--lab-radius)",
        }}
      >
        K
      </span>
      <div className="min-w-0">
        <p className="lab-display text-[15px]">{f.projectName}</p>
        <p className="text-[11px] opacity-70">{f.address}</p>
      </div>

      <nav className="ml-auto hidden items-center gap-1 md:flex">
        {["Overview", "Timeline", "Finance", "Quality"].map((item, i) => (
          <span
            key={item}
            className="px-2.5 py-1 text-[11px] font-bold"
            style={{
              letterSpacing: "var(--lab-label-tracking)",
              textTransform: "var(--lab-label-case)" as React.CSSProperties["textTransform"],
              background: i === 0 ? "var(--lab-accent)" : "transparent",
              color: i === 0 ? "var(--lab-accent-ink)" : "inherit",
              opacity: i === 0 ? 1 : 0.72,
              borderRadius: "var(--lab-radius)",
            }}
          >
            {item}
          </span>
        ))}
      </nav>

      <span
        className="lab-chip"
        style={{
          background: "var(--lab-accent-3)",
          color: "var(--lab-accent-3-ink)",
          borderColor: theme.id === "swiss-severe" ? "var(--lab-paper)" : "var(--lab-line)",
        }}
      >
        3 new
      </span>
    </header>
  );
}

function Hero({ f }: { f: LabFigures }) {
  return (
    <div className="lab-card flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="lab-label">Overall completion</p>
          <p className="lab-display lab-num mt-1 text-[76px]">
            {f.progress.toFixed(1)}
            <span className="text-[30px]">%</span>
          </p>
        </div>
        <span className="lab-chip lab-chip--warn">{f.variance.toFixed(1)} PTS</span>
      </div>

      <div className="lab-meter">
        <div className="lab-meter__fill" style={{ width: `${f.progress}%` }} />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-[12px]" style={{ color: "var(--lab-ink-2)" }}>
          Plan expects{" "}
          <strong className="lab-num" style={{ color: "var(--lab-ink)" }}>
            {f.planned.toFixed(1)}%
          </strong>{" "}
          by today
        </p>
        <div className="text-right">
          <p className="lab-label">Contract</p>
          <p className="lab-display lab-num text-[20px]">
            {formatCurrency(f.contractRevised, "USD")}
          </p>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone = "plain",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "plain" | "accent" | "warn" | "bad";
}) {
  const accentBar = {
    plain: "var(--lab-line-soft)",
    accent: "var(--lab-accent)",
    warn: "var(--lab-warn)",
    bad: "var(--lab-bad)",
  }[tone];

  return (
    <div className="lab-card relative overflow-hidden p-4">
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: accentBar }} />
      <div className="pl-2">
        <p className="lab-label">{label}</p>
        <p className="lab-display lab-num mt-1.5 text-[26px]">{value}</p>
        <p className="mt-1 text-[11px]" style={{ color: "var(--lab-ink-3)" }}>
          {sub}
        </p>
      </div>
    </div>
  );
}

function Curve({ theme, f }: { theme: LabTheme; f: LabFigures }) {
  const W = 560;
  const H = 190;
  const M = { top: 14, right: 14, bottom: 20, left: 30 };
  const pw = W - M.left - M.right;
  const ph = H - M.top - M.bottom;

  const pt = (v: number, i: number) => ({
    x: M.left + scale(i, [0, f.curve.length - 1], [0, pw]),
    y: M.top + scale(v, [0, 100], [ph, 0]),
  });

  const path = (key: "planned" | "actual") =>
    f.curve
      .map((d, i) => {
        const p = pt(d[key], i);
        return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      })
      .join(" ");

  const last = f.curve[f.curve.length - 1]!;
  const lastActual = pt(last.actual, f.curve.length - 1);
  const lastPlanned = pt(last.planned, f.curve.length - 1);

  return (
    <div className="lab-card flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="lab-display text-[17px]">Progress against plan</h3>
          <p className="mt-0.5 text-[11px]" style={{ color: "var(--lab-ink-3)" }}>
            Weekly readings since work started
          </p>
        </div>
        <div className="flex gap-3">
          <Legend colour={theme.series[0]!} label="Planned" dashed />
          <Legend colour={theme.series[2]!} label="Actual" />
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Actual completion ${f.progress}% against a planned ${f.planned}%`}
      >
        {[0, 50, 100].map((tick) => {
          const y = M.top + scale(tick, [0, 100], [ph, 0]);
          return (
            <g key={tick}>
              <line
                x1={M.left}
                y1={y}
                x2={W - M.right}
                y2={y}
                stroke="var(--lab-line-soft)"
                strokeWidth={1}
              />
              <text
                x={M.left - 6}
                y={y + 3}
                textAnchor="end"
                fontSize={9}
                fill="var(--lab-ink-3)"
                className="lab-num"
              >
                {tick}
              </text>
            </g>
          );
        })}

        <path
          d={`${path("actual")} L${lastActual.x.toFixed(1)},${M.top + ph} L${M.left},${M.top + ph} Z`}
          fill={theme.series[2]}
          opacity={0.14}
        />
        <path
          d={path("planned")}
          fill="none"
          stroke={theme.series[0]}
          strokeWidth={2.5}
          strokeDasharray="6 4"
        />
        <path
          d={path("actual")}
          fill="none"
          stroke={theme.series[2]}
          strokeWidth={3}
          strokeLinejoin="round"
        />

        {/* Direct labels: the relief the palette obliges, and faster to read
            than a legend round-trip. */}
        <circle
          cx={lastActual.x}
          cy={lastActual.y}
          r={4}
          fill={theme.series[2]}
          stroke="var(--lab-surface)"
          strokeWidth={2}
        />
        <circle
          cx={lastPlanned.x}
          cy={lastPlanned.y}
          r={3.5}
          fill={theme.series[0]}
          stroke="var(--lab-surface)"
          strokeWidth={2}
        />
      </svg>
    </div>
  );
}

function Legend({ colour, label, dashed }: { colour: string; label: string; dashed?: boolean }) {
  return (
    <span
      className="flex items-center gap-1.5 text-[10px] font-bold"
      style={{ color: "var(--lab-ink-2)", letterSpacing: "0.06em", textTransform: "uppercase" }}
    >
      <span
        className="h-0.5 w-4"
        style={
          dashed
            ? {
                backgroundImage: `repeating-linear-gradient(90deg, ${colour} 0 4px, transparent 4px 7px)`,
              }
            : { background: colour }
        }
      />
      {label}
    </span>
  );
}

function Budget({ theme, f }: { theme: LabTheme; f: LabFigures }) {
  const max = Math.max(...f.budget.map((b) => Math.max(b.total, b.used)));

  return (
    <div className="lab-card flex flex-col gap-3 p-5">
      <div>
        <h3 className="lab-display text-[17px]">Budget vs spend</h3>
        <p className="mt-0.5 text-[11px]" style={{ color: "var(--lab-ink-3)" }}>
          Committed orders counted against budget
        </p>
      </div>

      <ul className="flex flex-col gap-2.5">
        {f.budget.map((b, i) => (
          <li key={b.name} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[11px] font-semibold" style={{ color: "var(--lab-ink-2)" }}>
                {b.name}
                {b.over ? (
                  <span className="ml-1.5" style={{ color: "var(--lab-bad)" }}>
                    OVER
                  </span>
                ) : null}
              </span>
              <span className="lab-num text-[11px] font-bold">
                {formatCurrency(b.used, "USD", { compact: true })}
                <span style={{ color: "var(--lab-ink-3)" }}>
                  {" / "}
                  {formatCurrency(b.total, "USD", { compact: true })}
                </span>
              </span>
            </div>
            <div className="relative h-3.5" style={{ background: "var(--lab-surface-2)" }}>
              <div
                style={{
                  position: "absolute",
                  inset: "0 auto 0 0",
                  width: `${(b.used / max) * 100}%`,
                  background: b.over ? "var(--lab-bad)" : theme.series[i % theme.series.length],
                }}
              />
              <span
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: `${(b.total / max) * 100}%`,
                  width: 2,
                  background: "var(--lab-ink)",
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Gantt({ theme, f }: { theme: LabTheme; f: LabFigures }) {
  return (
    <div className="lab-card flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="lab-display text-[17px]">Programme</h3>
          <p className="mt-0.5 text-[11px]" style={{ color: "var(--lab-ink-3)" }}>
            Bars show the planned window; the fill is progress. Critical milestones are marked.
          </p>
        </div>
        <span className="lab-chip lab-chip--accent">4 CRITICAL</span>
      </div>

      <div className="relative flex flex-col gap-1.5">
        {f.gantt.map((row, i) => (
          <div key={row.name} className="lab-gantt-row">
            <span
              className="flex items-center gap-1 truncate text-[11px] font-semibold"
              style={{ color: "var(--lab-ink-2)" }}
            >
              {row.critical ? (
                <span aria-label="Critical" style={{ color: "var(--lab-accent-2)" }}>
                  ▲
                </span>
              ) : (
                <span aria-hidden="true" style={{ opacity: 0 }}>
                  ▲
                </span>
              )}
              {row.name}
            </span>
            <div className="lab-gantt-track">
              <div
                className="lab-gantt-bar"
                style={{
                  left: `${row.start}%`,
                  width: `${row.span}%`,
                  color: theme.series[i % theme.series.length],
                  background: `color-mix(in oklab, ${theme.series[i % theme.series.length]} 22%, transparent)`,
                }}
              >
                <span className="lab-gantt-bar__fill" style={{ width: `${row.progress}%` }} />
              </div>
              {i === 0 ? (
                <span className="lab-gantt-today" style={{ left: `${f.todayPct}%` }} />
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Components({ theme }: { theme: LabTheme }) {
  return (
    <div className="lab-card flex flex-col gap-5 p-5">
      <h3 className="lab-display text-[17px]">Components</h3>

      <Row label="Buttons">
        <button type="button" className="lab-btn lab-btn--primary">
          Post update
        </button>
        <button type="button" className="lab-btn lab-btn--secondary">
          Approve draw
        </button>
        <button type="button" className="lab-btn">
          Export
        </button>
        <button type="button" className="lab-btn lab-btn--ghost">
          Cancel
        </button>
      </Row>

      <Row label="Status">
        <span className="lab-chip lab-chip--good">✓ Complete</span>
        <span className="lab-chip lab-chip--accent">● In progress</span>
        <span className="lab-chip lab-chip--warn">▲ Due</span>
        <span className="lab-chip lab-chip--bad">■ Blocked</span>
        <span className="lab-chip lab-chip--quiet">◇ Not started</span>
      </Row>

      <Row label="Input">
        <div className="w-full max-w-xs">
          <input className="lab-input" placeholder="Search documents…" readOnly />
        </div>
        <div className="w-40">
          <div className="lab-meter">
            <div className="lab-meter__fill lab-meter__fill--stripe" style={{ width: "62%" }} />
          </div>
        </div>
      </Row>

      <div>
        <p className="lab-label mb-2">Payment schedule</p>
        <table className="lab-table">
          <thead>
            <tr>
              <th>Stage</th>
              <th>Due</th>
              <th style={{ textAlign: "right" }}>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Framing complete", "12 Jul", "$102,750", "good", "Paid"],
              ["Weather-tight", "17 Sep", "$102,750", "warn", "Invoiced"],
              ["Services first fix", "13 Oct", "$102,750", "quiet", "Scheduled"],
            ].map(([stage, due, amount, tone, status]) => (
              <tr key={stage}>
                <td style={{ fontWeight: 600 }}>{stage}</td>
                <td style={{ color: "var(--lab-ink-3)" }}>{due}</td>
                <td className="lab-num" style={{ textAlign: "right", fontWeight: 700 }}>
                  {amount}
                </td>
                <td>
                  <span className={`lab-chip lab-chip--${tone}`}>{status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <p className="lab-label mb-2">Type scale</p>
        <p className="lab-display text-[44px] leading-[0.95]">Kestrel House</p>
        <p className="lab-display mt-1 text-[22px]">Services first fix underway</p>
        <p
          className="mt-2 max-w-xl text-[13px] leading-relaxed"
          style={{ color: "var(--lab-ink-2)" }}
        >
          The condenser slab to the north elevation went in first thing and has been protected
          overnight. Ductwork for the heat recovery system is set out through the first floor
          joists.
        </p>
        <p className="lab-label mt-2">
          {theme.name} · {FONT_NAMES[theme.displayFont]}
        </p>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="lab-label mb-2">{label}</p>
      <div className="flex flex-wrap items-center gap-2.5">{children}</div>
    </div>
  );
}
