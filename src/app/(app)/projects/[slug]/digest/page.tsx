import { ChevronDown, Mail, Settings } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DERIVE_TABLES, deriveProject } from "@/lib/data/derived";
import { getUpdates } from "@/lib/data/feeds";
import { getViewer, getWorkspace } from "@/lib/data/workspace";
import { composeDigest, digestToText, digestWindowStart } from "@/lib/domain/digest";
import { siteUrl } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Weekly digest" };

/**
 * A preview of this week's digest, exactly as it would be sent.
 *
 * Shown as an email rather than a dashboard so the buyer can judge whether
 * the weekly message is worth having -- and so the build team can see what
 * their updates turn into by the time they reach someone's inbox.
 */
export default async function DigestPage({ params }: PageProps<"/projects/[slug]/digest">) {
  const { slug } = await params;
  const [w, viewer] = await Promise.all([
    getWorkspace(slug, [...DERIVE_TABLES, "payments"]),
    getViewer(slug),
  ]);
  const d = deriveProject(w, viewer.profile?.id ?? null);
  // Only the week the digest covers -- far more than any site posts.
  const { updates } = await getUpdates(slug, { since: digestWindowStart(d.now), limit: 200 });

  const digest = composeDigest({
    projectName: w.project.name,
    slug,
    currency: w.project.currency,
    asOf: d.now,
    snapshots: w.snapshots,
    updates,
    milestones: w.milestones,
    payments: w.payments,
    issues: w.issues,
    selections: d.selections,
    delay: d.delay,
  });
  const text = digestToText(digest, siteUrl);

  return (
    <>
      <PageHeader
        title="Weekly digest"
        description="One message a week: whether your build moved, and whether anything needs you. This is this week's, exactly as it would arrive."
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href="/settings">
              <Settings />
              Digest settings
            </Link>
          </Button>
        }
      />

      <div className="flex max-w-3xl flex-col gap-4">
        <Card className="overflow-hidden">
          {/* Envelope */}
          <div className="border-line bg-surface-2 flex flex-col gap-1 border-b px-5 py-3 text-[12px]">
            <p>
              <span className="text-ink-3 inline-block w-16">From</span>
              <span className="text-ink">
                Kestrel · {w.organization?.name ?? "Your build team"}
              </span>
            </p>
            <p>
              <span className="text-ink-3 inline-block w-16">To</span>
              <span className="text-ink">{viewer.profile?.email ?? "you"}</span>
            </p>
            <p>
              <span className="text-ink-3 inline-block w-16">Subject</span>
              <span className="text-ink font-semibold">
                {w.project.name}: week to {formatDate(digest.periodEnd, "medium")}
              </span>
            </p>
          </div>

          {/* Body */}
          <div className="flex flex-col gap-6 px-5 py-6 sm:px-8">
            <div className="flex items-start gap-3">
              <span className="bg-brand text-brand-ink grid size-9 shrink-0 place-items-center">
                <Mail className="size-4" aria-hidden="true" />
              </span>
              <p className="ui-display text-ink text-[19px] leading-snug">{digest.headline}</p>
            </div>

            {digest.sections.length === 0 ? (
              <p className="text-ink-2 text-[14px]">
                Nothing else changed this week, and there is nothing you need to do.
              </p>
            ) : (
              digest.sections.map((section) => (
                <section key={section.title}>
                  <h2
                    className={cn(
                      "ui-label border-b pb-1.5 text-[10px]",
                      section.actionRequired
                        ? "text-serious-ink border-serious"
                        : "text-ink-3 border-line",
                    )}
                  >
                    {section.title}
                    {section.actionRequired ? " · action needed" : ""}
                  </h2>
                  <ul className="mt-2.5 flex flex-col gap-2">
                    {section.items.map((item) => (
                      <li key={item.text} className="text-ink-2 text-[14px] leading-relaxed">
                        {item.href ? (
                          <Link href={item.href} className="hover:text-brand hover:underline">
                            {item.text}
                          </Link>
                        ) : (
                          item.text
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            )}

            <p className="text-ink-3 border-line border-t pt-4 text-[11px] leading-relaxed">
              You are receiving this because weekly digests are on in your notification settings.
            </p>
          </div>
        </Card>

        <details className="group">
          <summary className="text-ink-2 flex cursor-pointer list-none items-center gap-1 text-[12px] font-semibold">
            Plain-text version
            <ChevronDown
              className="size-3.5 transition-transform duration-200 group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <pre className="border-line bg-surface-2 text-ink-2 mt-2 overflow-x-auto border p-4 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
            {text}
          </pre>
        </details>

        <p className="text-ink-3 text-[12px] leading-relaxed">
          Sending needs an email provider connected to the deployment. The content above is produced
          the same way whether it is shown here or sent — a scheduler collects it from{" "}
          <code className="font-mono text-[11px]">/api/digest/{slug}</code> and hands it on.
        </p>
      </div>
    </>
  );
}
