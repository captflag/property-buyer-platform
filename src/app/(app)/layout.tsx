import { AppShell } from "@/components/layout/app-shell";
import { OnboardingTour } from "@/components/layout/onboarding-tour";
import { ToastProvider } from "@/components/ui/toast";
import { getNotifications, getViewer, getWorkspace } from "@/lib/data/workspace";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // The shell needs the project's name, the viewer and their notifications --
  // no project tables, so it adds nothing to what each page loads.
  const [workspace, viewer, notifications] = await Promise.all([
    getWorkspace(),
    getViewer(),
    getNotifications(),
  ]);

  return (
    <AppShell
      profile={viewer.profile}
      projectRole={viewer.projectRole}
      projectSlug={workspace.project.slug || "kestrel-house"}
      projectName={workspace.project.name || "No project yet"}
      organizationName={workspace.organization?.name ?? ""}
      notifications={notifications}
      isDemo={workspace.isDemo}
      now={workspace.now}
    >
      <ToastProvider>
        {children}
        <OnboardingTour />
      </ToastProvider>
    </AppShell>
  );
}
