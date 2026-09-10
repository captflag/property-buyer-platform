-- ============================================================================
-- Buyer experience: selections, snags, questions, site visits, move-in plan,
-- and "since you last looked".
--
-- The recurring design choice in this migration: where a buyer is allowed to
-- change *part* of a row -- choosing a finish, but not its price; raising a
-- snag, but not assigning it -- the change goes through a SECURITY DEFINER
-- function rather than a column-restricted UPDATE policy. Postgres RLS cannot
-- restrict an UPDATE to particular columns, so the only honest way to say
-- "buyers may set chosen_option_id and nothing else" is to not give them
-- UPDATE at all, and give them a function that does exactly that one thing.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Project timezone. Site visits are booked in the site's wall-clock time, not
-- the viewer's -- "10:00 on Tuesday" means 10:00 at the house.
-- ---------------------------------------------------------------------------
alter table projects add column if not exists timezone text not null default 'UTC';

-- ---------------------------------------------------------------------------
-- "Since you last looked"
-- ---------------------------------------------------------------------------
alter table project_members add column if not exists last_seen_at timestamptz;

comment on column project_members.last_seen_at is
  'When this member last marked the project as caught up. Deliberately NOT updated on page view: a buyer who opens the dashboard and leaves immediately should still see what changed next time.';

create or replace function mark_project_seen(p_project_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  stamp timestamptz := now();
begin
  update public.project_members
  set last_seen_at = stamp
  where project_id = p_project_id and user_id = auth.uid();

  if not found then
    raise exception 'not a member of this project' using errcode = '42501';
  end if;

  return stamp;
end;
$$;

-- ---------------------------------------------------------------------------
-- Selections and finishes
-- ---------------------------------------------------------------------------
create type selection_status as enum ('open', 'chosen', 'confirmed', 'locked');

create table selection_categories (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references projects on delete cascade,
  milestone_id      uuid references milestones on delete set null,
  name              text not null,
  room              text,
  description       text,
  sequence          smallint not null default 0,
  -- Explicit override. When null the deadline is derived from the linked
  -- milestone's start, the longest option lead time and buffer_days -- so a
  -- slipping programme moves the deadline with it instead of leaving a stale
  -- date that forces an unnecessary rush.
  decision_deadline date,
  buffer_days       smallint not null default 7 check (buffer_days >= 0),
  status            selection_status not null default 'open',
  chosen_option_id  uuid,
  chosen_by         uuid references profiles on delete set null,
  chosen_at         timestamptz,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index selection_categories_project_idx on selection_categories (project_id, sequence);

create table selection_options (
  id              uuid primary key default gen_random_uuid(),
  category_id     uuid not null references selection_categories on delete cascade,
  project_id      uuid not null references projects on delete cascade,
  name            text not null,
  description     text,
  supplier        text,
  finish          text,
  -- Price relative to the standard option included in the contract. The
  -- standard option is 0 by definition; upgrades are positive, credits negative.
  price_delta     numeric(14,2) not null default 0,
  lead_time_days  smallint not null default 14 check (lead_time_days >= 0),
  is_standard     boolean not null default false,
  image_path      text,
  swatch          text check (swatch is null or swatch ~ '^#[0-9a-fA-F]{6}$'),
  sequence        smallint not null default 0,
  created_at      timestamptz not null default now()
);

create index selection_options_category_idx on selection_options (category_id, sequence);

-- At most one standard option per category.
create unique index selection_options_one_standard
  on selection_options (category_id) where is_standard;

alter table selection_categories
  add constraint selection_categories_chosen_option_fk
  foreign key (chosen_option_id) references selection_options (id) on delete set null;

create trigger selection_categories_set_updated_at
  before update on selection_categories
  for each row execute function set_updated_at();

/**
 * The only way a buyer changes a selection.
 *
 * Checks, in order: the caller is a member; the option belongs to the category;
 * the category is still open to change. Once the build team has confirmed or
 * locked a selection -- usually because it has been ordered -- a change is a
 * change order, not a click, and this refuses it.
 */
create or replace function choose_selection(p_category_id uuid, p_option_id uuid, p_notes text default null)
returns selection_categories
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  category public.selection_categories;
  option_row public.selection_options;
begin
  select * into category from public.selection_categories where id = p_category_id for update;
  if not found then
    raise exception 'selection not found' using errcode = 'P0002';
  end if;

  if not public.is_project_member(category.project_id) then
    raise exception 'not a member of this project' using errcode = '42501';
  end if;

  if category.status in ('confirmed', 'locked') then
    raise exception 'this selection has been confirmed by the build team and can only be changed through a change order'
      using errcode = 'P0001';
  end if;

  select * into option_row from public.selection_options where id = p_option_id;
  if not found or option_row.category_id <> p_category_id then
    raise exception 'that option does not belong to this selection' using errcode = '22023';
  end if;

  update public.selection_categories
  set chosen_option_id = p_option_id,
      chosen_by = auth.uid(),
      chosen_at = now(),
      status = 'chosen',
      notes = coalesce(p_notes, notes)
  where id = p_category_id
  returning * into category;

  insert into public.activity_log (project_id, actor_id, action, entity_type, entity_id, meta)
  values (
    category.project_id, auth.uid(), 'chose_selection', 'selection', category.id,
    jsonb_build_object('option', option_row.name, 'price_delta', option_row.price_delta)
  );

  perform public.notify_project(
    category.project_id, 'message',
    'Selection made: ' || category.name,
    option_row.name ||
      case when option_row.price_delta <> 0
        then ' (' || case when option_row.price_delta > 0 then '+' else '' end ||
             to_char(option_row.price_delta, 'FM999,999,990') || ')'
        else '' end,
    '/projects/' || category.project_id::text || '/selections',
    auth.uid()
  );

  return category;
end;
$$;

-- ---------------------------------------------------------------------------
-- Snags raised by buyers
-- ---------------------------------------------------------------------------
alter table issues add column if not exists room text;
alter table issues add column if not exists photo_paths text[] not null default '{}';
alter table issues add column if not exists raised_by_buyer boolean not null default false;

/**
 * Buyers may raise issues, but may not triage them. They can set what they
 * saw -- title, room, description, a severity suggestion and photographs -- and
 * nothing else. Assignment, status and due dates stay with the build team, so
 * a buyer cannot mark their own snag resolved or assign it to someone.
 */
create policy issues_insert_buyer on issues
  for insert to authenticated
  with check (
    is_project_member(project_id)
    and reported_by = auth.uid()
    and raised_by_buyer
    and status = 'open'
    and assigned_to is null
    and resolved_at is null
  );

-- Buyers upload snag photographs under <project>/snags/<their user id>/...
create policy project_media_snag_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'project-media'
    and is_project_member(((storage.foldername(name))[1])::uuid)
    and (storage.foldername(name))[2] = 'snags'
    and (storage.foldername(name))[3] = auth.uid()::text
  );

create or replace function on_issue_raised()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.notify_project(
    new.project_id, 'issue_raised',
    case when new.raised_by_buyer then 'Snag reported: ' else 'Issue raised: ' end || new.title,
    coalesce(new.room || ' · ', '') || initcap(new.severity::text) || ' severity',
    '/projects/' || new.project_id::text || '/quality',
    new.reported_by
  );
  return new;
end;
$$;

create trigger issues_notify
  after insert on issues
  for each row execute function on_issue_raised();

-- ---------------------------------------------------------------------------
-- "Ask about this" -- threads attached to a specific thing
-- ---------------------------------------------------------------------------
create type discussion_subject as enum (
  'milestone', 'update', 'document', 'selection', 'issue', 'payment', 'photo', 'general'
);
create type discussion_status as enum ('open', 'answered', 'closed');

create table discussions (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references projects on delete cascade,
  subject_kind     discussion_subject not null default 'general',
  subject_id       uuid,
  -- Denormalised so a thread still reads sensibly after its subject is deleted.
  subject_label    text,
  title            text not null,
  status           discussion_status not null default 'open',
  created_by       uuid references profiles on delete set null,
  last_message_at  timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index discussions_project_idx on discussions (project_id, last_message_at desc);
create index discussions_subject_idx on discussions (subject_kind, subject_id);

create table discussion_messages (
  id             uuid primary key default gen_random_uuid(),
  discussion_id  uuid not null references discussions on delete cascade,
  project_id     uuid not null references projects on delete cascade,
  author_id      uuid references profiles on delete set null,
  body           text not null check (length(trim(body)) > 0 and length(body) <= 4000),
  created_at     timestamptz not null default now()
);

create index discussion_messages_discussion_idx on discussion_messages (discussion_id, created_at);

create trigger discussions_set_updated_at
  before update on discussions
  for each row execute function set_updated_at();

/**
 * Keep thread status honest without anyone having to set it: a reply from the
 * build team marks the thread answered, a follow-up from the buyer reopens it.
 */
create or replace function on_discussion_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  author_role project_role;
  thread public.discussions;
begin
  select role into author_role
  from public.project_members
  where project_id = new.project_id and user_id = new.author_id;

  update public.discussions
  set last_message_at = new.created_at,
      status = case
        when author_role in ('builder', 'inspector') then 'answered'::discussion_status
        else 'open'::discussion_status
      end
  where id = new.discussion_id
  returning * into thread;

  perform public.notify_project(
    new.project_id, 'message',
    'Re: ' || thread.title,
    left(new.body, 160),
    '/projects/' || new.project_id::text || '/questions#' || thread.id::text,
    new.author_id
  );
  return new;
end;
$$;

create trigger discussion_messages_after_insert
  after insert on discussion_messages
  for each row execute function on_discussion_message();

-- ---------------------------------------------------------------------------
-- Site visits
-- ---------------------------------------------------------------------------
create type site_visit_status as enum ('requested', 'confirmed', 'declined', 'cancelled', 'completed');

create table site_visits (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references projects on delete cascade,
  requested_by      uuid references profiles on delete set null,
  starts_at         timestamptz not null,
  duration_minutes  smallint not null default 60 check (duration_minutes between 15 and 240),
  purpose           text not null,
  attendees         smallint not null default 1 check (attendees between 1 and 6),
  notes             text,
  status            site_visit_status not null default 'requested',
  builder_note      text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index site_visits_project_idx on site_visits (project_id, starts_at);

-- Two live bookings cannot share a slot. Declined and cancelled requests free it.
create unique index site_visits_one_per_slot
  on site_visits (project_id, starts_at)
  where status in ('requested', 'confirmed');

create trigger site_visits_set_updated_at
  before update on site_visits
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Move-in planner. Template tasks are defined in application code; this
-- table records completion, plus any tasks the buyer adds themselves.
-- ---------------------------------------------------------------------------
create table move_tasks (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects on delete cascade,
  user_id       uuid not null references profiles on delete cascade,
  template_key  text,
  title         text,
  category      text,
  days_before   smallint,
  done_at       timestamptz,
  created_at    timestamptz not null default now(),
  constraint move_tasks_custom_has_title check (template_key is not null or title is not null),
  unique (project_id, user_id, template_key)
);

create index move_tasks_user_idx on move_tasks (user_id, project_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table selection_categories enable row level security;
alter table selection_options    enable row level security;
alter table discussions          enable row level security;
alter table discussion_messages  enable row level security;
alter table site_visits          enable row level security;
alter table move_tasks           enable row level security;

-- Selections: everyone on the project reads; the build team writes directly;
-- buyers choose only through choose_selection().
create policy selection_categories_select on selection_categories
  for select to authenticated using (is_project_member(project_id));
create policy selection_categories_write on selection_categories
  for all to authenticated
  using (can_write_project(project_id)) with check (can_write_project(project_id));

create policy selection_options_select on selection_options
  for select to authenticated using (is_project_member(project_id));
create policy selection_options_write on selection_options
  for all to authenticated
  using (can_write_project(project_id)) with check (can_write_project(project_id));

-- Discussions: any member may start one and post in it, always as themselves.
create policy discussions_select on discussions
  for select to authenticated using (is_project_member(project_id));
create policy discussions_insert on discussions
  for insert to authenticated
  with check (is_project_member(project_id) and created_by = auth.uid());
create policy discussions_update_writer on discussions
  for update to authenticated
  using (can_write_project(project_id)) with check (can_write_project(project_id));

create policy discussion_messages_select on discussion_messages
  for select to authenticated using (is_project_member(project_id));
create policy discussion_messages_insert on discussion_messages
  for insert to authenticated
  with check (is_project_member(project_id) and author_id = auth.uid());

-- Site visits: buyers request for themselves and may cancel their own; only
-- the build team confirms, declines or completes.
create policy site_visits_select on site_visits
  for select to authenticated using (is_project_member(project_id));
create policy site_visits_insert_member on site_visits
  for insert to authenticated
  with check (
    is_project_member(project_id)
    and requested_by = auth.uid()
    and status = 'requested'
    -- 48 hours' notice, matching the site's own visiting rules.
    and starts_at >= now() + interval '48 hours'
  );
create policy site_visits_update_writer on site_visits
  for update to authenticated
  using (can_write_project(project_id)) with check (can_write_project(project_id));
create policy site_visits_cancel_own on site_visits
  for update to authenticated
  using (requested_by = auth.uid() and status in ('requested', 'confirmed'))
  with check (requested_by = auth.uid() and status = 'cancelled');

-- Move tasks: strictly personal.
create policy move_tasks_own on move_tasks
  for all to authenticated
  using (user_id = auth.uid() and is_project_member(project_id))
  with check (user_id = auth.uid() and is_project_member(project_id));

alter publication supabase_realtime add table discussion_messages;
alter publication supabase_realtime add table site_visits;
alter publication supabase_realtime add table selection_categories;
