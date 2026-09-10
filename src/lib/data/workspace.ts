import "server-only";

import { cache } from "react";

import { buildDemoDataset, type DemoDataset } from "@/lib/demo/dataset";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type {
  AppNotification,
  Milestone,
  Organization,
  Project,
  ProjectMember,
} from "@/types/database";

/**
 * The read path for project data.
 *
 * Each page names the tables it reads -- `getWorkspace(slug, ["milestones",
 * "payments"])` -- and receives exactly those, typed so that touching a table
 * it did not ask for is a compile error. A page that shows payments no longer
 * pays for the weather log.
 *
 * Tables that grow without bound as a build goes on -- site updates, their
 * photographs, question threads, notifications -- are not tables here at all.
 * They are feeds (`@/lib/data/feeds`), read a page at a time, so there is no
 * way to load a year of updates by accident.
 *
 * There are two implementations behind both -- Supabase and the demo dataset
 * -- and the rest of the app cannot tell which one answered. Pages therefore
 * have no `if (demo)` branches in them: demo mode is a data-layer concern,
 * not a rendering concern.
 *
 * Every table loader is wrapped in `cache()`, keyed by project id and table,
 * so a layout and three nested segments asking for milestones hit the
 * database once per request between them.
 */

/** Read page by page through `@/lib/data/feeds`, never whole. */
type FeedKey = "updates" | "media" | "discussionMessages" | "notifications" | "activity";

/** Every table a project page can ask for, by name. */
export type ProjectTables = Omit<DemoDataset, "organization" | "project" | FeedKey>;

/** A project table a page can ask for by name. */
export type TableKey = keyof ProjectTables;

export interface WorkspaceBase {
  /** Null when the viewer can see the project but not the organisation behind it. */
  organization: Organization | null;
  project: Project;
  /** True when the data came from the demo dataset rather than a database. */
  isDemo: boolean;
  /** Fixed instant for this render, so server and client agree on "now". */
  now: string;
}

/** The project plus the tables `K`, and nothing else. */
export type Workspace<K extends TableKey = never> = WorkspaceBase & Pick<ProjectTables, K>;

/** A Supabase client: the caller's session, or the service role in scheduled jobs. */
type Client = NonNullable<Awaited<ReturnType<typeof createClient>>>;

/** One instant per request, shared by every loader, so "now" never drifts mid-render. */
export const requestNow = cache(() => new Date().toISOString());

const demoDataset = cache(() => buildDemoDataset(new Date(requestNow())));

export type ProjectSource =
  | { kind: "demo"; data: DemoDataset }
  | { kind: "empty" }
  | { kind: "db"; project: Project; organization: Organization | null };

/**
 * Which project a request is about, and where its data lives.
 *
 * Without a slug this is the viewer's most recent project. RLS decides what
 * "most recent" can see, so a slug for someone else's project resolves to
 * nothing rather than to their house.
 */
export const projectSource = cache(async (slug?: string): Promise<ProjectSource> => {
  if (!isSupabaseConfigured()) return { kind: "demo", data: demoDataset() };

  const supabase = await createClient();
  if (!supabase) return { kind: "demo", data: demoDataset() };

  // The organisation rides along as an embedded row: one round trip, not two.
  const query = supabase.from("projects").select("*, organization:organizations(*)").limit(1);
  const { data: rows } = slug
    ? await query.eq("slug", slug)
    : await query.order("created_at", { ascending: false });

  const row = rows?.[0];
  if (!row) return { kind: "empty" };

  const { organization, ...project } = row as Project & { organization: Organization | null };
  return { kind: "db", project, organization };
});

type TableSpec = { table: string; order?: { column: string; ascending: boolean } };

/** Tables read by project id alone. `dependencies` and `profiles` are derived below. */
const TABLE_SPECS: Record<Exclude<TableKey, "dependencies" | "profiles">, TableSpec> = {
  members: { table: "project_members" },
  phases: { table: "phases", order: { column: "sequence", ascending: true } },
  milestones: { table: "milestones", order: { column: "sequence", ascending: true } },
  documents: { table: "documents", order: { column: "created_at", ascending: false } },
  budgetCategories: {
    table: "budget_categories",
    order: { column: "sequence", ascending: true },
  },
  costEntries: { table: "cost_entries", order: { column: "incurred_on", ascending: true } },
  payments: { table: "payments", order: { column: "sequence", ascending: true } },
  drawRequests: { table: "draw_requests", order: { column: "created_at", ascending: false } },
  changeOrders: { table: "change_orders", order: { column: "created_at", ascending: false } },
  inspections: { table: "inspections", order: { column: "scheduled_for", ascending: true } },
  issues: { table: "issues", order: { column: "created_at", ascending: false } },
  snapshots: { table: "progress_snapshots", order: { column: "captured_on", ascending: true } },
  // One row per day on site: bounded by the length of the build, and the delay
  // explanation needs all of it to attribute lost days.
  weather: { table: "weather_log", order: { column: "observed_on", ascending: false } },
  selectionCategories: {
    table: "selection_categories",
    order: { column: "sequence", ascending: true },
  },
  selectionOptions: {
    table: "selection_options",
    order: { column: "sequence", ascending: true },
  },
  discussions: { table: "discussions", order: { column: "last_message_at", ascending: false } },
  siteVisits: { table: "site_visits", order: { column: "starts_at", ascending: true } },
  // RLS limits this to the viewer's own rows: a move plan is personal.
  moveTasks: { table: "move_tasks" },
};

/**
 * One table for one project through a given client. `sibling` loads another
 * table of the same project, for the two tables that follow from others.
 */
async function fetchTable(
  supabase: Client,
  projectId: string,
  key: TableKey,
  sibling: (key: TableKey) => Promise<unknown[]>,
): Promise<unknown[]> {
  if (key === "dependencies") {
    // Dependencies are keyed by milestone, so they follow the milestones.
    const milestones = (await sibling("milestones")) as Milestone[];
    if (milestones.length === 0) return [];
    const { data } = await supabase
      .from("milestone_dependencies")
      .select("*")
      .in(
        "predecessor_id",
        milestones.map((m) => m.id),
      );
    return data ?? [];
  }

  if (key === "profiles") {
    // The people on this project -- not every profile the viewer can see.
    const members = (await sibling("members")) as ProjectMember[];
    if (members.length === 0) return [];
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .in(
        "id",
        members.map((m) => m.user_id),
      );
    return data ?? [];
  }

  const spec = TABLE_SPECS[key];
  const query = supabase.from(spec.table).select("*").eq("project_id", projectId);
  const { data } = spec.order
    ? await query.order(spec.order.column, { ascending: spec.order.ascending })
    : await query;
  return data ?? [];
}

/** One table for one project under the caller's session, fetched at most once per request. */
const loadTable = cache(async (projectId: string, key: TableKey): Promise<unknown[]> => {
  const supabase = await createClient();
  if (!supabase) return [];
  return fetchTable(supabase, projectId, key, (other) => loadTable(projectId, other));
});

/**
 * Tables for one project through an explicit client -- the scheduler's path,
 * which runs as the service role with no request to cache against.
 */
export async function loadTables<const K extends TableKey>(
  supabase: Client,
  projectId: string,
  keys: readonly K[],
): Promise<Pick<ProjectTables, K>> {
  const memo = new Map<TableKey, Promise<unknown[]>>();
  const load = (key: TableKey): Promise<unknown[]> => {
    let pending = memo.get(key);
    if (!pending) {
      pending = fetchTable(supabase, projectId, key, load);
      memo.set(key, pending);
    }
    return pending;
  };

  const unique = [...new Set(keys)];
  const rows = await Promise.all(unique.map(load));
  return Object.fromEntries(unique.map((key, index) => [key, rows[index]])) as Pick<
    ProjectTables,
    K
  >;
}

export async function getWorkspace<const K extends TableKey = never>(
  slug?: string,
  tables: readonly K[] = [],
): Promise<Workspace<K>> {
  const source = await projectSource(slug);
  const now = requestNow();
  const keys = [...new Set(tables)];

  if (source.kind === "demo") {
    const { data } = source;
    const picked = Object.fromEntries(keys.map((key) => [key, data[key]]));
    return {
      ...picked,
      organization: data.organization,
      project: data.project,
      isDemo: true,
      now,
    } as Workspace<K>;
  }

  if (source.kind === "empty") {
    // A signed-in user with no projects yet still needs a usable screen.
    // Falling back to the demo house here would be dishonest -- it would show
    // them someone else's home -- so every table comes back empty and the
    // project is a blank that pages test with `!project.id`.
    const placeholder = demoDataset().project;
    const empty = Object.fromEntries(keys.map((key) => [key, []]));
    return {
      ...empty,
      organization: null,
      project: { ...placeholder, id: "", name: "", slug: "" },
      isDemo: false,
      now,
    } as Workspace<K>;
  }

  const rows = await Promise.all(keys.map((key) => loadTable(source.project.id, key)));
  const loaded = Object.fromEntries(keys.map((key, index) => [key, rows[index]]));

  return {
    ...loaded,
    organization: source.organization,
    project: source.project,
    isDemo: false,
    now,
  } as Workspace<K>;
}

/**
 * The signed-in user's id, verified.
 *
 * `getClaims()` checks the token's signature -- locally, against the
 * project's published signing keys, when the project uses asymmetric keys, so
 * the common path costs no round trip to the auth server. Projects still on a
 * shared JWT secret fall back to asking the auth server, as `getUser()` did.
 */
export const getSignedInUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getClaims();
  return data?.claims.sub ?? null;
});

/**
 * The signed-in person and their role on the project, or the demo buyer when
 * there is no database.
 *
 * The profile is read by id rather than picked out of the project's member
 * list, so someone who has signed in but not yet been added to a project
 * still has a name and an avatar.
 */
export const getViewer = cache(async (slug?: string) => {
  const source = await projectSource(slug);

  if (source.kind === "demo") {
    const buyer = source.data.profiles.find((p) => p.role === "buyer")!;
    return { profile: buyer, projectRole: "buyer" as const, isDemo: true };
  }

  const supabase = await createClient();
  const userId = await getSignedInUserId();
  if (!supabase || !userId) return { profile: null, projectRole: null, isDemo: false };

  const [{ data: profile }, members] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    source.kind === "db"
      ? (loadTable(source.project.id, "members") as Promise<ProjectMember[]>)
      : Promise.resolve([] as ProjectMember[]),
  ]);
  const membership = members.find((m) => m.user_id === userId);

  return { profile: profile ?? null, projectRole: membership?.role ?? null, isDemo: false };
});

/** The viewer's most recent notifications, across every project they are on. */
export const getNotifications = cache(async (limit: number = 50): Promise<AppNotification[]> => {
  const source = await projectSource();
  if (source.kind === "demo") return source.data.notifications.slice(0, limit);

  const supabase = await createClient();
  if (!supabase) return [];

  // RLS limits this to the viewer's own rows.
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
});
