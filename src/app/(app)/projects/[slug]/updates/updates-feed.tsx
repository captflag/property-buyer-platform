"use client";

import { HardHat, Search } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/feedback";
import { UpdateCard } from "@/components/widgets/update-card";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Milestone, Profile, Update, UpdateMedia, WorkStatus } from "@/types/database";

import { loadOlderUpdates } from "../feed-actions";

type Filter = "all" | WorkStatus;

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "blocked", label: "Blocked" },
];

/**
 * The site updates feed.
 *
 * The server sends the newest page; older pages load on request, and new
 * posts arrive live at the top. Filtering and search run on the client over
 * what is loaded -- instant, with no round-trip per keystroke -- and the
 * count below the filters says when there is more history than that, so an
 * empty search never reads as "this was never posted".
 */
export function UpdatesFeed({
  updates: initialUpdates,
  media: initialMedia,
  nextCursor: initialCursor,
  profiles,
  milestones,
  now,
  isDemo,
  projectId,
  slug,
}: {
  updates: Update[];
  media: UpdateMedia[];
  nextCursor: string | null;
  profiles: Profile[];
  milestones: Milestone[];
  slug: string;
  now: string;
  isDemo: boolean;
  projectId: string;
}) {
  const [updates, setUpdates] = React.useState(initialUpdates);
  const [media, setMedia] = React.useState(initialMedia);
  const [cursor, setCursor] = React.useState(initialCursor);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [isLoading, startLoading] = React.useTransition();
  const [filter, setFilter] = React.useState<Filter>("all");
  const [query, setQuery] = React.useState("");

  const nowDate = React.useMemo(() => new Date(now), [now]);

  // The feed is server-rendered but also grows from a realtime channel and
  // from older pages, so it is state seeded by props. When the server
  // revalidates and hands down a fresh first page, that page wins -- adjusted
  // during render rather than in an effect, which avoids a second render pass
  // showing stale rows.
  const [seenServerUpdates, setSeenServerUpdates] = React.useState(initialUpdates);
  if (seenServerUpdates !== initialUpdates) {
    setSeenServerUpdates(initialUpdates);
    setUpdates(initialUpdates);
    setMedia(initialMedia);
    setCursor(initialCursor);
  }

  // Live updates: a new post from site appears without a refresh.
  React.useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    const channel = supabase
      .channel(`updates:${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "updates",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const incoming = payload.new as Update;
          setUpdates((current) =>
            current.some((u) => u.id === incoming.id) ? current : [incoming, ...current],
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [projectId]);

  const loadOlder = () => {
    if (!cursor) return;
    setLoadError(null);
    startLoading(async () => {
      const page = await loadOlderUpdates(slug, cursor);
      if (!page) {
        setLoadError("Older updates could not be loaded. Try again.");
        return;
      }
      setUpdates((current) => {
        const seen = new Set(current.map((u) => u.id));
        return [...current, ...page.updates.filter((u) => !seen.has(u.id))];
      });
      setMedia((current) => [...current, ...page.media]);
      setCursor(page.nextCursor);
    });
  };

  const mediaByUpdate = React.useMemo(() => {
    const map = new Map<string, UpdateMedia[]>();
    for (const item of media) {
      const bucket = map.get(item.update_id) ?? [];
      bucket.push(item);
      map.set(item.update_id, bucket);
    }
    return map;
  }, [media]);

  const visible = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return updates.filter((update) => {
      if (filter !== "all" && update.status !== filter) return false;
      if (!needle) return true;
      return (
        update.title.toLowerCase().includes(needle) || update.body.toLowerCase().includes(needle)
      );
    });
  }, [updates, filter, query]);

  return (
    <div className="flex flex-col gap-4">
      {/* Filters sit in one row above the content, per the interaction rules. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          {FILTERS.map((option) => (
            <Button
              key={option.value}
              variant={filter === option.value ? "subtle" : "ghost"}
              size="sm"
              onClick={() => setFilter(option.value)}
              aria-pressed={filter === option.value}
            >
              {option.label}
            </Button>
          ))}
        </div>

        <div className="relative ml-auto w-full sm:w-64">
          <Search
            className="text-ink-3 pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search updates…"
            aria-label="Search site updates"
            className="pl-8"
          />
        </div>
      </div>

      <p aria-live="polite" className="text-ink-3 text-[12px]">
        {visible.length} of {updates.length} update{updates.length === 1 ? "" : "s"}
        {cursor ? " · older updates not loaded yet" : ""}
      </p>

      {visible.length === 0 ? (
        <EmptyState
          icon={HardHat}
          title="No updates match"
          description={
            query
              ? `Nothing loaded so far matches “${query}”. Try a different word, clear the filters, or load older updates.`
              : "There are no updates with that status among those loaded."
          }
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setQuery("");
                setFilter("all");
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <ol className={cn("flex flex-col gap-4")}>
          {visible.map((update) => (
            <li key={update.id}>
              <UpdateCard
                update={update}
                media={mediaByUpdate.get(update.id) ?? []}
                author={profiles.find((p) => p.id === update.author_id)}
                milestone={milestones.find((m) => m.id === update.milestone_id)}
                now={nowDate}
                isDemo={isDemo}
                slug={slug}
              />
            </li>
          ))}
        </ol>
      )}

      {cursor ? (
        <div className="flex flex-col items-center gap-2 pt-2">
          <Button variant="secondary" onClick={loadOlder} disabled={isLoading}>
            {isLoading ? "Loading…" : "Load older updates"}
          </Button>
          {loadError ? (
            <p role="alert" className="text-critical-ink text-[12px]">
              {loadError}
            </p>
          ) : null}
        </div>
      ) : updates.length > 0 ? (
        <p className="text-ink-3 pt-2 text-center text-[12px]">
          That is every update since the build began.
        </p>
      ) : null}
    </div>
  );
}
