"use client";

import {
  Banknote,
  Bell,
  CheckCheck,
  FileText,
  HardHat,
  MessageSquare,
  OctagonAlert,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlay";
import { formatRelative } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { AppNotification, NotificationType } from "@/types/database";

const ICONS: Record<NotificationType, LucideIcon> = {
  update_posted: HardHat,
  milestone_completed: CheckCheck,
  milestone_delayed: OctagonAlert,
  document_added: FileText,
  document_ack_required: FileText,
  payment_due: Banknote,
  payment_received: Banknote,
  draw_decision: Banknote,
  change_order: FileText,
  inspection_result: ShieldCheck,
  issue_raised: OctagonAlert,
  message: MessageSquare,
};

/**
 * Notification bell with a live subscription.
 *
 * The initial list is server-rendered so the unread count is correct on first
 * paint; the realtime channel then appends anything that arrives while the tab
 * is open. When Supabase is not configured the subscription is simply never
 * opened and the seeded list stands -- no error, no empty state.
 */
export function NotificationBell({
  notifications: initial,
  now,
}: {
  notifications: AppNotification[];
  now: string;
}) {
  const [notifications, setNotifications] = React.useState(initial);
  const nowDate = React.useMemo(() => new Date(now), [now]);

  // Same shape as the updates feed: server-rendered list, extended live. A
  // fresh server list replaces the local one, adjusted during render.
  const [seenServerList, setSeenServerList] = React.useState(initial);
  if (seenServerList !== initial) {
    setSeenServerList(initial);
    setNotifications(initial);
  }

  React.useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          setNotifications((current) => [payload.new as AppNotification, ...current].slice(0, 50));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const unread = notifications.filter((n) => !n.read_at);

  const markAllRead = async () => {
    // Optimistic: the list updates immediately, then the write follows.
    const stamp = new Date().toISOString();
    setNotifications((current) => current.map((n) => ({ ...n, read_at: n.read_at ?? stamp })));

    const supabase = createClient();
    if (!supabase) return;
    await supabase.from("notifications").update({ read_at: stamp }).is("read_at", null);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative"
          aria-label={
            unread.length > 0
              ? `Notifications, ${unread.length} unread`
              : "Notifications, none unread"
          }
        >
          <Bell />
          {unread.length > 0 ? (
            <span
              aria-hidden="true"
              className={cn(
                "bg-critical absolute top-0.5 right-0.5 grid min-w-[15px] place-items-center rounded-full",
                "px-1 text-[9px] leading-[15px] font-bold text-white",
              )}
            >
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="border-line flex items-center justify-between border-b px-4 py-2.5">
          <h2 className="text-ink text-[13px] font-semibold">Notifications</h2>
          {unread.length > 0 ? (
            <Button variant="link" size="sm" onClick={markAllRead} className="text-[12px]">
              Mark all read
            </Button>
          ) : null}
        </div>

        <div className="max-h-96 scrollbar-thin overflow-y-auto">
          {notifications.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="Nothing yet"
              description="Updates, payments and milestones will show up here."
              className="m-3 border-0"
            />
          ) : (
            <ul className="divide-line divide-y">
              {notifications.map((notification) => {
                const Icon = ICONS[notification.type] ?? Bell;
                const unreadRow = !notification.read_at;

                return (
                  <li key={notification.id}>
                    <Link
                      href={notification.link ?? "#"}
                      className={cn(
                        "flex gap-3 px-4 py-3 transition-colors",
                        "hover:bg-surface-2",
                        unreadRow && "bg-brand-subtle/40",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full",
                          unreadRow
                            ? "bg-brand-subtle text-brand-subtle-ink"
                            : "bg-surface-3 text-ink-3",
                        )}
                      >
                        <Icon className="size-3.5" strokeWidth={2} aria-hidden="true" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "truncate text-[13px]",
                            unreadRow ? "text-ink font-semibold" : "text-ink-2 font-medium",
                          )}
                        >
                          {notification.title}
                        </p>
                        {notification.body ? (
                          <p className="text-ink-3 mt-0.5 line-clamp-2 text-[12px] leading-snug">
                            {notification.body}
                          </p>
                        ) : null}
                        <time
                          dateTime={notification.created_at}
                          className="text-ink-3 mt-1 block text-[11px]"
                        >
                          {formatRelative(notification.created_at, nowDate)}
                        </time>
                      </div>

                      {unreadRow ? (
                        <span
                          aria-label="Unread"
                          className="bg-brand mt-1.5 size-1.5 shrink-0 rounded-full"
                        />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
