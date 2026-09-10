import { ArrowRight, CalendarClock, ChevronDown } from "lucide-react";
import Link from "next/link";

import type { DelayExplanation } from "@/lib/domain/delay";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Proactive delay explanation.
 *
 * Appears only when the forecast has moved past the contract date by more
 * than noise. The point is timing: the buyer learns *why* the date moved at
 * the same moment they learn *that* it moved, instead of discovering a new
 * number and having to ask.
 *
 * Built on <details> rather than client state -- it is a disclosure, the
 * browser already provides one that is keyboard- and screen-reader-correct,
 * and it keeps this component free of client JavaScript.
 */
export function DelayBanner({ delay, slug }: { delay: DelayExplanation; slug: string }) {
  if (!delay.isSlipping) return null;

  const [first, ...rest] = delay.reasons;
  const shown = delay.reasons.slice(0, 3);

  return (
    <section
      aria-labelledby="delay-heading"
      className="border-serious bg-serious-subtle border-l-4 px-5 py-4"
    >
      <div className="flex flex-wrap items-start gap-3">
        <CalendarClock className="text-serious-ink mt-0.5 size-5 shrink-0" aria-hidden="true" />

        <div className="min-w-0 flex-1">
          <h2 id="delay-heading" className="ui-display text-serious-ink text-[16px]">
            Forecast completion is {delay.slipDays} days past your contract date
          </h2>
          <p className="text-ink-2 mt-1 text-[13px] leading-relaxed">
            The forecast is now {formatDate(delay.forecastDate, "long")}, against a contract date of{" "}
            {formatDate(delay.targetDate, "long")}. Here is what the records show.
          </p>

          {shown.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-1.5">
              {shown.map((reason) => (
                <li key={`${reason.kind}-${reason.label}`} className="flex gap-2 text-[13px]">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-[7px] size-1.5 shrink-0 rounded-full",
                      reason.critical ? "bg-serious" : "bg-ink-3",
                    )}
                  />
                  <span className="text-ink-2">
                    <Link href={reason.href} className="text-ink font-medium hover:underline">
                      {reason.label}
                    </Link>{" "}
                    — {reason.detail}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-2 mt-2 text-[13px]">
              No single factor on record explains it — the slip reflects a slower rate of progress
              overall.
            </p>
          )}

          <details className="group mt-3">
            <summary className="text-serious-ink flex cursor-pointer list-none items-center gap-1 text-[12px] font-semibold">
              {rest.length > 2 ? `All ${delay.reasons.length} factors, and` : "How"} this is worked
              out
              <ChevronDown
                className="size-3.5 transition-transform duration-200 group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>

            <div className="border-serious/30 mt-2 border-t pt-2">
              {delay.reasons.length > 3 ? (
                <ul className="mb-2 flex flex-col gap-1.5">
                  {delay.reasons.slice(3).map((reason) => (
                    <li key={`${reason.kind}-${reason.label}`} className="text-ink-2 text-[12px]">
                      <Link href={reason.href} className="text-ink font-medium hover:underline">
                        {reason.label}
                      </Link>{" "}
                      — {reason.detail}
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="text-ink-3 text-[12px] leading-relaxed">{delay.caveat}</p>
            </div>
          </details>
        </div>

        {first ? (
          <Link
            href={`/projects/${slug}/timeline`}
            className="text-serious-ink hidden shrink-0 items-center gap-1 text-[12px] font-semibold hover:underline sm:inline-flex"
          >
            See the timeline
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </section>
  );
}
