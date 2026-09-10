-- ============================================================================
-- Property Buyer Platform v2 -- core schema
--
-- Design notes:
--   * Every table that holds project data carries project_id so a single RLS
--     helper (is_project_member) can gate it. Denormalising project_id onto
--     child tables is deliberate: it keeps policies to one index lookup instead
--     of a join chain, which matters because RLS runs per row.
--   * Money is numeric(14,2), never float. Percentages are numeric(5,2).
--   * Timestamps are timestamptz. Dates that represent a calendar day with no
--     meaningful time-of-day (a milestone's planned start) are plain date.
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------------
-- Enumerated types
-- ---------------------------------------------------------------------------
create type app_role as enum ('buyer', 'builder', 'admin');
create type org_role as enum ('owner', 'manager', 'member');
create type project_role as enum ('buyer', 'builder', 'inspector', 'viewer');

create type project_status as enum (
  'planning', 'in_progress', 'on_hold', 'completed', 'handed_over', 'cancelled'
);

create type work_status as enum (
  'not_started', 'in_progress', 'blocked', 'completed', 'cancelled'
);

create type dependency_type as enum ('FS', 'SS', 'FF', 'SF');

create type media_kind as enum ('image', 'video', 'document');

create type document_category as enum (
  'permit', 'blueprint', 'contract', 'certificate', 'invoice',
  'report', 'warranty', 'insurance', 'other'
);

create type payment_status as enum (
  'scheduled', 'due', 'invoiced', 'paid', 'overdue', 'waived'
);

create type draw_status as enum (
  'draft', 'submitted', 'under_review', 'approved', 'rejected', 'paid'
);

create type change_order_status as enum ('proposed', 'approved', 'rejected', 'withdrawn');

create type inspection_result as enum ('pending', 'pass', 'fail', 'conditional');

create type issue_severity as enum ('low', 'medium', 'high', 'critical');
create type issue_status as enum ('open', 'acknowledged', 'in_progress', 'resolved', 'closed');

create type cost_kind as enum ('budget', 'committed', 'actual');

create type weather_impact as enum ('none', 'partial', 'full');

create type notification_type as enum (
  'update_posted', 'milestone_completed', 'milestone_delayed', 'document_added',
  'document_ack_required', 'payment_due', 'payment_received', 'draw_decision',
  'change_order', 'inspection_result', 'issue_raised', 'message'
);

create type ai_role as enum ('user', 'assistant', 'system');

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------
create table profiles (
  id            uuid primary key references auth.users on delete cascade,
  email         text not null,
  full_name     text,
  avatar_url    text,
  phone         text,
  role          app_role not null default 'buyer',
  locale        text not null default 'en',
  timezone      text not null default 'UTC',
  onboarded_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table profiles is
  'One row per auth user. role is the coarse capability tier; per-project access lives in project_members.';

create table organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  logo_url    text,
  website     text,
  phone       text,
  email       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table organization_members (
  organization_id uuid not null references organizations on delete cascade,
  user_id         uuid not null references profiles on delete cascade,
  role            org_role not null default 'member',
  created_at      timestamptz not null default now(),
  primary key (organization_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------
create table projects (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references organizations on delete restrict,
  name                    text not null,
  slug                    text not null unique,
  description             text,
  cover_image_url         text,
  status                  project_status not null default 'planning',

  address_line1           text not null,
  address_line2           text,
  city                    text not null,
  state                   text,
  postal_code             text,
  country                 text not null default 'US',
  latitude                numeric(9,6),
  longitude               numeric(9,6),

  start_date              date,
  target_completion_date  date,
  actual_completion_date  date,
  handover_date           date,

  contract_value          numeric(14,2) not null default 0,
  currency                char(3) not null default 'USD',

  unit_type               text,
  floor_area_sqft         integer,
  bedrooms                smallint,
  bathrooms               numeric(3,1),
  plot_area_sqft          integer,

  contractor_name         text,
  architect_name          text,
  site_manager_name       text,
  site_manager_phone      text,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint projects_dates_ordered
    check (target_completion_date is null or start_date is null
           or target_completion_date >= start_date)
);

create index projects_organization_id_idx on projects (organization_id);
create index projects_status_idx on projects (status);

create table project_members (
  project_id  uuid not null references projects on delete cascade,
  user_id     uuid not null references profiles on delete cascade,
  role        project_role not null default 'viewer',
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index project_members_user_id_idx on project_members (user_id);

-- ---------------------------------------------------------------------------
-- Schedule: phases -> milestones -> dependencies
-- ---------------------------------------------------------------------------
create table phases (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references projects on delete cascade,
  name           text not null,
  description    text,
  sequence       smallint not null,
  weight         numeric(5,2) not null default 0,
  colour_slot    smallint not null default 1 check (colour_slot between 1 and 8),
  planned_start  date,
  planned_end    date,
  actual_start   date,
  actual_end     date,
  status         work_status not null default 'not_started',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (project_id, sequence)
);

create index phases_project_id_idx on phases (project_id);

comment on column phases.weight is
  'Share of total project scope, in percent. Phase weights across a project should sum to 100 -- enforced by the check_phase_weights() advisory function, not a constraint, so partial edits are allowed mid-transaction.';

comment on column phases.colour_slot is
  'Index into the categorical series palette. Fixed per phase so a phase keeps its colour when charts are filtered.';

create table milestones (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references projects on delete cascade,
  phase_id         uuid references phases on delete set null,
  name             text not null,
  description      text,
  sequence         smallint not null,
  weight           numeric(5,2) not null default 0,

  planned_start    date not null,
  planned_end      date not null,
  actual_start     date,
  actual_end       date,

  progress_percent numeric(5,2) not null default 0
                     check (progress_percent between 0 and 100),
  status           work_status not null default 'not_started',
  is_critical      boolean not null default false,
  payment_percent  numeric(5,2) not null default 0,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint milestones_planned_dates_ordered check (planned_end >= planned_start),
  constraint milestones_actual_dates_ordered
    check (actual_end is null or actual_start is null or actual_end >= actual_start)
);

create index milestones_project_id_idx on milestones (project_id);
create index milestones_phase_id_idx on milestones (phase_id);
create index milestones_status_idx on milestones (project_id, status);

comment on column milestones.is_critical is
  'Maintained by recompute_critical_path(project_id). Never set by hand -- it is derived from the dependency graph.';

create table milestone_dependencies (
  predecessor_id  uuid not null references milestones on delete cascade,
  successor_id    uuid not null references milestones on delete cascade,
  type            dependency_type not null default 'FS',
  lag_days        smallint not null default 0,
  primary key (predecessor_id, successor_id),
  constraint milestone_dependencies_no_self_edge check (predecessor_id <> successor_id)
);

create index milestone_dependencies_successor_idx on milestone_dependencies (successor_id);

-- ---------------------------------------------------------------------------
-- Construction updates
-- ---------------------------------------------------------------------------
create table updates (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects on delete cascade,
  milestone_id    uuid references milestones on delete set null,
  author_id       uuid not null references profiles on delete restrict,
  title           text not null,
  body            text not null,
  status          work_status not null default 'in_progress',
  progress_delta  numeric(5,2),
  crew_size       smallint,
  hours_worked    numeric(5,1),
  weather         text,
  temperature_c   numeric(4,1),
  is_published    boolean not null default true,
  published_at    timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index updates_project_published_idx on updates (project_id, published_at desc);
create index updates_milestone_idx on updates (milestone_id);
create index updates_search_idx on updates using gin (
  (title || ' ' || body) gin_trgm_ops
);

create table update_media (
  id           uuid primary key default gen_random_uuid(),
  update_id    uuid not null references updates on delete cascade,
  project_id   uuid not null references projects on delete cascade,
  storage_path text not null,
  kind         media_kind not null default 'image',
  caption      text,
  width        integer,
  height       integer,
  sort         smallint not null default 0,
  created_at   timestamptz not null default now()
);

create index update_media_update_id_idx on update_media (update_id, sort);

-- ---------------------------------------------------------------------------
-- Documents
-- ---------------------------------------------------------------------------
create table documents (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references projects on delete cascade,
  name           text not null,
  description    text,
  category       document_category not null default 'other',
  storage_path   text not null,
  mime_type      text not null default 'application/pdf',
  size_bytes     bigint not null default 0,
  version        smallint not null default 1,
  supersedes_id  uuid references documents on delete set null,
  uploaded_by    uuid references profiles on delete set null,
  issued_at      date,
  expires_at     date,
  requires_ack   boolean not null default false,
  is_confidential boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index documents_project_category_idx on documents (project_id, category);
create index documents_name_trgm_idx on documents using gin (name gin_trgm_ops);

create table document_acknowledgements (
  document_id     uuid not null references documents on delete cascade,
  user_id         uuid not null references profiles on delete cascade,
  acknowledged_at timestamptz not null default now(),
  signature_name  text,
  ip_address      inet,
  primary key (document_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Finance: budget, costs, payments, draws, change orders
-- ---------------------------------------------------------------------------
create table budget_categories (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references projects on delete cascade,
  name             text not null,
  code             text,
  budgeted_amount  numeric(14,2) not null default 0,
  sequence         smallint not null default 0,
  colour_slot      smallint not null default 1 check (colour_slot between 1 and 8),
  created_at       timestamptz not null default now(),
  unique (project_id, name)
);

create index budget_categories_project_idx on budget_categories (project_id, sequence);

create table cost_entries (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects on delete cascade,
  category_id  uuid references budget_categories on delete set null,
  milestone_id uuid references milestones on delete set null,
  description  text not null,
  amount       numeric(14,2) not null,
  kind         cost_kind not null default 'actual',
  incurred_on  date not null default current_date,
  vendor       text,
  created_by   uuid references profiles on delete set null,
  created_at   timestamptz not null default now()
);

create index cost_entries_project_idx on cost_entries (project_id, incurred_on);
create index cost_entries_category_idx on cost_entries (category_id);

create table payments (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references projects on delete cascade,
  milestone_id        uuid references milestones on delete set null,
  name                text not null,
  sequence            smallint not null default 0,
  amount              numeric(14,2) not null,
  percent_of_contract numeric(5,2),
  due_date            date,
  status              payment_status not null default 'scheduled',
  paid_at             timestamptz,
  invoice_number      text,
  method              text,
  reference           text,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index payments_project_idx on payments (project_id, sequence);
create index payments_status_idx on payments (project_id, status);

create table draw_requests (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects on delete cascade,
  milestone_id  uuid references milestones on delete set null,
  payment_id    uuid references payments on delete set null,
  reference     text not null,
  amount        numeric(14,2) not null,
  status        draw_status not null default 'draft',
  justification text,
  requested_by  uuid references profiles on delete set null,
  submitted_at  timestamptz,
  decided_at    timestamptz,
  decided_by    uuid references profiles on delete set null,
  decision_note text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index draw_requests_project_idx on draw_requests (project_id, created_at desc);

create table change_orders (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references projects on delete cascade,
  number              text not null,
  title               text not null,
  description         text,
  cost_delta          numeric(14,2) not null default 0,
  schedule_delta_days smallint not null default 0,
  status              change_order_status not null default 'proposed',
  requested_by        uuid references profiles on delete set null,
  decided_by          uuid references profiles on delete set null,
  decided_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (project_id, number)
);

create index change_orders_project_idx on change_orders (project_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Quality: inspections and issues
-- ---------------------------------------------------------------------------
create table inspections (
  id                     uuid primary key default gen_random_uuid(),
  project_id             uuid not null references projects on delete cascade,
  milestone_id           uuid references milestones on delete set null,
  name                   text not null,
  authority              text,
  inspector_name         text,
  scheduled_for          date,
  completed_at           timestamptz,
  result                 inspection_result not null default 'pending',
  notes                  text,
  certificate_document_id uuid references documents on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index inspections_project_idx on inspections (project_id, scheduled_for);

create table issues (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects on delete cascade,
  milestone_id uuid references milestones on delete set null,
  title        text not null,
  description  text,
  location     text,
  severity     issue_severity not null default 'medium',
  status       issue_status not null default 'open',
  reported_by  uuid references profiles on delete set null,
  assigned_to  uuid references profiles on delete set null,
  due_date     date,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index issues_project_status_idx on issues (project_id, status);

-- ---------------------------------------------------------------------------
-- Schedule intelligence inputs
-- ---------------------------------------------------------------------------
create table progress_snapshots (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects on delete cascade,
  captured_on     date not null,
  planned_percent numeric(5,2) not null,
  actual_percent  numeric(5,2) not null,
  note            text,
  created_at      timestamptz not null default now(),
  unique (project_id, captured_on)
);

create index progress_snapshots_project_idx on progress_snapshots (project_id, captured_on);

comment on table progress_snapshots is
  'Daily planned-vs-actual completion, the input to the S-curve and to delay forecasting. One row per project per day.';

create table weather_log (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references projects on delete cascade,
  observed_on      date not null,
  condition        text not null,
  temp_c           numeric(4,1),
  precipitation_mm numeric(5,1),
  wind_kph         numeric(5,1),
  work_impact      weather_impact not null default 'none',
  hours_lost       numeric(4,1) not null default 0,
  created_at       timestamptz not null default now(),
  unique (project_id, observed_on)
);

create index weather_log_project_idx on weather_log (project_id, observed_on desc);

-- ---------------------------------------------------------------------------
-- Notifications and activity
-- ---------------------------------------------------------------------------
create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles on delete cascade,
  project_id  uuid references projects on delete cascade,
  type        notification_type not null,
  title       text not null,
  body        text,
  link        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index notifications_user_unread_idx
  on notifications (user_id, created_at desc)
  where read_at is null;
create index notifications_user_idx on notifications (user_id, created_at desc);

create table notification_preferences (
  user_id            uuid primary key references profiles on delete cascade,
  email_enabled      boolean not null default true,
  push_enabled       boolean not null default true,
  digest_frequency   text not null default 'daily'
                       check (digest_frequency in ('instant', 'daily', 'weekly', 'never')),
  muted_types        notification_type[] not null default '{}',
  quiet_hours_start  smallint check (quiet_hours_start between 0 and 23),
  quiet_hours_end    smallint check (quiet_hours_end between 0 and 23),
  updated_at         timestamptz not null default now()
);

create table activity_log (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references projects on delete cascade,
  actor_id    uuid references profiles on delete set null,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index activity_log_project_idx on activity_log (project_id, created_at desc);

-- ---------------------------------------------------------------------------
-- AI assistant
-- ---------------------------------------------------------------------------
create table ai_conversations (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects on delete cascade,
  user_id     uuid not null references profiles on delete cascade,
  title       text not null default 'New conversation',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index ai_conversations_user_idx on ai_conversations (user_id, updated_at desc);

create table ai_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references ai_conversations on delete cascade,
  role            ai_role not null,
  content         text not null,
  citations       jsonb not null default '[]'::jsonb,
  token_count     integer,
  created_at      timestamptz not null default now()
);

create index ai_messages_conversation_idx on ai_messages (conversation_id, created_at);

comment on column ai_messages.citations is
  'Array of {kind, id, label} objects pointing at the project rows the answer was grounded in, so every claim is traceable back to source data.';
