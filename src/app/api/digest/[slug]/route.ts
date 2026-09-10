import { NextResponse } from "next/server";

import { DERIVE_TABLES, deriveProject } from "@/lib/data/derived";
import { getUpdates } from "@/lib/data/feeds";
import { getViewer, getWorkspace } from "@/lib/data/workspace";
import { composeDigest, digestToText, digestWindowStart } from "@/lib/domain/digest";
import { siteUrl } from "@/lib/env";

/**
 * The weekly digest as data, for whatever sends it.
 *
 * A scheduler calls this once a week per recipient and hands `text` to an
 * email provider. Delivery lives outside the app on purpose -- the content is
 * the part worth owning and testing; the transport is a commodity.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const workspace = await getWorkspace(slug, [...DERIVE_TABLES, "payments"]);

  if (!workspace.project.id || workspace.project.slug !== slug) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const viewer = await getViewer(slug);
  const d = deriveProject(workspace, viewer.profile?.id ?? null);
  // Only the week the digest covers -- far more than any site posts.
  const { updates } = await getUpdates(slug, { since: digestWindowStart(d.now), limit: 200 });

  const digest = composeDigest({
    projectName: workspace.project.name,
    slug,
    currency: workspace.project.currency,
    asOf: d.now,
    snapshots: workspace.snapshots,
    updates,
    milestones: workspace.milestones,
    payments: workspace.payments,
    issues: workspace.issues,
    selections: d.selections,
    delay: d.delay,
  });

  return NextResponse.json(
    { digest, text: digestToText(digest, siteUrl) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
