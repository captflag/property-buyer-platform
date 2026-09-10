import { Archivo, Fraunces, Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import Link from "next/link";
import type { Metadata } from "next";

import { getWorkspace } from "@/lib/data/workspace";
import { rollUpBudget, contractPosition, summarisePayments } from "@/lib/domain/finance";
import { scoreHealth } from "@/lib/domain/forecast";
import { computeSchedule } from "@/lib/domain/schedule";
import { daysBetween, formatDate } from "@/lib/format";
import { sumBy } from "@/lib/utils";

import { LabNav } from "./lab-nav";
import { ThemePanel, type LabFigures } from "./theme-panel";
import { THEMES } from "./themes";
import "./design-lab.css";

// Loaded here rather than in the root layout: these faces exist only for the
// design lab, and shipping three extra families to every page for the sake of
// one comparison screen would be a real cost paid by every visitor.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  display: "swap",
});
const space = Space_Grotesk({
  variable: "--font-space",
  subsets: ["latin"],
  weight: ["500", "700"],
  display: "swap",
});
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});
// The app now runs on Schibsted Grotesk and DM Mono; the historical
// directions compared here still need the faces they were drawn with.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Design lab",
  robots: { index: false, follow: false },
};

const FAMILIES = [
  {
    id: "real-estate" as const,
    title: "Real estate",
    blurb:
      "Directions that speak property rather than construction site: brochures, materials boards, title deeds and show homes. Still deliberate and still hard-edged, but the register is the asset being built rather than the scaffolding around it.",
  },
  {
    id: "brutalist" as const,
    title: "Brutalist",
    blurb:
      "Directions that lead with geometry: heavy rules, hard offset shadows, severe type. Loud and unmistakably chosen, at the cost of feeling more like a tool than a home.",
  },
];

export default async function DesignLabPage() {
  const w = await getWorkspace(undefined, [
    "milestones",
    "dependencies",
    "snapshots",
    "budgetCategories",
    "costEntries",
    "changeOrders",
    "payments",
    "issues",
    "weather",
  ]);
  const now = new Date(w.now);

  // Real figures from the real project, so each theme is judged against the
  // data it will actually have to carry.
  const totalWeight = sumBy(w.milestones, (m) => m.weight);
  const progress = sumBy(w.milestones, (m) => m.progress_percent * m.weight) / totalWeight;
  const planned = w.snapshots[w.snapshots.length - 1]?.planned_percent ?? 0;

  const budget = rollUpBudget(w.budgetCategories, w.costEntries);
  const contract = contractPosition(w.project, w.changeOrders);
  const payments = summarisePayments(w.payments, now);
  const schedule = computeSchedule(w.milestones, w.dependencies);

  const openIssues = w.issues.filter(
    (i) => i.status === "open" || i.status === "acknowledged" || i.status === "in_progress",
  );

  const health = scoreHealth({
    scheduleVariance: progress - planned,
    costVariance: budget.remaining,
    budgetTotal: budget.budgeted,
    openIssues,
    weather: w.weather,
    asOf: now,
  });

  // A six-milestone window around today, positioned as percentages of that
  // window so the Gantt reads at preview size.
  const active = w.milestones.slice(8, 14);
  const windowStart = active[0]!.planned_start;
  const windowEnd = active[active.length - 1]!.planned_end;
  const windowDays = Math.max(1, daysBetween(windowStart, windowEnd));

  const figures: LabFigures = {
    projectName: w.project.name,
    address: `${w.project.address_line1}, ${w.project.city}`,
    progress,
    planned,
    variance: progress - planned,
    contractRevised: contract.revised,
    budgeted: budget.budgeted,
    spent: budget.actual,
    committed: budget.committed,
    health: health.score,
    nextPaymentName: payments.nextDue?.name ?? "—",
    nextPaymentAmount: payments.nextDue?.amount ?? 0,
    nextPaymentDue: payments.nextDue
      ? `Due ${formatDate(payments.nextDue.due_date, "short")}`
      : "—",
    openIssues: openIssues.length,
    daysToTarget: w.project.target_completion_date
      ? daysBetween(w.now.slice(0, 10), w.project.target_completion_date)
      : 0,
    curve: w.snapshots
      .filter((_, i) => i % 2 === 0)
      .map((s) => ({ planned: s.planned_percent, actual: s.actual_percent })),
    gantt: active.map((m) => ({
      name: m.name,
      start: (daysBetween(windowStart, m.planned_start) / windowDays) * 100,
      span: Math.max(4, (daysBetween(m.planned_start, m.planned_end) / windowDays) * 100),
      progress: m.progress_percent,
      critical: schedule.tasks.get(m.id)?.isCritical ?? false,
    })),
    budget: budget.categories.slice(0, 5).map((c) => ({
      name: c.name,
      used: c.actual + c.committed,
      total: c.budgeted,
      over: c.isOverBudget,
    })),
    todayPct: Math.max(
      0,
      Math.min(100, (daysBetween(windowStart, w.now.slice(0, 10)) / windowDays) * 100),
    ),
  };

  return (
    <div
      className={`${archivo.variable} ${space.variable} ${fraunces.variable} ${inter.variable} ${jetbrains.variable} min-h-dvh`}
    >
      <header className="bg-canvas border-line border-b px-5 py-8 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-ink-3 text-[11px] font-semibold tracking-wider uppercase">
            Internal · not linked from the app
          </p>
          <h1 className="text-ink mt-2 text-3xl font-semibold tracking-[-0.03em]">Design lab</h1>
          <p className="text-ink-2 mt-3 max-w-2xl text-[14px] leading-relaxed">
            Four directions for the interface, each applied to the same real components with the
            same real project data. Scroll to compare, then tell me which one to build — adopting a
            direction is a token swap, not a rewrite, because every difference below is expressed as
            CSS custom properties.
          </p>

          <div className="border-line mt-5 flex flex-wrap gap-x-8 gap-y-3 border-t pt-4">
            <Note title="Why they look different structurally">
              Radius, border weight, shadow, letter-spacing and capitalisation are tokens too.
              Brutalism is mostly geometry — colour alone would just be a repaint.
            </Note>
            <Note title="Why the chart colours are calmer than the UI">
              Every series palette below passed colourblind-separation checks against that
              theme&apos;s own paper. The interface can shout; a chart whose categories collapse
              under deuteranopia is simply broken.
            </Note>
          </div>

          <div className="mt-5 flex flex-wrap gap-5 text-[13px] font-medium">
            <Link href="/dashboard" className="text-brand hover:underline">
              ← Back to the current interface
            </Link>
            <Link href="/design-lab/royal" className="text-brand hover:underline">
              Royal &amp; luxury directions →
            </Link>
          </div>
        </div>
      </header>

      <LabNav
        groups={FAMILIES.map((family) => ({
          title: family.title,
          themes: THEMES.filter((t) => t.family === family.id).map((t) => ({
            id: t.id,
            name: t.name,
          })),
        }))}
      />

      {FAMILIES.map((family) => (
        <div key={family.id}>
          <div className="bg-ink text-ink-inverse px-5 py-6 sm:px-8">
            <div className="mx-auto max-w-6xl">
              <h2 className="text-[22px] font-semibold tracking-[-0.02em]">{family.title}</h2>
              <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed opacity-75">
                {family.blurb}
              </p>
            </div>
          </div>

          {THEMES.filter((t) => t.family === family.id).map((theme) => (
            <ThemePanel key={theme.id} theme={theme} f={figures} />
          ))}
        </div>
      ))}

      <footer className="bg-canvas px-5 py-10 sm:px-8">
        <div className="text-ink-2 mx-auto max-w-6xl text-[13px] leading-relaxed">
          <p className="text-ink font-semibold">Next step</p>
          <p className="mt-1 max-w-2xl">
            Pick one — or mix them (the Site Notice palette on the Swiss Severe geometry is a
            genuinely good combination). Whichever you choose, the work is: move the tokens in{" "}
            <code className="font-mono text-[12px]">globals.css</code>, convert the hard-coded
            radius and border utilities in the UI primitives to read from them, then every screen
            changes at once.
          </p>
        </div>
      </footer>
    </div>
  );
}

function Note({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="max-w-sm">
      <p className="text-ink text-[12px] font-semibold">{title}</p>
      <p className="text-ink-3 mt-0.5 text-[12px] leading-relaxed">{children}</p>
    </div>
  );
}
