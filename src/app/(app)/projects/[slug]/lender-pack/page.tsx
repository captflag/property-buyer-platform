import type { Metadata } from "next";

import { DERIVE_TABLES, deriveProject } from "@/lib/data/derived";
import { getViewer, getWorkspace } from "@/lib/data/workspace";
import { contractPosition, summarisePayments } from "@/lib/domain/finance";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

import { PrintButton } from "../report/print-button";
import "../report/print.css";

export const metadata: Metadata = {
  title: "Lender pack",
  robots: { index: false, follow: false },
};

/**
 * Stage progress confirmation for a mortgage lender.
 *
 * Staged-drawdown lenders release money against certified progress, and what
 * they want to know is narrow: how far along is the build, what has been paid
 * against it, and does the value of the work done cover the money drawn. This
 * page answers exactly that, with the certificates behind it, in a form that
 * prints cleanly.
 *
 * It says plainly that it supports a surveyor's inspection rather than
 * replacing one. Most lenders instruct their own valuer before each release,
 * and a document implying otherwise would mislead the person relying on it.
 */
export default async function LenderPackPage({
  params,
}: PageProps<"/projects/[slug]/lender-pack">) {
  const { slug } = await params;
  const [w, viewer] = await Promise.all([
    getWorkspace(slug, [...DERIVE_TABLES, "payments", "documents", "inspections", "profiles"]),
    getViewer(slug),
  ]);
  const d = deriveProject(w, viewer.profile?.id ?? null);
  const currency = w.project.currency;
  const today = w.now.slice(0, 10);

  const contract = contractPosition(w.project, w.changeOrders);
  const payments = summarisePayments(w.payments, d.now);

  // Value of work in place: completion applied to the revised contract. The
  // simplest defensible measure, and the one a valuer will check against.
  const workInPlace = (d.progress / 100) * contract.revised;
  const drawn = payments.paid;
  const headroom = workInPlace - drawn;

  const buyer = w.profiles.find((p) =>
    w.members.some((m) => m.user_id === p.id && m.role === "buyer"),
  );
  const passed = w.inspections.filter((i) => i.result === "pass");
  const certificates = w.documents.filter(
    (doc) =>
      !doc.is_confidential &&
      (doc.category === "certificate" ||
        doc.category === "permit" ||
        doc.category === "insurance" ||
        doc.category === "warranty"),
  );

  return (
    <div className="report">
      <div className="print-hide mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-3 max-w-xl text-[12px]">
          Laid out for print. Save it as a PDF and send it to your lender with a drawdown request —
          it summarises the progress and certificates they usually ask for.
        </p>
        <PrintButton />
      </div>

      <article className="report__sheet flex flex-col gap-8">
        <header className="report__rule flex flex-wrap items-end justify-between gap-4 pb-4">
          <div>
            <p className="ui-label text-ink-3 text-[10px]">Stage progress confirmation</p>
            <h1 className="ui-display text-ink mt-1 text-3xl">For mortgage drawdown</h1>
            <p className="report__ink-soft text-ink-2 mt-1 text-[13px]">
              {w.project.address_line1}
              {w.project.address_line2 ? `, ${w.project.address_line2}` : ""}, {w.project.city}
              {w.project.state ? `, ${w.project.state}` : ""} {w.project.postal_code ?? ""}
            </p>
          </div>
          <div className="text-right">
            <p className="ui-label text-ink-3 text-[10px]">As at</p>
            <p className="ui-display text-ink text-lg">{formatDate(today, "long")}</p>
          </div>
        </header>

        <section className="flex flex-col gap-3">
          <SectionTitle>Parties</SectionTitle>
          <dl className="grid gap-x-8 gap-y-2 text-[12px] sm:grid-cols-2">
            <Pair label="Borrower" value={buyer?.full_name ?? "—"} />
            <Pair
              label="Builder"
              value={w.organization?.name ?? w.project.contractor_name ?? "—"}
            />
            <Pair
              label="Property"
              value={`${w.project.unit_type ?? "Dwelling"}, ${w.project.bedrooms ?? "?"} bedrooms`}
            />
            <Pair label="Site manager" value={w.project.site_manager_name ?? "—"} />
            <Pair label="Contract value" value={formatCurrency(contract.revised, currency)} />
            <Pair
              label="Contract completion"
              value={formatDate(w.project.target_completion_date, "long")}
            />
          </dl>
        </section>

        <section className="flex flex-col gap-3">
          <SectionTitle>Progress against payments</SectionTitle>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
            <Figure label="Build complete" value={`${d.progress.toFixed(1)}%`} />
            <Figure label="Value of work in place" value={formatCurrency(workInPlace, currency)} />
            <Figure label="Drawn to date" value={formatCurrency(drawn, currency)} />
            <Figure
              label={headroom >= 0 ? "Work ahead of payments" : "Payments ahead of work"}
              value={formatCurrency(Math.abs(headroom), currency)}
              emphasis={headroom < 0}
            />
          </dl>
          <p className="report__ink-soft text-ink-2 text-[12px] leading-relaxed">
            Value of work in place is the weighted completion of the build applied to the revised
            contract value.{" "}
            {headroom >= 0
              ? "Payments drawn so far are covered by work already in place."
              : "Payments drawn so far exceed the value of work in place — a lender will usually want this explained before releasing a further stage."}
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <SectionTitle>Stage payments</SectionTitle>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="report__rule text-left">
                <Th>Stage</Th>
                <Th align="right">Share</Th>
                <Th align="right">Amount</Th>
                <Th>Status</Th>
                <Th>Date</Th>
              </tr>
            </thead>
            <tbody className="divide-line divide-y">
              {w.payments.map((payment) => (
                <tr key={payment.id} className="report__row">
                  <Td className="font-medium">{payment.name}</Td>
                  <Td align="right" className="tabular">
                    {payment.percent_of_contract ?? "—"}%
                  </Td>
                  <Td align="right" className="tabular">
                    {formatCurrency(payment.amount, currency)}
                  </Td>
                  <Td>
                    {payment.status === "paid"
                      ? "Paid"
                      : payment.status === "invoiced"
                        ? "Invoiced"
                        : payment.status === "overdue"
                          ? "Overdue"
                          : "Not yet due"}
                  </Td>
                  <Td className="report__ink-soft text-ink-3">
                    {payment.status === "paid"
                      ? formatDate(payment.paid_at, "medium")
                      : `Due ${formatDate(payment.due_date, "medium")}`}
                  </Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-line-strong border-t-2 font-semibold">
                <Td>Total</Td>
                <Td align="right">100%</Td>
                <Td align="right" className="tabular">
                  {formatCurrency(payments.total, currency)}
                </Td>
                <Td>{formatCurrency(payments.paid, currency)} paid</Td>
                <Td> </Td>
              </tr>
            </tfoot>
          </table>
          {payments.nextDue ? (
            <p className="report__ink-soft text-ink-2 text-[12px]">
              Next stage: <strong>{payments.nextDue.name}</strong>,{" "}
              {formatCurrency(payments.nextDue.amount, currency)}, due{" "}
              {formatDate(payments.nextDue.due_date, "long")}.
            </p>
          ) : null}
        </section>

        <section className="flex flex-col gap-3">
          <SectionTitle>Inspections passed</SectionTitle>
          {passed.length === 0 ? (
            <p className="text-ink-3 text-[12px]">No statutory inspections recorded yet.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-[12px]">
              {passed.map((inspection) => (
                <li key={inspection.id} className="report__row flex justify-between gap-4">
                  <span className="text-ink">
                    {inspection.name}
                    <span className="report__ink-soft text-ink-3"> · {inspection.authority}</span>
                  </span>
                  <span className="report__ink-soft text-ink-3 tabular shrink-0">
                    {formatDate(inspection.completed_at ?? inspection.scheduled_for, "medium")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <SectionTitle>Supporting documents</SectionTitle>
          <ul className="flex flex-col gap-1.5 text-[12px]">
            {certificates.map((doc) => (
              <li key={doc.id} className="report__row flex justify-between gap-4">
                <span className="text-ink">{doc.name}</span>
                <span className="report__ink-soft text-ink-3 shrink-0">
                  Issued {formatDate(doc.issued_at, "medium")}
                  {doc.expires_at ? ` · expires ${formatDate(doc.expires_at, "medium")}` : ""}
                </span>
              </li>
            ))}
          </ul>
          <p className="report__ink-soft text-ink-3 text-[11px]">
            Copies of each document are available from the project record on request.
          </p>
        </section>

        <section className="report__rule border-t pt-6">
          <p className="text-ink-2 text-[12px] leading-relaxed">
            We confirm that, to the best of our knowledge, the progress and payment information
            above reflects the project record at the date shown.
          </p>
          <div className="mt-6 grid gap-8 sm:grid-cols-2">
            {[
              { role: "For the builder", name: w.project.site_manager_name },
              { role: "Borrower", name: buyer?.full_name },
            ].map((party) => (
              <div key={party.role}>
                <div className="border-line-strong h-12 border-b" />
                <p className="ui-label text-ink-3 mt-1.5 text-[9px]">{party.role}</p>
                <p className="text-ink text-[12px]">{party.name ?? "—"}</p>
              </div>
            ))}
          </div>
          <p className="report__ink-soft text-ink-3 mt-8 text-[10px] leading-relaxed">
            This pack summarises the platform&apos;s project record to support a lender&apos;s
            valuation. It does not replace an inspection by the lender&apos;s own surveyor, which
            most lenders require before each stage release.
          </p>
        </section>
      </article>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="ui-label text-ink border-line-strong border-b pb-1.5 text-[10px]">{children}</h2>
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-line flex justify-between gap-4 border-b pb-1.5">
      <dt className="text-ink-3">{label}</dt>
      <dd className="text-ink text-right font-medium">{value}</dd>
    </div>
  );
}

function Figure({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div>
      <dt className="ui-label text-ink-3 text-[9px]">{label}</dt>
      <dd className={cn("ui-display mt-0.5 text-xl", emphasis ? "text-critical-ink" : "text-ink")}>
        {value}
      </dd>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <th
      scope="col"
      className={cn(
        "ui-label text-ink-3 py-1.5 pr-3 text-[9px]",
        align === "right" && "text-right",
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  className,
}: {
  children: React.ReactNode;
  align?: "right";
  className?: string;
}) {
  return (
    <td className={cn("py-1.5 pr-3", align === "right" && "text-right", className)}>{children}</td>
  );
}
