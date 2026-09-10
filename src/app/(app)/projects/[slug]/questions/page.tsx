import Link from "next/link";
import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getThreads, getUpdate, PAGE_SIZE } from "@/lib/data/feeds";
import { getViewer, getWorkspace } from "@/lib/data/workspace";
import type { DiscussionSubject } from "@/types/database";

import { QuestionsBoard, type AboutSubject, type ThreadView } from "./questions-board";

export const metadata: Metadata = { title: "Questions" };

const SUBJECTS: readonly DiscussionSubject[] = [
  "milestone",
  "update",
  "document",
  "selection",
  "issue",
  "payment",
  "photo",
  "general",
];

export default async function QuestionsPage({
  params,
  searchParams,
}: PageProps<"/projects/[slug]/questions">) {
  const { slug } = await params;
  const query = await searchParams;
  const base = `/projects/${slug}`;

  const before = typeof query.before === "string" ? query.before : null;
  const aboutParam = typeof query.about === "string" ? query.about : null;
  const [aboutKind, aboutId] = (aboutParam?.split(":") ?? []) as [
    DiscussionSubject | undefined,
    string | undefined,
  ];

  // Threads arrive a page at a time, most recently active first. An update
  // being asked about is fetched on its own: it may be far older than any
  // update a page would otherwise load.
  const [w, viewer, page, aboutUpdate] = await Promise.all([
    getWorkspace(slug, [
      "documents",
      "issues",
      "members",
      "milestones",
      "payments",
      "profiles",
      "selectionCategories",
    ]),
    getViewer(slug),
    getThreads(slug, { limit: PAGE_SIZE.threads, before }),
    aboutKind === "update" && aboutId ? getUpdate(slug, aboutId) : Promise.resolve(null),
  ]);

  /** Where a subject lives, so a thread can link back to what it is about. */
  const hrefFor = (kind: DiscussionSubject, id: string | null): string | null => {
    if (!id) return null;
    switch (kind) {
      case "update":
        return `${base}/updates#${id}`;
      case "selection":
        return `${base}/selections#${id}`;
      case "document":
        return `${base}/documents`;
      case "milestone":
        return `${base}/timeline`;
      case "issue":
        return `${base}/quality`;
      case "payment":
        return `${base}/finance`;
      default:
        return null;
    }
  };

  // Resolve "?about=kind:id" against the project's own records. An id that
  // does not belong to this project resolves to nothing, rather than letting a
  // crafted link attach a question to someone else's data.
  let about: AboutSubject | null = null;
  if (aboutKind && aboutId && SUBJECTS.includes(aboutKind)) {
    const label =
      aboutKind === "update"
        ? aboutUpdate?.title
        : aboutKind === "selection"
          ? w.selectionCategories.find((c) => c.id === aboutId)?.name
          : aboutKind === "document"
            ? w.documents.find((d) => d.id === aboutId)?.name
            : aboutKind === "milestone"
              ? w.milestones.find((m) => m.id === aboutId)?.name
              : aboutKind === "issue"
                ? w.issues.find((i) => i.id === aboutId)?.title
                : aboutKind === "payment"
                  ? w.payments.find((p) => p.id === aboutId)?.name
                  : undefined;
    if (label) about = { kind: aboutKind, id: aboutId, label, href: hrefFor(aboutKind, aboutId) };
  }

  const buildTeam = new Set(
    w.members.filter((m) => m.role === "builder" || m.role === "inspector").map((m) => m.user_id),
  );
  const nameOf = (id: string | null) =>
    w.profiles.find((p) => p.id === id)?.full_name ??
    (id && buildTeam.has(id) ? "Build team" : "Member");

  const threads: ThreadView[] = page.discussions.map((discussion) => ({
    id: discussion.id,
    title: discussion.title,
    status: discussion.status,
    subjectKind: discussion.subject_kind,
    subjectId: discussion.subject_id,
    subjectLabel: discussion.subject_label,
    subjectHref: hrefFor(discussion.subject_kind, discussion.subject_id),
    lastMessageAt: discussion.last_message_at,
    messages: page.messages
      .filter((m) => m.discussion_id === discussion.id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((m) => ({
        id: m.id,
        authorId: m.author_id,
        authorName: nameOf(m.author_id),
        fromBuildTeam: m.author_id !== null && buildTeam.has(m.author_id),
        body: m.body,
        createdAt: m.created_at,
      })),
  }));

  return (
    <>
      <PageHeader
        title="Questions"
        scene="fireplace"
        description="Ask the build team about anything — a photo, a date, a decision. Every question keeps the thing it is about attached, so the answer comes with its context."
      />
      <QuestionsBoard
        threads={threads}
        about={about}
        viewerId={viewer.profile?.id ?? null}
        viewerName={viewer.profile?.full_name ?? "You"}
        now={w.now}
      />

      {before || page.nextCursor ? (
        <nav aria-label="Older questions" className="mt-6 flex flex-wrap items-center gap-2">
          {before ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={`${base}/questions`}>Back to the latest</Link>
            </Button>
          ) : null}
          {page.nextCursor ? (
            <Button asChild variant="secondary" size="sm">
              <Link href={`${base}/questions?before=${page.nextCursor}`}>Older questions</Link>
            </Button>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
