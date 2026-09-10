"use client";

import {
  Banknote,
  Bot,
  CalendarRange,
  FileText,
  GaugeCircle,
  HardHat,
  Images,
  CalendarCheck,
  Landmark,
  ListChecks,
  Mail,
  MessagesSquare,
  Truck,
  LayoutDashboard,
  LogOut,
  Menu,
  Printer,
  Settings,
  ShieldCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import { NotificationBell } from "@/components/layout/notification-center";
import { ThemeToggle } from "@/components/layout/theme-provider";
import { Button } from "@/components/ui/button";
import { CinePhoto } from "@/components/ui/cine-photo";
import { Avatar } from "@/components/ui/misc";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/overlay";
import { cn } from "@/lib/utils";
import { useGlassLight } from "@/components/layout/glass-light";
import { sceneForPath, sceneSrc, type SceneKey } from "@/lib/scenes";
import type { AppNotification, Profile, ProjectRole } from "@/types/database";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Anchor id for the first-run tour to point at. */
  tour?: string;
  /** Roles that see this item. Omitted means everyone. */
  roles?: ProjectRole[];
}

function navigationFor(projectSlug: string): { section: string; items: NavItem[] }[] {
  const base = `/projects/${projectSlug}`;
  return [
    {
      section: "Your home",
      items: [
        { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
        { href: `${base}/timeline`, label: "Timeline", icon: CalendarRange, tour: "nav-timeline" },
        { href: `${base}/updates`, label: "Site updates", icon: HardHat },
        { href: `${base}/gallery`, label: "Photographs", icon: Images },
      ],
    },
    {
      section: "Your decisions",
      items: [
        {
          href: `${base}/selections`,
          label: "Selections",
          icon: ListChecks,
          tour: "nav-selections",
        },
        { href: `${base}/questions`, label: "Questions", icon: MessagesSquare },
        { href: `${base}/visits`, label: "Site visits", icon: CalendarCheck },
      ],
    },
    {
      section: "Money & risk",
      items: [
        { href: `${base}/finance`, label: "Finance", icon: Banknote, tour: "nav-finance" },
        { href: `${base}/quality`, label: "Quality & snags", icon: ShieldCheck },
        { href: `${base}/analytics`, label: "Analytics", icon: GaugeCircle },
      ],
    },
    {
      section: "Your move",
      items: [{ href: `${base}/move-in`, label: "Move-in planner", icon: Truck }],
    },
    {
      section: "Paperwork",
      items: [
        { href: `${base}/documents`, label: "Documents", icon: FileText },
        { href: `${base}/report`, label: "Progress report", icon: Printer },
        { href: `${base}/lender-pack`, label: "Lender pack", icon: Landmark },
        { href: `${base}/digest`, label: "Weekly digest", icon: Mail },
      ],
    },
    {
      section: "Help",
      items: [
        { href: `${base}/assistant`, label: "AI assistant", icon: Bot, tour: "nav-assistant" },
      ],
    },
    {
      section: "Build team",
      items: [
        {
          href: "/builder",
          label: "Site console",
          icon: HardHat,
          roles: ["builder", "inspector"],
        },
      ],
    },
  ];
}

export function AppShell({
  children,
  profile,
  projectRole,
  projectSlug,
  projectName,
  organizationName,
  notifications,
  isDemo,
  now,
}: {
  children: React.ReactNode;
  profile: Profile | null;
  projectRole: ProjectRole | null;
  projectSlug: string;
  projectName: string;
  organizationName: string;
  notifications: AppNotification[];
  isDemo: boolean;
  now: string;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  useGlassLight();

  // Close the drawer on navigation -- otherwise it stays open over the page the
  // user just asked for. Done during render so the drawer is already gone on
  // the first frame of the new route, rather than flashing shut after it.
  const [drawerRoute, setDrawerRoute] = React.useState(pathname);
  if (drawerRoute !== pathname) {
    setDrawerRoute(pathname);
    setMobileOpen(false);
  }

  const sections = navigationFor(projectSlug)
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !item.roles || (projectRole && item.roles.includes(projectRole)),
      ),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="flex min-h-dvh flex-col">
      <AmbientBackdrop scene={sceneForPath(pathname)} />
      <a
        href="#main"
        className={cn(
          "bg-brand text-brand-ink sr-only px-4 py-2 text-sm font-medium",
          "focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100]",
        )}
      >
        Skip to main content
      </a>

      <TopBar
        profile={profile}
        projectName={projectName}
        organizationName={organizationName}
        notifications={notifications}
        now={now}
        isDemo={isDemo}
        onMenuToggle={() => setMobileOpen((v) => !v)}
        mobileOpen={mobileOpen}
      />

      <div className="mx-auto flex w-full max-w-[1600px] flex-1">
        <Sidebar sections={sections} pathname={pathname} mobileOpen={mobileOpen} />

        <main id="main" className="min-w-0 flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-8">
          {children}
        </main>
      </div>

      <MobileTabBar
        projectSlug={projectSlug}
        pathname={pathname}
        onMore={() => setMobileOpen(true)}
      />
    </div>
  );
}

/**
 * The scene behind the glass: the page's own photograph at a small size,
 * blurred past recognition, with slow emerald, navy and gold light. A 640px
 * rendition is plenty -- at this blur, detail is invisible and bytes are not.
 */
function AmbientBackdrop({ scene }: { scene: SceneKey }) {
  return (
    <div aria-hidden="true" className="ui-ambient">
      {/* eslint-disable-next-line @next/next/no-img-element -- a 640px Unsplash rendition blurred to colour; the optimiser would only add a hop */}
      <img src={sceneSrc(scene, 640)} alt="" className="ui-ambient__photo" decoding="async" />
      <span className="ui-ambient__glow ui-ambient__glow--emerald" />
      <span className="ui-ambient__glow ui-ambient__glow--navy" />
      <span className="ui-ambient__glow ui-ambient__glow--gold" />
    </div>
  );
}

/**
 * Bottom tab bar for small screens.
 *
 * Buyers check on their house from a phone, usually one-handed, so the four
 * things they actually open live within thumb reach instead of behind a
 * hamburger. "More" opens the full drawer, which remains the complete
 * navigation -- the tab bar is a shortcut, not a reduced version of the app.
 *
 * `pb-[env(safe-area-inset-bottom)]` keeps the row clear of the home indicator
 * on iOS, where a flush-bottom bar is partly untappable.
 */
function MobileTabBar({
  projectSlug,
  pathname,
  onMore,
}: {
  projectSlug: string;
  pathname: string;
  onMore: () => void;
}) {
  const base = `/projects/${projectSlug}`;
  const items: NavItem[] = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: `${base}/timeline`, label: "Timeline", icon: CalendarRange, tour: "nav-timeline" },
    { href: `${base}/updates`, label: "Updates", icon: HardHat },
    { href: `${base}/finance`, label: "Finance", icon: Banknote, tour: "nav-finance" },
  ];

  return (
    <nav
      aria-label="Quick navigation"
      className={cn(
        "ui-glass-bar fixed inset-x-0 bottom-0 z-40 border-t",
        "pb-[env(safe-area-inset-bottom)] lg:hidden",
      )}
    >
      <ul className="flex items-stretch">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  // 56px tall: comfortably above the 44px minimum touch target.
                  "flex h-14 flex-col items-center justify-center gap-1 border-t-2 text-[10px] font-medium",
                  active ? "border-accent text-ink" : "text-ink-3 border-transparent",
                )}
              >
                <item.icon
                  className="size-[18px]"
                  strokeWidth={active ? 2.25 : 1.75}
                  aria-hidden="true"
                />
                {item.label}
              </Link>
            </li>
          );
        })}

        <li className="flex-1">
          <button
            type="button"
            onClick={onMore}
            className="text-ink-3 flex h-14 w-full flex-col items-center justify-center gap-1 border-t-2 border-transparent text-[10px] font-medium"
          >
            <Menu className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
            More
          </button>
        </li>
      </ul>
    </nav>
  );
}

function TopBar({
  profile,
  projectName,
  organizationName,
  notifications,
  now,
  isDemo,
  onMenuToggle,
  mobileOpen,
}: {
  profile: Profile | null;
  projectName: string;
  organizationName: string;
  notifications: AppNotification[];
  now: string;
  isDemo: boolean;
  onMenuToggle: () => void;
  mobileOpen: boolean;
}) {
  return (
    <header className="ui-glass-bar sticky top-0 z-40 border-b">
      <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Button
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          onClick={onMenuToggle}
          aria-expanded={mobileOpen}
          aria-controls="app-sidebar"
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
        >
          {mobileOpen ? <X /> : <Menu />}
        </Button>

        <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden="true"
            className="ui-display bg-brand text-brand-ink grid size-7 shrink-0 place-items-center text-[15px]"
          >
            K
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="ui-display text-ink truncate text-[14px]">{projectName}</span>
            <span className="text-ink-3 truncate text-[11px]">{organizationName}</span>
          </span>
        </Link>

        {isDemo ? (
          <span className="ui-label bg-accent-subtle text-accent-subtle-ink border-accent/40 ml-1 hidden border px-2 py-0.5 text-[9px] sm:inline">
            Demo data
          </span>
        ) : null}

        <div className="ml-auto flex items-center gap-1">
          <NotificationBell notifications={notifications} now={now} />
          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="focus-visible:ring-ring ml-1 rounded-full focus-visible:ring-2 focus-visible:ring-offset-2"
                aria-label="Account menu"
              >
                <Avatar name={profile?.full_name} src={profile?.avatar_url} size="sm" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <span className="text-ink block truncate text-[13px] font-semibold normal-case">
                  {profile?.full_name ?? "Signed out"}
                </span>
                <span className="text-ink-3 block truncate text-[11px] font-normal normal-case">
                  {profile?.email ?? "No account"}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild destructive>
                <Link href="/logout">
                  <LogOut />
                  Sign out
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

function Sidebar({
  sections,
  pathname,
  mobileOpen,
}: {
  sections: { section: string; items: NavItem[] }[];
  pathname: string;
  mobileOpen: boolean;
}) {
  return (
    <>
      {/* Scrim behind the mobile drawer */}
      {mobileOpen ? (
        <div className="bg-overlay fixed inset-0 top-14 z-30 lg:hidden" aria-hidden="true" />
      ) : null}

      <nav
        id="app-sidebar"
        aria-label="Main"
        className={cn(
          "border-line bg-surface w-60 shrink-0 border-r",
          "lg:sticky lg:top-14 lg:block lg:h-[calc(100dvh-3.5rem)] lg:overflow-y-auto lg:bg-transparent",
          mobileOpen ? "fixed inset-y-0 top-14 left-0 z-40 block overflow-y-auto" : "hidden",
        )}
      >
        <div className="flex flex-col gap-5 px-3 py-5">
          {sections.map((section) => (
            <div key={section.section}>
              <p className="ui-label text-ink-3 mb-1.5 px-2.5 text-[9px]">{section.section}</p>
              <ul className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(item.href));

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        data-tour={item.tour}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-2.5 rounded-xl border px-3 py-2 text-[13px] font-medium",
                          "transition-colors duration-150",
                          active
                            ? "ui-glass-button text-ink"
                            : "text-ink-2 hover:bg-surface-3 hover:text-ink border-transparent",
                        )}
                      >
                        <item.icon
                          className="size-4 shrink-0"
                          strokeWidth={active ? 2.25 : 1.75}
                          aria-hidden="true"
                        />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>
    </>
  );
}

/**
 * Page heading with optional description and actions.
 *
 * With a `scene`, the heading becomes a cinematic band: a warm photograph
 * under a dark veil, the title set large across it. The band always renders
 * with the dark tokens (the `dark` class), so its type and buttons stay
 * correct over the photograph whatever theme the rest of the page is in.
 * Without one, it is the plain editorial head -- used for utility pages such
 * as settings, the digest and the site console.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
  scene,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  scene?: SceneKey;
}) {
  if (scene) {
    return (
      <div
        className={cn(
          "dark border-line text-ink relative isolate mb-8 overflow-hidden rounded-[var(--radius-card)] border",
          className,
        )}
      >
        <CinePhoto
          scene={scene}
          alt=""
          priority
          sizes="(min-width: 1024px) 75vw, 100vw"
          className="animate-slow-drift absolute inset-0 -z-20 size-full"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(0,0,0,0.84)_0%,rgba(0,0,0,0.5)_48%,rgba(0,0,0,0.12)_100%),linear-gradient(0deg,rgba(0,0,0,0.55)_0%,transparent_62%)]"
        />
        <div className="flex min-h-[280px] flex-col justify-end gap-5 p-6 sm:min-h-[340px] sm:p-10">
          <h1 className="ui-display text-ink text-[clamp(44px,6.4vw,96px)] leading-[0.9] tracking-[-0.055em]">
            {title}
          </h1>
          {description || actions ? (
            <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
              {description ? (
                <p className="text-ink-2 max-w-xl text-[15px] leading-relaxed">{description}</p>
              ) : (
                <span />
              )}
              {actions ? (
                <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // Editorial page head: a heavy rule, the title at structural size, then the
  // standfirst. The rule is the line every page hangs from.
  return (
    <div className={cn("mb-8 flex flex-col gap-4", className)}>
      <div className="border-line-strong flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-t-4 pt-5">
        <h1 className="ui-display text-ink min-w-0 text-[clamp(34px,4.6vw,64px)] leading-[0.94] tracking-[-0.05em]">
          {title}
        </h1>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {description ? (
        <p className="text-ink-2 max-w-2xl text-[14px] leading-relaxed">{description}</p>
      ) : null}
    </div>
  );
}
