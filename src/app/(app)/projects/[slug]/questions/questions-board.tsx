"use client";

import { MessageSquarePlus, Send } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { postQuestion } from "@/app/(app)/buyer-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Avatar } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { formatRelative } from "@/lib/format";
import { cn, localId } from "@/lib/utils";
import type { DiscussionStatus, DiscussionSubject } from "@/types/database";

export interface ThreadMessage {
  id: string;
  authorId: string | null;
  authorName: string;
  fromBuildTeam: boolean;
  body: string;
  createdAt: string;
}

export interface ThreadView {
  id: string;
  title: string;
  status: DiscussionStatus;
  subjectKind: DiscussionSubject;
  subjectId: string | null;
  subjectLabel: string | null;
  subjectHref: string | null;
  lastMessageAt: string;
  messages: ThreadMessage[];
}

export interface AboutSubject {
  kind: DiscussionSubject;
  id: string;
  label: string;
  href: string | null;
}

type Filter = "all" | "open" | "answered";

/** Local-only ids come from optimistic creation in demo mode. */
const isLocal = (id: string) => id.startsWith("local_");

export function QuestionsBoard({
  threads: initial,
  about,
  viewerId,
  viewerName,
  now,
}: {
  threads: ThreadView[];
  about: AboutSubject | null;
  viewerId: string | null;
  viewerName: string;
  now: string;
}) {
  const { toast } = useToast();
  const nowDate = React.useMemo(() => new Date(now), [now]);
  const [threads, setThreads] = React.useState(initial);
  const [filter, setFilter] = React.useState<Filter>("all");
  const [composing, setComposing] = React.useState(about !== null);
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  // Threads about the subject in the URL come first: that is what the reader
  // arrived wanting to see.
  const ordered = React.useMemo(() => {
    const matches = (t: ThreadView) => about !== null && t.subjectId === about.id;
    return threads
      .slice()
      .sort(
        (a, b) =>
          Number(matches(b)) - Number(matches(a)) || b.lastMessageAt.localeCompare(a.lastMessageAt),
      );
  }, [threads, about]);

  const visible = ordered.filter((t) => filter === "all" || t.status === filter);
  const counts = {
    all: threads.length,
    open: threads.filter((t) => t.status === "open").length,
    answered: threads.filter((t) => t.status === "answered").length,
  };

  const ownMessage = (text: string): ThreadMessage => ({
    id: localId("local"),
    authorId: viewerId,
    authorName: viewerName,
    fromBuildTeam: false,
    body: text,
    createdAt: new Date().toISOString(),
  });

  const ask = () => {
    const text = body.trim();
    if (!text) return;

    const thread: ThreadView = {
      id: localId("local"),
      title: title.trim() || text.slice(0, 80),
      status: "open",
      subjectKind: about?.kind ?? "general",
      subjectId: about?.id ?? null,
      subjectLabel: about?.label ?? null,
      subjectHref: about?.href ?? null,
      lastMessageAt: new Date().toISOString(),
      messages: [ownMessage(text)],
    };

    setThreads((current) => [thread, ...current]);
    setTitle("");
    setBody("");
    setComposing(false);

    startTransition(async () => {
      const result = await postQuestion({
        subjectKind: thread.subjectKind,
        subjectId: thread.subjectId,
        subjectLabel: thread.subjectLabel,
        title: thread.title,
        body: text,
      });
      if (result.ok) {
        toast({ tone: "success", title: "Question sent", description: result.message });
      } else if (result.demo) {
        toast({
          tone: "info",
          title: "Question added",
          description: "Shown here, but not saved — this is demo data.",
        });
      } else {
        setThreads((current) => current.filter((t) => t.id !== thread.id));
        toast({ tone: "error", title: "Not sent", description: result.message });
      }
    });
  };

  const reply = (thread: ThreadView, text: string) => {
    const message = ownMessage(text);
    setThreads((current) =>
      current.map((t) =>
        t.id === thread.id
          ? {
              ...t,
              status: "open",
              lastMessageAt: message.createdAt,
              messages: [...t.messages, message],
            }
          : t,
      ),
    );

    // A thread that exists only locally has nowhere to post to.
    if (isLocal(thread.id)) return;

    startTransition(async () => {
      const result = await postQuestion({
        discussionId: thread.id,
        subjectKind: thread.subjectKind,
        body: text,
      });
      if (!result.ok && !result.demo) {
        setThreads((current) =>
          current.map((t) =>
            t.id === thread.id
              ? { ...t, messages: t.messages.filter((m) => m.id !== message.id) }
              : t,
          ),
        );
        toast({ tone: "error", title: "Reply not sent", description: result.message });
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Filter questions" className="flex gap-1">
          {(
            [
              ["all", "All"],
              ["open", "Awaiting reply"],
              ["answered", "Answered"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              role="tab"
              aria-selected={filter === value}
              variant={filter === value ? "subtle" : "ghost"}
              size="sm"
              onClick={() => setFilter(value)}
            >
              {label}
              <span className="text-ink-3 ml-1 text-[11px]">{counts[value]}</span>
            </Button>
          ))}
        </div>
        {!composing ? (
          <Button
            variant="primary"
            size="sm"
            className="ml-auto"
            onClick={() => setComposing(true)}
          >
            <MessageSquarePlus />
            Ask a question
          </Button>
        ) : null}
      </div>

      {composing ? (
        <Card className="p-5">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              ask();
            }}
            className="flex flex-col gap-3"
          >
            {about ? (
              <p className="text-ink-2 text-[12px]">
                About{" "}
                {about.href ? (
                  <Link href={about.href} className="text-ink font-semibold hover:underline">
                    {about.label}
                  </Link>
                ) : (
                  <span className="text-ink font-semibold">{about.label}</span>
                )}
              </p>
            ) : null}

            <Field
              label="Subject"
              htmlFor="question-title"
              hint="Optional — a short summary helps."
            >
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={160}
                placeholder="e.g. When does the kitchen go in?"
              />
            </Field>
            <Field label="Your question" htmlFor="question-body" required>
              <Textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={4}
                maxLength={4000}
                placeholder="Ask the build team anything about your house."
                required
              />
            </Field>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setComposing(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={pending || !body.trim()}>
                <Send />
                Send to the build team
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {visible.length === 0 ? (
        <EmptyState
          illustration="documents"
          title={filter === "open" ? "Nothing awaiting a reply" : "No questions yet"}
          description="Ask about anything — a photo, a date, a decision. The build team replies here, and you are notified when they do."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((thread) => (
            <li key={thread.id} id={thread.id} className="scroll-mt-20">
              <Thread
                thread={thread}
                highlighted={about !== null && thread.subjectId === about.id}
                viewerId={viewerId}
                now={nowDate}
                onReply={(text) => reply(thread, text)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Thread({
  thread,
  highlighted,
  viewerId,
  now,
  onReply,
}: {
  thread: ThreadView;
  highlighted: boolean;
  viewerId: string | null;
  now: Date;
  onReply: (text: string) => void;
}) {
  const [draft, setDraft] = React.useState("");

  return (
    <Card className={cn(highlighted && "border-brand border-l-4")}>
      <article className="flex flex-col gap-4 p-5">
        <header className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="ui-display text-ink text-[16px]">{thread.title}</h3>
            {thread.subjectLabel ? (
              <p className="text-ink-3 mt-0.5 text-[12px]">
                About{" "}
                {thread.subjectHref ? (
                  <Link href={thread.subjectHref} className="text-ink-2 hover:underline">
                    {thread.subjectLabel}
                  </Link>
                ) : (
                  thread.subjectLabel
                )}
              </p>
            ) : null}
          </div>
          <Badge tone={thread.status === "answered" ? "good" : "warning"}>
            {thread.status === "answered" ? "Answered" : "Awaiting reply"}
          </Badge>
        </header>

        <ol className="flex flex-col gap-3">
          {thread.messages.map((message) => {
            const mine = message.authorId !== null && message.authorId === viewerId;
            return (
              <li key={message.id} className="flex gap-3">
                <Avatar name={message.authorName} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px]">
                    <span className="text-ink font-semibold">
                      {mine ? "You" : message.authorName}
                    </span>
                    {message.fromBuildTeam ? (
                      <span className="text-brand-subtle-ink ml-1.5 text-[11px]">Build team</span>
                    ) : null}
                    <time dateTime={message.createdAt} className="text-ink-3 ml-2 text-[11px]">
                      {formatRelative(message.createdAt, now)}
                    </time>
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-[13px] leading-relaxed whitespace-pre-wrap",
                      message.fromBuildTeam ? "text-ink" : "text-ink-2",
                    )}
                  >
                    {message.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            const text = draft.trim();
            if (!text) return;
            onReply(text);
            setDraft("");
          }}
          className="border-line flex gap-2 border-t pt-3"
        >
          <label htmlFor={`reply-${thread.id}`} className="sr-only">
            Reply to {thread.title}
          </label>
          <Input
            id={`reply-${thread.id}`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Write a reply…"
            maxLength={4000}
          />
          <Button
            type="submit"
            variant="secondary"
            disabled={!draft.trim()}
            aria-label="Send reply"
          >
            <Send />
          </Button>
        </form>
      </article>
    </Card>
  );
}
