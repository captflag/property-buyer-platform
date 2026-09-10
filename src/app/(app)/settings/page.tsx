import { Database, Palette, ShieldCheck, User } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardTitle, CardToolbar } from "@/components/ui/card";
import { Avatar } from "@/components/ui/misc";
import { Separator } from "@/components/ui/feedback";
import { getNotificationPreferences } from "@/lib/data/preferences";
import { getViewer, getWorkspace } from "@/lib/data/workspace";
import { isAiConfigured, isSupabaseConfigured } from "@/lib/env";
import { humanise } from "@/lib/format";

import { NotificationSettings } from "./notification-settings";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [w, viewer, preferences] = await Promise.all([
    getWorkspace(),
    getViewer(),
    getNotificationPreferences(),
  ]);

  const supabaseOn = isSupabaseConfigured();
  const aiOn = isAiConfigured();

  return (
    <>
      <PageHeader title="Settings" description="Your account, notifications and platform status." />

      <div className="flex max-w-3xl flex-col gap-4">
        <Card>
          <CardToolbar>
            <div>
              <CardTitle as="h2">Profile</CardTitle>
              <CardDescription>How you appear to the rest of the project</CardDescription>
            </div>
            <User className="text-ink-3 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          </CardToolbar>
          <CardContent>
            <div className="flex items-center gap-4">
              <Avatar name={viewer.profile?.full_name} src={viewer.profile?.avatar_url} size="lg" />
              <div className="min-w-0">
                <p className="text-ink text-[15px] font-semibold">
                  {viewer.profile?.full_name ?? "Not signed in"}
                </p>
                <p className="text-ink-3 text-[13px]">{viewer.profile?.email ?? "—"}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {viewer.profile ? (
                    <Badge tone="brand">{humanise(viewer.profile.role)}</Badge>
                  ) : null}
                  {viewer.projectRole ? (
                    <Badge tone="outline">
                      {humanise(viewer.projectRole)} on {w.project.name}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <NotificationSettings
          initial={preferences}
          digestHref={w.project.id ? `/projects/${w.project.slug}/digest` : undefined}
        />

        <Card>
          <CardToolbar>
            <div>
              <CardTitle as="h2">Appearance</CardTitle>
              <CardDescription>
                The theme follows your system setting unless you override it from the toolbar.
              </CardDescription>
            </div>
            <Palette className="text-ink-3 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          </CardToolbar>
          <CardContent>
            <p className="text-ink-2 text-[13px] leading-relaxed">
              Both themes use the same palette, stepped separately for each background rather than
              inverted — so charts stay readable and colourblind-safe in either. Reduced-motion and
              high-contrast preferences are respected automatically.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardToolbar>
            <div>
              <CardTitle as="h2">Platform status</CardTitle>
              <CardDescription>What is connected in this deployment</CardDescription>
            </div>
            <Database
              className="text-ink-3 size-4 shrink-0"
              strokeWidth={1.75}
              aria-hidden="true"
            />
          </CardToolbar>
          <CardContent className="flex flex-col gap-3">
            <StatusRow
              label="Database & auth"
              detail={
                supabaseOn
                  ? "Connected to Supabase. Row-level security is enforcing per-project access."
                  : "Not configured. The app is serving the built-in demonstration dataset."
              }
              ok={supabaseOn}
            />
            <Separator />
            <StatusRow
              label="AI assistant"
              detail={
                aiOn
                  ? "A model key is present, so the assistant answers in natural language grounded in your project records."
                  : "No model key. The assistant falls back to a built-in responder that reads the same records."
              }
              ok={aiOn}
            />
            <Separator />
            <StatusRow
              label="Realtime"
              detail={
                supabaseOn
                  ? "Live subscriptions are active for updates, notifications and milestones."
                  : "Inactive without a database. Seeded data is served on each request instead."
              }
              ok={supabaseOn}
            />
          </CardContent>
        </Card>

        <Card>
          <CardToolbar>
            <div>
              <CardTitle as="h2">Data & privacy</CardTitle>
            </div>
            <ShieldCheck
              className="text-ink-3 size-4 shrink-0"
              strokeWidth={1.75}
              aria-hidden="true"
            />
          </CardToolbar>
          <CardContent>
            <ul className="text-ink-2 flex flex-col gap-2 text-[13px] leading-relaxed">
              <li>
                Project documents and photographs live in private storage buckets. Files reach your
                browser through short-lived signed links, so a leaked path is not a leaked document.
              </li>
              <li>
                Access is decided in the database itself, not in the interface. Hiding a button is a
                courtesy; the rule that matters runs on every query.
              </li>
              <li>
                Conversations with the assistant are private to you and are never shown to the build
                team.
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function StatusRow({ label, detail, ok }: { label: string; detail: string; ok: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-ink text-[13px] font-medium">{label}</p>
        <p className="text-ink-3 mt-0.5 text-[12px] leading-relaxed">{detail}</p>
      </div>
      <Badge tone={ok ? "good" : "neutral"} className="shrink-0">
        {ok ? "Connected" : "Demo mode"}
      </Badge>
    </div>
  );
}
