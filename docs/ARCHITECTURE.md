# Architecture

## The shape of it

Next.js App Router, rendering on the server by default. Client components exist only where there is genuine interactivity: chart hover, filters, the assistant transcript, realtime subscriptions, and the theme toggle.

```
Browser
  │
  ├─ Server Components ──► getWorkspace(slug, tables) ──┬─► Supabase (RLS applies)
  │                        feeds (paged)  ───────────────┴─► Demo dataset (deterministic)
  │
  ├─ Server Actions ─────► Zod validation ──► Supabase (RLS applies)
  │
  └─ Client Components ──► Supabase Realtime (subscriptions only)
```

## Data access

**Pages name the tables they read.** `getWorkspace(slug, ["milestones", "payments"])` in `src/lib/data/workspace.ts` returns the project plus exactly those tables, and the return type is narrowed to match — a page that reads `w.weather` without asking for it does not compile. Helpers that need a fixed set export it (`DERIVE_TABLES`, `ASSISTANT_TABLES`, `CALENDAR_TABLES`), and pages spread it into their own list.

Two implementations sit behind every read — Supabase and the demo dataset — and callers cannot tell which answered. That is deliberate. The alternative, letting each page decide, would spread `if (demo)` branches through the rendering code and guarantee that demo mode drifts out of sync with the real one. Here, demo mode is a data-layer concern and nothing else.

Each table loader is wrapped in React's `cache()`, keyed by project id and table, so a layout and three nested segments asking for milestones hit the database once per request between them. `requestNow()` is cached the same way: one instant per request, shared by every loader.

### Feeds: the tables that never stop growing

Site updates, their photographs, question threads and notifications grow for as long as the build runs, so they are not tables at all — `getWorkspace` cannot load them. They are read through `src/lib/data/feeds.ts`, a page at a time:

- **Keyset cursors, not offsets.** A page ends at the last row's `(timestamp, id)`; the next page is everything strictly older. Page forty costs the same as page one, and a post arriving mid-scroll never shifts a row onto two pages. The id breaks ties, so two updates published in the same instant cannot straddle a boundary and vanish.
- **Cursors are untrusted.** They come back from the browser and are interpolated into a PostgREST filter, so anything that is not exactly an ISO timestamp and a uuid is treated as no cursor at all.
- **Windows match what a page shows.** The dashboard asks for the three latest updates and whatever changed since the last visit; the digest asks for its week; the report and the updates page count the month in the database rather than loading it to add it up.

Older pages load through server actions (`projects/[slug]/feed-actions.ts`) that re-validate the slug and cursor and read under the caller's own session.

### Why still a batch per page rather than per-component queries

A page's tables are fetched in one parallel batch, which is faster than a dozen component-level round trips and keeps derived figures consistent: every widget on the page computes from the same snapshot, so the dashboard cannot show 62.4% in one card and 62.7% in another. Scoping the batch to the page is what keeps that cheap as a project grows.

## The domain layer

`src/lib/domain/` holds the logic worth being careful about. All of it is pure: plain data in, plain data out, no React, no I/O.

**`schedule.ts`** — Critical Path Method. A topological sort, a forward pass for early start/finish, a backward pass for late start/finish, then total and free float. Supports all four dependency types (FS, SS, FF, SF) with lag.

Two decisions worth noting:

- *Cycles are reported, not thrown.* A user-editable dependency graph will sometimes contain a loop. A Gantt chart that renders with one edge dropped and a warning is far more useful than a page that refuses to render.
- *This is the only CPM implementation.* `milestones.is_critical` is written from this function's output rather than recomputed in SQL. Two implementations would eventually disagree, and the disagreement would be invisible.

**`finance.ts`** — budget rollups, contract position, payment summaries, draw pipeline. Committed spend counts against budget alongside actual, because an order that is placed will land, and a report that ignores it is optimistic in exactly the way that causes overruns to be noticed late.

**`forecast.ts`** — earned value (SPI, CPI, EAC, VAC), completion forecasting, and health scoring. The forecast fits a least-squares line over the trailing window of progress snapshots and returns a date, a band from the residual spread, an r², and a confidence label. It returns `null` rather than a date when work has stalled, because a stalled project has no slope to extrapolate.

Health scoring weights schedule 40, cost 30, quality 20, weather 10, and returns the per-factor contributions so the UI can always show its working.

**`selections.ts`** — decision deadlines (linked milestone start − longest option lead time − buffer, unless one is set explicitly), urgency bands, the options whose lead time can no longer be met, and a plain-English consequence for each open choice.

**`delay.ts`** — explains a forecast slip from the records: weather, approved change orders, blocked or overdue critical-path work, serious issues on critical work, overdue selections. Critical-path causes sort first. It reports correlation from the records and says so; it does not assign blame.

**`since.ts`** — the "since you last looked" diff. The buyer's own messages are excluded, and a selection appears only when it *became* urgent in the window, not every time it is still urgent.

**`move-in.ts`**, **`visits.ts`**, **`digest.ts`** — the move plan anchored to a handover date; bookable visit slots computed in the site's time zone with `Intl` (so DST is the platform's problem, not ours); and digest composition, kept separate from delivery.

`lib/data/derived.ts` computes all of the above once per request, so the dashboard, selections page, digest, calendar and assistant cannot disagree about a deadline. `lib/calendar.ts` is an RFC 5545 encoder: CRLF line endings, 75-octet folding by bytes (not characters), exclusive `DTEND` on all-day events, stable `UID`s so a re-import updates rather than duplicates.

## The database

32 tables. The full schema is in `supabase/migrations/`.

**Buyers edit through functions, not UPDATE policies.** RLS cannot restrict which columns an UPDATE touches, so a buyer choosing a finish or marking the project as seen goes through `choose_selection` and `mark_project_seen` — `SECURITY DEFINER` functions that change exactly the columns they are meant to and refuse confirmed or locked choices. Buyer-raised snags are an `INSERT` policy that pins `reported_by` to the caller, `status` to open and the assignee to nobody; the photo path must sit under `<project>/snags/<caller>/`.

**Every project-scoped table carries `project_id`,** even where it could be reached through a join. RLS runs per row, so a policy that resolves in one index lookup rather than a join chain is the difference between a fast query and a slow one.

**Access helpers are `SECURITY DEFINER` with a pinned `search_path`.** Both properties matter:

- `DEFINER` lets a policy on `project_members` ask "is this user a member?" without re-entering that table's own policy and recursing forever.
- Pinning `search_path` stops a caller shadowing `public` with their own schema and having the definer execute their functions with elevated rights.

**Policies are written to be evaluated once per query, not once per row** (`20260101000500_rls_performance.sql`):

- `auth.uid()` is always `(select auth.uid())`, which the planner hoists into an InitPlan and computes once instead of calling for every row.
- Membership is a set, not a per-row call: `project_id in (select my_project_ids())` builds the caller's projects once and probes it, where `is_project_member(project_id)` ran a lookup per row — ten thousand photographs meant ten thousand lookups. Admins short-circuit through `(select is_admin())`, so their check never enumerates projects.
- The single-id helpers (`is_project_member`, `can_write_project`) remain for RPC functions and triggers, where one lookup is the right tool.

**Policies are split per command** rather than using `FOR ALL`. `USING` and `WITH CHECK` mean different things on insert versus update, and collapsing them hides mistakes.

The read/write split is: project membership grants read; the `builder` or `inspector` role on that project grants write. Confidential documents are the one extra rule — they are internal to the build team and never reach the buyer.

**Storage buckets are private.** Paths are `<project_id>/<rest>`, so the first segment is the tenant key and the same membership helpers gate the bytes. Files reach the browser through short-lived signed URLs; a leaked path grants nothing.

## Server actions

Every action validates with Zod before touching the database, and re-checks authorisation server-side. The UI hides controls a user cannot use, but that is a courtesy — the check that matters is in the action, backed by RLS underneath.

In demo mode actions return an explicit "not saved" result rather than pretending to succeed. Silently discarding a write would be worse than refusing it.

## Operations

**Signing in costs no round trip.** The proxy runs on every request, and it now verifies the session with `getClaims()`, which checks the token's signature locally when the Supabase project uses asymmetric signing keys. `getUser()`, which it replaced, asked the auth server every time. `getViewer` uses the same check.

**Rate limits** (`src/lib/rate-limit.ts`) cover what costs money or reaches other people: assistant questions, snag reports, questions and visit requests. A signed-in person is counted in Postgres (`hit_rate_limit()`), so every server instance shares one counter; an anonymous caller is counted in memory against their address. The limits protect cost and the build team's attention, not access — RLS still decides access — so if the counter is unavailable the request goes through and the failure is logged.

**Errors and health.** `src/instrumentation.ts` turns every error Next catches into one structured JSON line (`src/lib/log.ts`); `/api/health` answers 200 or 503 for monitors and readiness probes.

**The weekly digest is sent by a scheduler** (`/api/cron/digest`, `src/lib/data/digest-run.ts`). It runs as the service role, works through active projects in batches, composes each project's digest once from the same derivations as the digest page, and emails the members who chose it. Each send is claimed in `digest_deliveries` before the email goes out, so repeated or overlapping runs never send twice; a run that hits its time budget reports `complete: false` for the scheduler to call again.

**The site console spans sites.** `portfolio_health()` returns `project_health` for every project the caller can see in one call. The console lists them, the ones needing attention first, and `?project=` points it at any one of them.

**The assistant's grounding has a ceiling.** Each list in the context is capped — the rows a buyer is most likely to ask about, then a count of the rest and the page that has them — and the whole is held under `MAX_CONTEXT_CHARS`, so the size and cost of a model call stay flat as a project grows. A typical house fits under every cap and is described in full.

## Rendering and hydration

Two classes of hydration bug were designed out rather than patched:

**Time.** `requestNow()` stamps a single `now` for the request, and every workspace and feed read shares it. `formatRelative` takes that instant as an explicit parameter instead of reading `Date.now()` internally, so the server and the client cannot disagree about what "3 hours ago" means.

**Dates.** `parseDate` reads `YYYY-MM-DD` as UTC midnight. `new Date("2026-03-15T00:00:00")` is *local*, and mixing the two shifts calendar dates by a day for anyone west of Greenwich. Everything date-shaped goes through that one function.

The theme toggle renders a stable placeholder until mounted, because `useTheme` cannot know the resolved theme during SSR.

## Client boundary

A subtlety that cost a build failure: **anything exported from a `"use client"` module becomes a client reference**, including a re-export. Server components cannot pass a function — such as a Lucide icon component — across that boundary.

So `EmptyState`, `Alert`, `Skeleton` and `Separator` live in `components/ui/feedback.tsx` with *no* directive. They take icon components as props and are used from server pages. `components/ui/misc.tsx` keeps the directive for the Radix-backed components that genuinely need it.

Likewise `seriesColour` lives in `lib/palette.ts` rather than in the chart module, because server components resolve phase colours too.

## Charts

Hand-rolled SVG, not a charting library. More code, but it buys:

- colours that are CSS custom properties, so theme switching is free and correct;
- real focusable elements — Gantt bars are `<button>`s, so the schedule is keyboard-navigable;
- no bundle cost and no library upgrade treadmill;
- exact control over the mark specs the palette validation depends on.

Every chart renders inside `ChartFrame`, which supplies the legend, the table view and the accessible description. Those are not optional decorations — the light-mode palette's contrast result obligates a table or direct labels, and the frame is how that obligation is met once rather than per chart.

## Testing

184 unit tests over the domain layer, the calendar encoder, keyset paging, the read path in demo mode, the assistant's context ceiling, rate limiting and the digest's recipient rules. They target the places where an error produces a *plausible wrong number* rather than a crash: float calculation on a parallel branch, committed spend tipping a category over budget, a forecast asked to extrapolate stalled work, a health factor that should have been capped.

Expected values are hand-computed and written into the tests rather than snapshotted, so a regression surfaces as a wrong number rather than an updated fixture.

## Known boundaries

Things that are correct now and would need revisiting at a different scale:

- **Money is `number`.** Safe for a single build; not safe for portfolio-wide aggregation. That would want integer minor units.
- **Search covers what is loaded.** The updates feed and the gallery page from the server, but their search and phase filters run over the pages loaded so far, and say so. Searching a whole history would want the `updates_search_idx` full-text index behind a server query.
- **A link to an old update** (`/updates#id`) only scrolls to it once that page is loaded. Threads about an older update still show its title, which is fetched on its own.
- **The digest scheduler starts from the top each run**, skipping projects whose members were already sent this week's digest. Cheap into the thousands of projects; well beyond that it would want a stored cursor.
- **Anonymous rate limits are per instance.** Callers without an account are counted in memory, so N instances allow N times the limit. They reach no real data, which is why that was accepted.
- **The schedule reckons in calendar days.** Construction schedules often work in working days. `computeSchedule` is where a calendar would be injected, and the traversal would not change.
- **The calendar is a download, not a subscription.** Calendar apps poll a feed without a session cookie, so a live feed needs per-user signed tokens in the URL. An unauthenticated feed would leak payment amounts, so it was left out rather than half-built; until then, a buyer re-downloads when dates move.
- **Only the weekly digest is sent.** Settings also offer a daily digest — the table's default — but nothing composes or sends one yet, so a daily subscriber currently receives no digest email.
- **Visit sessions are one weekly pattern** (`DEFAULT_VISIT_RULES`). Per-site hours or holiday closures would want the rules stored per project.
- **`recompute_critical_path` is application-side.** Deliberate, to keep one CPM implementation — but it means `is_critical` is only as fresh as the last write through the app.
