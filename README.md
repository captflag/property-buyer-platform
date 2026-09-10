# Property Buyer Platform

Transparent, real-time visibility into a construction project — schedule, cost, quality and documents — for the person whose home is being built.

This is version 2, a rebuild of [captflag/property-buyer-platform](https://github.com/captflag/property-buyer-platform) on Next.js 16, TypeScript and Supabase.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. **No database and no API keys are needed** — the app boots into a fully populated example project so every screen has real-shaped data behind it.

---

## What it does

**For the buyer**

- **Overview** — weighted completion, schedule variance, spend, next payment, project health, and what is happening on site right now.
- **Timeline** — a real critical-path model. Every milestone shows its planned window, its progress, and how many days of float it has before the completion date moves.
- **Site updates** — a live feed with crew size, hours worked, weather and photographs on every entry, so a quiet week has a visible reason.
- **Documents** — permits, drawings, contracts, certificates and warranties, searchable and versioned, with acknowledgements recorded.
- **Finance** — budget against committed and actual spend by category, the stage payment schedule, draw requests, and change orders with their true effect on the contract value.
- **Quality** — open defects by severity, and every statutory inspection with its result.
- **Analytics** — earned value (SPI, CPI, EAC), completion forecasting with a confidence band, and float by phase.
- **Photographs** — every site photo in one gallery, grouped by month, with a keyboard-navigable lightbox and a before/after comparison slider.
- **Progress report** — a printable, A4-ready document of the whole project state. Print or save as PDF.
- **AI assistant** — answers grounded in the project's own records, citing the entries it used.

**Your decisions**

- **Selections & finishes** — every choice the buyer owes (tiles, flooring, kitchen, sockets…) with its options, price against the standard specification, supplier lead time and a real deadline. Options whose lead time can no longer be met are flagged before they are picked, not after.
- **Since you last looked** — what changed since the buyer last caught up: updates, payments, documents, answers, newly urgent decisions. Nothing clears it except an explicit "mark all as seen".
- **Delay explanation** — when the forecast slips past the contract date, the dashboard says why in the same moment: weather, approved changes, blocked or overdue critical work, late decisions.
- **Questions** — "Ask about this" on any update, document or issue opens a thread that stays attached to the thing it is about.
- **Snag reporting** — report a defect from a phone on site: room, what's wrong, how bad, and a photo straight from the camera.
- **Site visits** — book an escorted visit from real free sessions in the site's own time zone; the site manager confirms from the console.

**Your move**

- **Move-in planner** — nineteen tasks from "give notice on your rental" to "read the meters", timed against the *forecast* handover so the plan slips when the build does. Add your own.
- **Calendar export** — payment dates, inspections, visits, decision deadlines and handover as an `.ics` file for any calendar app.
- **Lender pack** — a printable stage-progress confirmation for a staged-drawdown mortgage: completion, value of work in place against money drawn, certificates.
- **Weekly digest** — one message a week, previewed exactly as it would arrive.

**For the build team**

- A separate site console: post updates, track milestones running behind pace, act on draw requests, and confirm or decline site visit requests. Access is decided by project role, enforced in the database.

---

## Why some things are the way they are

**The forecast is a range, not a date.** Completion is projected by least-squares regression over recent progress readings. It is shown with its confidence, its window, and a sentence saying what it does not account for. A single confident-looking date would be read as a commitment, and the model cannot support one.

**Decision deadlines come from the programme.** A selection is due when the work that needs it starts, less the longest supplier lead time among its options, less a buffer. So a deadline moves when the schedule does, and an exotic twelve-week tile shows up as "too late" rather than quietly delaying the bathroom.

**Criticality is derived, never asserted.** `milestones.is_critical` is written from one CPM implementation in `src/lib/domain/schedule.ts`, not recomputed in SQL. One algorithm, one place to test it, one place for it to be wrong.

**Access control lives in the database.** Row-level security decides what every query returns. The UI hides controls a user cannot use, but hiding a button is a courtesy — the rule that matters runs on every row.

**The health score explains itself.** A number with no breakdown is an assertion the reader has to take on trust. The card shows all four weighted factors and what each contributed.

**Colour never carries meaning alone.** Every status pairs a colour with an icon and a text label. The chart palette was validated for colourblind separation against this app's own light and dark surfaces — see [docs/DESIGN.md](docs/DESIGN.md).

**Demo mode is a data-layer concern.** Pages call `getWorkspace()` and cannot tell whether Supabase or the seeded dataset answered. There are no `if (demo)` branches in the rendering code.

**Animation gates animation, never content.** The chart draw-in and count-up effects run when an element scrolls into view — but if the observer never fires, the content is fully rendered and merely un-animated. Gating visibility on an observer is how charts end up permanently blank in exactly the environments hardest to debug.

**Geometry is tokenised alongside colour.** Radius, border weight, shadow and letter-spacing are CSS custom properties, so the whole visual direction can be swapped from one token block. Eight alternative directions are kept live at `/design-lab`.

---

## Setting up a real database

Demo mode is for exploring. Real accounts, storage, realtime and persistence need Supabase.

### Local (recommended for development)

Requires Docker and the [Supabase CLI](https://supabase.com/docs/guides/local-development).

```bash
npm run db:start
```

That starts Postgres, Auth, Storage and Realtime, applies everything in `supabase/migrations/`, and runs `supabase/seed.sql`. Copy the printed API URL and anon key into `.env.local`:

```bash
cp .env.example .env.local
```

Seeded local accounts: `amara@example.com` / `demo-password-1` (buyer) and `marcus@calderfinch.example` / `demo-password-2` (builder).

Reset to a clean seeded state at any time:

```bash
npm run db:reset
```

### Hosted

Create a project at [supabase.com](https://supabase.com), then:

```bash
supabase link --project-ref <your-project-ref>
npm run db:push
```

Put the project URL and anon key in your deployment's environment, and add `<your-origin>/auth/callback` to the allowed redirect URLs in Supabase Auth settings.

### The AI assistant

Without `ANTHROPIC_API_KEY` the assistant falls back to a built-in responder that reads the same project records and handles the common questions — progress, delays, budget, payments, issues, documents, weather, contacts. It is not a stub; it just is not conversational. Set the key for full natural-language answers.

---

## Architecture

```
src/
├── app/
│   ├── (marketing)/          Public landing page
│   ├── (auth)/               Sign in, sign up, callbacks
│   ├── (app)/                Authenticated shell
│   │   ├── dashboard/
│   │   ├── projects/[slug]/  timeline · updates · documents
│   │   │                     finance · quality · analytics · assistant
│   │   ├── builder/          Build-team console + server actions
│   │   └── settings/
│   └── api/assistant/        Grounded assistant endpoint
├── components/
│   ├── ui/                   Primitives (Radix + Tailwind)
│   ├── charts/               Hand-rolled SVG charts
│   ├── widgets/              Composed dashboard widgets
│   └── layout/               Shell, navigation, notifications
├── lib/
│   ├── domain/               schedule (CPM) · finance · forecast (EVM)
│   ├── data/                 The single read path
│   ├── demo/                 Deterministic seeded dataset
│   ├── ai/                   Grounding context + assistant
│   └── supabase/             Browser, server and admin clients
└── types/                    Database types

supabase/
├── migrations/               Schema, functions, RLS, storage
└── seed.sql                  The same example project, in SQL
```

**Charts are hand-rolled SVG** rather than a charting library. It is more code, but it buys exact control over theming, guaranteed CSS-variable colours in both modes, real focusable elements for keyboard users, and no bundle cost. Each one ships a legend, a table view and an accessible description.

**Domain logic is pure and separate.** `schedule.ts`, `finance.ts` and `forecast.ts` take plain data and return plain data. They have no React, no database and no I/O, which is why they can be tested exhaustively.

---

## Development

```bash
npm run dev            # Development server
npm run verify         # Typecheck, lint, test, build — what CI runs
npm run test           # Unit tests (184)
npm run test:coverage  # With coverage
npm run db:types       # Regenerate database types from the local schema
```

Tests concentrate on `src/lib/domain/` — the CPM traversal, the money rollups, the forecast regression and the health scoring. Those are the parts where a subtle error produces a plausible-looking wrong number rather than a crash.

---

## Deploying

**Vercel** — import the repository, set the environment variables from `.env.example`, deploy.

**Docker**

```bash
docker compose up --build
```

The image is a multi-stage build emitting Next's standalone output: no source, no dev dependencies, no package manager, running as a non-root user. Note that `NEXT_PUBLIC_*` values are inlined at build time and so are passed as build args; server secrets stay runtime values and are never baked into the image.

### Running it

**Health check** — `GET /api/health` answers 200 while the app can serve requests and 503 when a configured database cannot be reached. Point an uptime monitor, or the orchestrator's readiness probe, at it.

**Errors** — every server error is logged as one JSON line (`"event": "request_failed"`) by `src/instrumentation.ts`, which is also where an error tracker such as Sentry plugs in.

**Weekly digest** — `vercel.json` schedules `/api/cron/digest` for 07:00 UTC on Mondays. It needs `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET`, and sends through Resend once `RESEND_API_KEY` and `DIGEST_FROM_EMAIL` are set; until then each run reports a dry run and sends nothing. Only people who chose **Weekly digest** in Settings, with email switched on, receive it.

Runs are safe to repeat: anyone already sent this week's digest is skipped. A run that reports `"complete": false` ran out of time and should simply be called again — on a large deployment, schedule it hourly through Monday morning. Outside Vercel, any scheduler works:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-origin/api/cron/digest
```

---

## What changed from version 1

Version 1 was a React SPA whose four pages each fetched `/api/...`, and — with no Vite proxy configured — silently fell back to hardcoded mock data on every request. The Express backend's five route files were entirely `// TODO`: auth returned `token: 'temp-token'`, the AI chat echoed the question back, and there was no database despite the README claiming Prisma and Postgres. It also would not boot: Express 5 rejects the bare `app.use('*', …)` wildcard, and `req.app.get('socketio')` was never set.

Version 2 keeps the domain and the ambition, and replaces the rest:

| | v1 | v2 |
|---|---|---|
| Data | Hardcoded mocks in components | Postgres schema, 26 tables, RLS on every one |
| Auth | `temp-token` | Supabase Auth, role-based, enforced in the database |
| Schedule | A status string per update | Full CPM with float, lag, and four dependency types |
| Finance | — | Budget rollups, EVM, payments, draws, change orders |
| Charts | — | Eight hand-rolled SVG charts, validated palette |
| Tests | None | 74 unit tests across the domain layer |
| Accessibility | Claimed WCAG AA | Keyboard paths, live regions, table views, focus rings, reduced-motion and forced-colours support |

---

## Licence

MIT. Demo data is fictional; the example build, its people and its addresses do not exist.
