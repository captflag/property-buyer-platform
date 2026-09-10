-- ============================================================================
-- Functions and triggers
--
-- The access helpers below are SECURITY DEFINER with a pinned search_path.
-- Both properties matter:
--   * DEFINER lets a policy on project_members ask "is this user a member?"
--     without re-entering that table's own policy and recursing forever.
--   * Pinning search_path stops a caller from shadowing `public` with their own
--     schema and having the definer run their functions with elevated rights.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'organizations', 'projects', 'phases', 'milestones', 'updates',
    'documents', 'payments', 'draw_requests', 'change_orders', 'inspections',
    'issues', 'ai_conversations'
  ]
  loop
    execute format(
      'create trigger %I_set_updated_at before update on %I
         for each row execute function set_updated_at()',
      t, t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Provision a profile whenever an auth user is created
-- ---------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url',
    coalesce((new.raw_user_meta_data ->> 'role')::app_role, 'buyer')
  )
  on conflict (id) do nothing;

  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------
create or replace function current_app_role()
returns app_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function is_project_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project_id and user_id = auth.uid()
  ) or public.is_admin();
$$;

create or replace function project_role_of(p_project_id uuid)
returns project_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.project_members
  where project_id = p_project_id and user_id = auth.uid();
$$;

-- Builders and inspectors write; buyers and viewers read. Admins do both.
create or replace function can_write_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select role in ('builder', 'inspector')
     from public.project_members
     where project_id = p_project_id and user_id = auth.uid()),
    false
  ) or public.is_admin();
$$;

create or replace function is_org_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = p_organization_id and user_id = auth.uid()
  ) or public.is_admin();
$$;

-- ---------------------------------------------------------------------------
-- Weighted project progress
--
-- Rolls milestone progress up by weight. Falls back to a simple mean when no
-- weights are set, so a project is never reported as 0% purely because nobody
-- filled the weights in.
-- ---------------------------------------------------------------------------
create or replace function project_progress(p_project_id uuid)
returns numeric
language sql
stable
as $$
  select coalesce(
    case
      when sum(weight) > 0
        then round(sum(progress_percent * weight) / sum(weight), 2)
      else round(avg(progress_percent), 2)
    end,
    0
  )
  from milestones
  where project_id = p_project_id and status <> 'cancelled';
$$;

-- ---------------------------------------------------------------------------
-- Notification fan-out
--
-- Writes one notification per project member, skipping the actor (nobody needs
-- to be told about their own action) and anyone who muted the type.
-- ---------------------------------------------------------------------------
create or replace function notify_project(
  p_project_id uuid,
  p_type       notification_type,
  p_title      text,
  p_body       text,
  p_link       text,
  p_actor_id   uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  inserted integer;
begin
  insert into public.notifications (user_id, project_id, type, title, body, link)
  select pm.user_id, p_project_id, p_type, p_title, p_body, p_link
  from public.project_members pm
  left join public.notification_preferences np on np.user_id = pm.user_id
  where pm.user_id is distinct from p_actor_id
    and not (p_type = any (coalesce(np.muted_types, '{}')));

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

create or replace function on_update_published()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.is_published then
    perform public.notify_project(
      new.project_id,
      'update_posted',
      new.title,
      left(new.body, 180),
      '/projects/' || new.project_id::text || '/updates#' || new.id::text,
      new.author_id
    );
  end if;

  insert into public.activity_log (project_id, actor_id, action, entity_type, entity_id)
  values (new.project_id, new.author_id, 'posted_update', 'update', new.id);

  return new;
end;
$$;

create trigger updates_notify
  after insert on updates
  for each row execute function on_update_published();

create or replace function on_milestone_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    perform public.notify_project(
      new.project_id,
      'milestone_completed',
      new.name || ' is complete',
      'This milestone finished on ' || coalesce(new.actual_end::text, current_date::text) || '.',
      '/projects/' || new.project_id::text || '/timeline'
    );
  elsif new.status = 'blocked' and old.status is distinct from 'blocked' then
    perform public.notify_project(
      new.project_id,
      'milestone_delayed',
      new.name || ' is blocked',
      'Work on this milestone has stopped and the schedule may move.',
      '/projects/' || new.project_id::text || '/timeline'
    );
  end if;

  return new;
end;
$$;

create trigger milestones_notify
  after update on milestones
  for each row execute function on_milestone_status_change();

create or replace function on_document_added()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.notify_project(
    new.project_id,
    case when new.requires_ack then 'document_ack_required' else 'document_added' end,
    new.name,
    case
      when new.requires_ack then 'This document needs your acknowledgement.'
      else initcap(new.category::text) || ' added to your document library.'
    end,
    '/projects/' || new.project_id::text || '/documents',
    new.uploaded_by
  );
  return new;
end;
$$;

create trigger documents_notify
  after insert on documents
  for each row execute function on_document_added();

create or replace function on_payment_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'paid' and old.status is distinct from 'paid' then
    perform public.notify_project(
      new.project_id, 'payment_received',
      'Payment received: ' || new.name,
      'We have recorded your payment of ' || to_char(new.amount, 'FM999,999,999.00') || '.',
      '/projects/' || new.project_id::text || '/finance'
    );
  elsif new.status in ('due', 'invoiced') and old.status is distinct from new.status then
    perform public.notify_project(
      new.project_id, 'payment_due',
      'Payment due: ' || new.name,
      to_char(new.amount, 'FM999,999,999.00') || ' is due on ' ||
        coalesce(new.due_date::text, 'a date to be confirmed') || '.',
      '/projects/' || new.project_id::text || '/finance'
    );
  end if;

  return new;
end;
$$;

create trigger payments_notify
  after update on payments
  for each row execute function on_payment_status_change();

-- ---------------------------------------------------------------------------
-- Mark overdue payments. Intended to run daily from pg_cron or an external
-- scheduler; safe to call repeatedly.
-- ---------------------------------------------------------------------------
create or replace function mark_overdue_payments()
returns integer
language plpgsql
as $$
declare
  affected integer;
begin
  update payments
  set status = 'overdue'
  where status in ('scheduled', 'due', 'invoiced')
    and due_date is not null
    and due_date < current_date;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- ---------------------------------------------------------------------------
-- Project health, computed in one pass for dashboard cards.
--
-- schedule_variance is (actual - planned) completion in points: negative means
-- behind. cost_variance is budget minus committed+actual: negative means over.
-- ---------------------------------------------------------------------------
create or replace function project_health(p_project_id uuid)
returns table (
  progress_percent   numeric,
  planned_percent    numeric,
  schedule_variance  numeric,
  budget_total       numeric,
  spent_total        numeric,
  committed_total    numeric,
  cost_variance      numeric,
  open_issues        integer,
  critical_issues    integer,
  overdue_payments   integer,
  days_remaining     integer
)
language sql
stable
as $$
  with prog as (
    select project_progress(p_project_id) as actual
  ),
  plan as (
    select coalesce(
      (select planned_percent
       from progress_snapshots
       where project_id = p_project_id
       order by captured_on desc
       limit 1),
      0
    ) as planned
  ),
  money as (
    select
      coalesce((select sum(budgeted_amount) from budget_categories
                where project_id = p_project_id), 0) as budget_total,
      coalesce((select sum(amount) from cost_entries
                where project_id = p_project_id and kind = 'actual'), 0) as spent_total,
      coalesce((select sum(amount) from cost_entries
                where project_id = p_project_id and kind = 'committed'), 0) as committed_total
  ),
  quality as (
    select
      count(*) filter (where status in ('open', 'acknowledged', 'in_progress'))::int as open_issues,
      count(*) filter (where status in ('open', 'acknowledged', 'in_progress')
                         and severity = 'critical')::int as critical_issues
    from issues where project_id = p_project_id
  ),
  billing as (
    select count(*) filter (where status = 'overdue')::int as overdue_payments
    from payments where project_id = p_project_id
  ),
  timing as (
    select (target_completion_date - current_date)::int as days_remaining
    from projects where id = p_project_id
  )
  select
    prog.actual,
    plan.planned,
    round(prog.actual - plan.planned, 2),
    money.budget_total,
    money.spent_total,
    money.committed_total,
    money.budget_total - (money.spent_total + money.committed_total),
    quality.open_issues,
    quality.critical_issues,
    billing.overdue_payments,
    timing.days_remaining
  from prog, plan, money, quality, billing, timing;
$$;
