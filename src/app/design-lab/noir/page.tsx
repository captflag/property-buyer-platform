import { DM_Mono, Schibsted_Grotesk } from "next/font/google";
import Link from "next/link";
import type { Metadata } from "next";

import { DERIVE_TABLES, deriveProject } from "@/lib/data/derived";
import { getWorkspace } from "@/lib/data/workspace";
import { contractPosition, summarisePayments } from "@/lib/domain/finance";
import { formatPriceDelta } from "@/lib/domain/selections";
import { daysBetween, formatCurrency, formatDate } from "@/lib/format";
import { sumBy } from "@/lib/utils";

import { NOIR, type NoirPhoto } from "./noir-photos";
import { NoirView, type NoirData, type NoirTone } from "./noir-view";
import "./noir.css";

// Loaded on this page only; the rest of the app keeps its own faces until a
// direction is adopted.
const display = Schibsted_Grotesk({
  variable: "--font-schibsted",
  subsets: ["latin"],
  weight: ["400", "500", "600", "800"],
  display: "swap",
});
const mono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Noir Editorial",
  robots: { index: false, follow: false },
};

/** Thumbnail for a decision, matched on what the decision is about. */
const THUMBS: Array<[RegExp, NoirPhoto]> = [
  [/stair/i, NOIR.stair],
  [/kitchen|cabinet|worktop/i, NOIR.kitchen],
  [/tile|sanitary|bath/i, NOIR.marble],
  [/driveway/i, NOIR.concrete],
];

export default async function NoirLabPage() {
  const w = await getWorkspace(undefined, [...DERIVE_TABLES, "payments", "phases", "profiles"]);
  const d = deriveProject(w, null);
  const currency = w.project.currency;
  const today = w.now.slice(0, 10);

  const contract = contractPosition(w.project, w.changeOrders);
  const paySummary = summarisePayments(w.payments, d.now);
  const buyer = w.profiles.find((p) =>
    w.members.some((m) => m.user_id === p.id && m.role === "buyer"),
  );

  const start = w.project.start_date ?? today;
  const target = w.project.target_completion_date ?? today;
  const day = Math.max(1, daysBetween(start, today));
  const totalDays = Math.max(day, daysBetween(start, target));

  // Build stages are the project's phases, in programme order, each with the
  // weighted progress of its milestones.
  const stages = [...w.phases]
    .sort((a, b) => a.sequence - b.sequence)
    .map((phase, index) => {
      const milestones = w.milestones.filter((m) => m.phase_id === phase.id);
      const weight = sumBy(milestones, (m) => m.weight);
      const progress =
        weight > 0
          ? sumBy(milestones, (m) => m.progress_percent * m.weight) / weight
          : phase.status === "completed"
            ? 100
            : 0;
      const state: "done" | "current" | "upcoming" =
        progress >= 99.5
          ? "done"
          : progress > 0 || phase.status === "in_progress"
            ? "current"
            : "upcoming";
      return { n: index + 1, name: phase.name, progress, state };
    });
  const firstOpen = stages.findIndex((s) => s.state !== "done");

  const { latitude: lat, longitude: lng } = w.project;
  const coords =
    lat != null && lng != null
      ? `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? "E" : "W"}`
      : null;

  const siteTime = new Intl.DateTimeFormat("en-US", {
    timeZone: w.project.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "short",
  }).format(d.now);

  const decisions: NoirData["decisions"] = d.selections.slice(0, 8).map((view) => {
    const urgency: string = view.urgency;
    const [tone, status]: [NoirTone, string] =
      urgency === "chosen"
        ? ["good", "Chosen"]
        : urgency === "locked"
          ? ["good", "Confirmed"]
          : urgency === "overdue"
            ? ["critical", "Overdue"]
            : urgency === "urgent"
              ? ["warn", "Due this week"]
              : urgency === "soon"
                ? ["warn", "Due soon"]
                : ["open", "Open"];
    return {
      id: view.category.id,
      name: view.category.name,
      choice: view.chosen ? view.chosen.name : "Undecided",
      delta: view.chosen ? formatPriceDelta(view.priceDelta, currency) : "—",
      deadline: view.deadline ? formatDate(view.deadline, "medium") : "Not set",
      tone,
      status,
      thumb: THUMBS.find(([pattern]) => pattern.test(view.category.name))?.[1] ?? null,
    };
  });

  const p = w.project;
  const data: NoirData = {
    projectName: p.name,
    buyerName: buyer?.full_name ?? "Buyer",
    address: [p.address_line1, p.city, [p.state, p.postal_code].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", "),
    coords,
    siteTime,
    day,
    totalDays,
    week: Math.ceil(day / 7),
    progress: d.progress,
    planned: d.planned,
    contractValue: formatCurrency(contract.revised, currency),
    changesNote:
      contract.approvedChanges !== 0
        ? `Includes ${formatCurrency(contract.approvedChanges, currency)} of approved changes`
        : "No changes approved",
    contractDate: formatDate(p.target_completion_date, "medium"),
    forecastDate: d.forecast.projectedDate ? formatDate(d.forecast.projectedDate, "medium") : null,
    slipDays: d.forecast.slipDays,
    delayReasons: d.delay.reasons.map((r) => ({ label: r.label, detail: r.detail })),
    residence: {
      headline: `${p.bedrooms ?? 4} bedrooms and ${p.bathrooms ?? 3} bathrooms, built to order.`,
      floorArea: p.floor_area_sqft ? p.floor_area_sqft.toLocaleString("en-US") : null,
      description:
        p.description ??
        "A new home under construction, recorded here stage by stage — every payment, decision and photograph in one place.",
      rows: (
        [
          ["Type", p.unit_type],
          ["Plot", p.plot_area_sqft ? `${p.plot_area_sqft.toLocaleString("en-US")} sq ft` : null],
          ["Architect", p.architect_name],
          ["Builder", p.contractor_name ?? w.organization?.name ?? null],
          ["Site manager", p.site_manager_name],
          ["Works began", p.start_date ? formatDate(p.start_date, "long") : null],
        ] as Array<[string, string | null]>
      ).filter((row): row is [string, string] => row[1] != null),
    },
    stages,
    currentStage: firstOpen === -1 ? stages.length : firstOpen + 1,
    nextPayment: paySummary.nextDue
      ? {
          name: paySummary.nextDue.name,
          amount: formatCurrency(paySummary.nextDue.amount, currency),
          due: formatDate(paySummary.nextDue.due_date, "medium"),
        }
      : null,
    payments: w.payments.map((pay, index) => {
      const overdue =
        pay.status === "overdue" ||
        (pay.status !== "paid" && pay.due_date != null && pay.due_date < today);
      const [tone, status]: [NoirTone, string] =
        pay.status === "paid"
          ? ["good", "Paid"]
          : overdue
            ? ["critical", "Overdue"]
            : pay.status === "invoiced"
              ? ["warn", "Invoiced"]
              : ["open", "Scheduled"];
      return {
        n: index + 1,
        name: pay.name,
        share: pay.percent_of_contract != null ? `${pay.percent_of_contract}%` : "—",
        date: formatDate(pay.status === "paid" ? pay.paid_at : pay.due_date, "medium"),
        amount: formatCurrency(pay.amount, currency),
        tone,
        status,
      };
    }),
    decisions,
    decisionSummary: {
      open: d.selectionSummary.total - d.selectionSummary.decided,
      decided: d.selectionSummary.decided,
      total: d.selectionSummary.total,
      impact: formatPriceDelta(d.selectionSummary.budgetImpact, currency),
    },
  };

  return (
    <div
      className={`${display.variable} ${mono.variable} min-h-dvh`}
      style={{ backgroundColor: "#0a0a0a" }}
    >
      <div
        className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b px-5 py-3 text-[12px] sm:px-8"
        style={{ borderColor: "#2a2623", color: "#a79e91", backgroundColor: "#0a0a0a" }}
      >
        <span>Design lab · Noir Editorial</span>
        <Link href="/design-lab/royal" className="underline underline-offset-4 hover:text-white">
          ← Royal &amp; luxury directions
        </Link>
        <Link href="/dashboard" className="underline underline-offset-4 hover:text-white">
          Current interface
        </Link>
      </div>
      <NoirView d={data} />
    </div>
  );
}
