import { MessageSquare } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import type { DiscussionSubject } from "@/types/database";

/**
 * "Ask about this" -- a question attached to a specific thing.
 *
 * A link rather than an inline chat widget: the questions page already holds
 * every thread, and routing there with the subject pre-filled means a card in
 * any list can offer this without every list having to load and pass down the
 * whole discussion history. Context is carried in the URL, so the question
 * arrives already knowing what it is about.
 */
export function AskAboutLink({
  slug,
  kind,
  id,
  className,
  label = "Ask about this",
}: {
  slug: string;
  kind: DiscussionSubject;
  id: string;
  className?: string;
  label?: string;
}) {
  return (
    <Link
      href={`/projects/${slug}/questions?about=${kind}:${id}`}
      className={cn(
        "text-ink-3 hover:text-brand inline-flex items-center gap-1 text-[11px] font-medium",
        "transition-colors duration-150",
        className,
      )}
    >
      <MessageSquare className="size-3" aria-hidden="true" />
      {label}
    </Link>
  );
}
