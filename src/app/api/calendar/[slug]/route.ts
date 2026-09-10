import { buildIcs } from "@/lib/calendar";
import { DERIVE_TABLES, deriveProject } from "@/lib/data/derived";
import { getViewer, getWorkspace } from "@/lib/data/workspace";
import {
  CALENDAR_TABLES,
  parseSections,
  projectCalendarEvents,
} from "@/lib/domain/project-calendar";
import { siteUrl } from "@/lib/env";

/**
 * Calendar export.
 *
 * Authorisation is the caller's own session: the workspace is loaded under
 * RLS, so someone without access to the project gets an empty workspace and a
 * 404 here -- never another buyer's payment dates.
 *
 * This is a download, not a subscription feed. A feed that calendar apps poll
 * cannot send a session cookie, so it would need a per-user signed token in
 * the URL; that is a deliberate follow-up rather than a half-built shortcut,
 * because an unauthenticated feed would leak payment amounts.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const workspace = await getWorkspace(slug, [...DERIVE_TABLES, ...CALENDAR_TABLES]);

  if (!workspace.project.id || workspace.project.slug !== slug) {
    return new Response("Project not found.", { status: 404 });
  }

  const viewer = await getViewer(slug);
  const derived = deriveProject(workspace, viewer.profile?.id ?? null);
  const sections = parseSections(new URL(request.url).searchParams.get("include"));

  const ics = buildIcs(projectCalendarEvents(workspace, derived, sections, siteUrl), {
    name: `${workspace.project.name} — your build`,
    now: new Date(workspace.now),
    description: `Key dates for ${workspace.project.name}.`,
  });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-dates.ics"`,
      // Personal data: never cache in a shared proxy.
      "Cache-Control": "private, no-store",
    },
  });
}
