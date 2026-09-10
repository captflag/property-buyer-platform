"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle, CardToolbar } from "@/components/ui/card";
import {
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@/components/ui/form";
import { Separator } from "@/components/ui/feedback";
import type { NotificationPreferences } from "@/lib/data/preferences";
import type { DigestFrequency } from "@/lib/domain/digest-delivery";
import type { NotificationType } from "@/types/database";

import { saveNotificationPreferences } from "./actions";

const CATEGORIES: Array<{ type: NotificationType; label: string; detail: string }> = [
  {
    type: "update_posted",
    label: "Site updates",
    detail: "A new report is posted from site.",
  },
  {
    type: "milestone_completed",
    label: "Milestones",
    detail: "A stage of the build completes, or becomes blocked.",
  },
  {
    type: "payment_due",
    label: "Payments",
    detail: "A stage payment falls due, or a payment is recorded.",
  },
  {
    type: "document_added",
    label: "Documents",
    detail: "A document is added, or one needs your acknowledgement.",
  },
  {
    type: "issue_raised",
    label: "Issues & inspections",
    detail: "A defect is raised, or an inspection result is recorded.",
  },
];

/**
 * Notification preferences, saved to `notification_preferences`.
 *
 * Each category toggle is one `muted_types` entry. The weekly digest is sent
 * only to people who choose "Weekly digest" here with email switched on --
 * nobody receives it without having asked.
 */
export function NotificationSettings({
  initial,
  digestHref,
}: {
  initial: NotificationPreferences;
  digestHref?: string;
}) {
  const [saved, setSaved] = React.useState(initial);
  const [email, setEmail] = React.useState(initial.emailEnabled);
  const [push, setPush] = React.useState(initial.pushEnabled);
  const [digest, setDigest] = React.useState<DigestFrequency>(initial.digestFrequency);
  const [muted, setMuted] = React.useState<Set<NotificationType>>(new Set(initial.mutedTypes));
  const [status, setStatus] = React.useState<string | null>(null);
  const [isSaving, startSaving] = React.useTransition();

  const current: NotificationPreferences = {
    emailEnabled: email,
    pushEnabled: push,
    digestFrequency: digest,
    mutedTypes: [...muted].sort(),
  };
  const dirty =
    current.emailEnabled !== saved.emailEnabled ||
    current.pushEnabled !== saved.pushEnabled ||
    current.digestFrequency !== saved.digestFrequency ||
    current.mutedTypes.join() !== [...saved.mutedTypes].sort().join();

  const toggle = (type: NotificationType) => {
    setStatus(null);
    setMuted((existing) => {
      const next = new Set(existing);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const save = () => {
    startSaving(async () => {
      const result = await saveNotificationPreferences(current);
      setStatus(result.message);
      if (result.ok) setSaved(current);
    });
  };

  return (
    <Card>
      <CardToolbar>
        <div>
          <CardTitle as="h2">Notifications</CardTitle>
          <CardDescription>What you hear about, and how often</CardDescription>
        </div>
        <Bell className="text-ink-3 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      </CardToolbar>

      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="email-toggle">Email</Label>
            <p className="text-ink-3 mt-0.5 text-[12px]">Send notifications to your inbox.</p>
          </div>
          <Switch
            id="email-toggle"
            checked={email}
            onCheckedChange={(value) => {
              setStatus(null);
              setEmail(value);
            }}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="push-toggle">Push</Label>
            <p className="text-ink-3 mt-0.5 text-[12px]">Alerts on your phone or browser.</p>
          </div>
          <Switch
            id="push-toggle"
            checked={push}
            onCheckedChange={(value) => {
              setStatus(null);
              setPush(value);
            }}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="digest-select">Frequency</Label>
            <p className="text-ink-3 mt-0.5 text-[12px]">
              Anything marked urgent still arrives immediately.
            </p>
          </div>
          <Select
            value={digest}
            onValueChange={(value) => {
              setStatus(null);
              setDigest(value as DigestFrequency);
            }}
          >
            <SelectTrigger id="digest-select" className="w-40" aria-label="Notification frequency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="instant">As it happens</SelectItem>
              <SelectItem value="daily">Daily digest</SelectItem>
              <SelectItem value="weekly">Weekly digest</SelectItem>
              <SelectItem value="never">Never</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {digestHref ? (
          <p className="text-ink-3 -mt-2 text-[12px]">
            <Link href={digestHref} className="text-brand font-medium hover:underline">
              Preview this week&apos;s digest
            </Link>{" "}
            to see exactly what a weekly email contains.
          </p>
        ) : null}

        <Separator />

        <fieldset>
          <legend className="text-ink-3 mb-3 text-[11px] font-semibold tracking-wide uppercase">
            Categories
          </legend>
          <ul className="flex flex-col gap-3">
            {CATEGORIES.map((category) => (
              <li key={category.type} className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <Label htmlFor={`cat-${category.type}`}>{category.label}</Label>
                  <p className="text-ink-3 mt-0.5 text-[12px]">{category.detail}</p>
                </div>
                <Switch
                  id={`cat-${category.type}`}
                  checked={!muted.has(category.type)}
                  onCheckedChange={() => toggle(category.type)}
                />
              </li>
            ))}
          </ul>
        </fieldset>

        <div className="flex items-center justify-end gap-3">
          <p role="status" className="text-ink-3 text-[12px]">
            {status}
          </p>
          <Button variant="primary" size="sm" onClick={save} disabled={!dirty || isSaving}>
            {isSaving ? "Saving…" : "Save preferences"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
