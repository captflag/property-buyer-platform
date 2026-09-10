import { AlertTriangle, CheckCircle2, Clock, Lock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { SelectionUrgency } from "@/lib/domain/selections";
import { formatDate } from "@/lib/format";

/**
 * The deadline pill for a decision.
 *
 * Wording changes with distance, because "12 Oct" and "4 days left" carry
 * different urgency even when they name the same day: far-off deadlines read
 * as dates, near ones as a countdown, missed ones as how long ago.
 */
export function DeadlineBadge({
  urgency,
  daysLeft,
  deadline,
  size = "sm",
}: {
  urgency: SelectionUrgency;
  daysLeft: number | null;
  deadline: string | null;
  size?: "sm" | "md";
}) {
  switch (urgency) {
    case "locked":
      return (
        <Badge tone="good" icon={Lock} size={size}>
          Confirmed
        </Badge>
      );
    case "chosen":
      return (
        <Badge tone="brand" icon={CheckCircle2} size={size}>
          Chosen · awaiting confirmation
        </Badge>
      );
    case "overdue": {
      const ago = Math.abs(daysLeft ?? 0);
      return (
        <Badge tone="critical" icon={AlertTriangle} size={size}>
          Overdue by {ago} day{ago === 1 ? "" : "s"}
        </Badge>
      );
    }
    case "urgent":
      return (
        <Badge tone="serious" icon={Clock} size={size}>
          {daysLeft === 0 ? "Due today" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
        </Badge>
      );
    case "soon":
      return (
        <Badge tone="warning" icon={Clock} size={size}>
          {daysLeft} days left
        </Badge>
      );
    default:
      return (
        <Badge tone="neutral" icon={Clock} size={size}>
          {deadline ? `Due ${formatDate(deadline, "short")}` : "No deadline yet"}
        </Badge>
      );
  }
}
