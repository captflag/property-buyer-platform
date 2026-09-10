import {
  Bodoni_Moda,
  Cinzel,
  Cormorant_Garamond,
  Jost,
  Marcellus,
  Playfair_Display,
} from "next/font/google";
import Link from "next/link";
import type { Metadata } from "next";

import { DERIVE_TABLES, deriveProject } from "@/lib/data/derived";
import { getWorkspace } from "@/lib/data/workspace";
import { contractPosition, summarisePayments } from "@/lib/domain/finance";
import { formatDate } from "@/lib/format";

import "../design-lab.css";
import { LabNav } from "../lab-nav";
import { RoyalPanel, type RoyalFigures } from "./royal-panel";
import { ROYAL_THEMES } from "./royal-themes";
import "./royal.css";

// Loaded only on this page: six display families would be a heavy tax on
// every other screen for the sake of one comparison.
const bodoni = Bodoni_Moda({
  variable: "--font-bodoni",
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});
const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
});
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});
const marcellus = Marcellus({
  variable: "--font-marcellus",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});
const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Design lab — royal & luxury",
  robots: { index: false, follow: false },
};

export default async function RoyalLabPage() {
  const w = await getWorkspace(undefined, [...DERIVE_TABLES, "payments"]);
  const d = deriveProject(w, null);
  const contract = contractPosition(w.project, w.changeOrders);
  const payments = summarisePayments(w.payments, d.now);
  const today = w.now.slice(0, 10);

  const figures: RoyalFigures = {
    projectName: w.project.name,
    city: [w.project.city, w.project.state].filter(Boolean).join(", "),
    bedrooms: w.project.bedrooms,
    bathrooms: w.project.bathrooms,
    floorArea: w.project.floor_area_sqft,
    progress: d.progress,
    planned: d.planned,
    contractRevised: contract.revised,
    handover: formatDate(d.handoverAnchor, "medium"),
    nextPaymentName: payments.nextDue?.name ?? "—",
    nextPaymentAmount: payments.nextDue?.amount ?? 0,
    nextPaymentDue: payments.nextDue
      ? `due ${formatDate(payments.nextDue.due_date, "medium")}`
      : "nothing scheduled",
    // The stages around today: the last two paid and the next three.
    payments: (() => {
      const lastPaid = w.payments.map((p) => p.status).lastIndexOf("paid");
      const start = Math.max(0, lastPaid - 1);
      return w.payments.slice(start, start + 5).map((p) => ({
        name: p.name,
        due: formatDate(p.status === "paid" ? p.paid_at : p.due_date, "medium"),
        amount: p.amount,
        status:
          p.status === "paid"
            ? ("Paid" as const)
            : p.status === "invoiced"
              ? ("Invoiced" as const)
              : p.status === "overdue" || (p.due_date != null && p.due_date < today)
                ? ("Overdue" as const)
                : ("Scheduled" as const),
      }));
    })(),
  };

  const fonts = [bodoni, cinzel, cormorant, playfair, marcellus, jost]
    .map((font) => font.variable)
    .join(" ");

  return (
    <div className={`${fonts} min-h-dvh`}>
      <header className="bg-canvas border-line border-b px-5 py-8 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-ink-3 text-[11px] font-semibold tracking-wider uppercase">
            Internal · not linked from the app
          </p>
          <h1 className="text-ink mt-2 text-3xl font-semibold tracking-[-0.03em]">
            Design lab — royal &amp; luxury
          </h1>
          <p className="text-ink-2 mt-3 max-w-2xl text-[14px] leading-relaxed">
            Five royal directions, each applied to exactly the same content: a hero on the villa,
            the bungalow and penthouse collection, interiors, curated finishes, and the buyer&apos;s
            own build with real figures from Kestrel House. Luxury lives mostly in photography,
            space, a display face with character and a precious metal used sparingly — so these
            panels show all four, not just a dashboard.
          </p>

          <div className="border-line mt-5 flex flex-wrap gap-x-8 gap-y-3 border-t pt-4">
            <Note title="Gold that passes contrast">
              Every metal button carries dark ink, not white. Gold with a white label looks rich and
              fails 4.5:1 — which on a payments screen is not a trade worth making.
            </Note>
            <Note title="One ornament per theme">
              A gilt frame, a crest, marble and arches, corner brackets, or pure air. Two motifs at
              once starts to read as a wedding invitation.
            </Note>
          </div>

          <div className="mt-5 flex flex-wrap gap-5 text-[13px] font-medium">
            <Link href="/design-lab" className="text-brand hover:underline">
              ← Brutalist &amp; real-estate directions
            </Link>
            <Link href="/design-lab/noir" className="text-brand hover:underline">
              Noir Editorial study →
            </Link>
            <Link href="/dashboard" className="text-brand hover:underline">
              Back to the current interface
            </Link>
          </div>
        </div>
      </header>

      <LabNav
        groups={[
          {
            title: "Royal & luxury",
            themes: ROYAL_THEMES.map((t) => ({ id: t.id, name: t.name })),
          },
        ]}
      />

      {ROYAL_THEMES.map((theme, index) => (
        <RoyalPanel key={theme.id} theme={theme} f={figures} priority={index === 0} />
      ))}

      <footer className="bg-canvas px-5 py-10 sm:px-8">
        <div className="text-ink-2 mx-auto max-w-6xl text-[13px] leading-relaxed">
          <p className="text-ink font-semibold">Next step</p>
          <p className="mt-1 max-w-2xl">
            Pick one — or combine (Palazzo&apos;s arches with Royal Sapphire&apos;s palette is a
            strong pairing). Adopting a direction app-wide means moving its tokens into{" "}
            <code className="font-mono text-[12px]">globals.css</code>, loading its display face in
            the root layout, and bringing its one motif into the card primitive.
          </p>
          <p className="text-ink-3 mt-4 text-[12px]">
            Photography from Unsplash, used under the Unsplash licence and loaded from Unsplash
            directly.
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
