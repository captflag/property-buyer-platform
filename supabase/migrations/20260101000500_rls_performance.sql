-- ============================================================================
-- Row Level Security, rewritten to scale.
--
-- Same rules as before -- every policy below keeps its name, its command and
-- its meaning -- written in the form Postgres can evaluate once per query
-- instead of once per row.
--
-- Two changes, both from Supabase's RLS performance guidance:
--
-- 1. `auth.uid()` becomes `(select auth.uid())`. Bare, it is a function call
--    re-evaluated for every row the query touches; wrapped in a scalar
--    subquery, the planner hoists it into an InitPlan and computes it once.
--
-- 2. Per-row membership checks become set membership. `is_project_member(
--    project_id)` ran one lookup against project_members for every row of
--    every table -- ten thousand photographs meant ten thousand lookups.
--    `project_id in (select my_project_ids())` asks the question once, as a
--    hashed set of the caller's projects, and every row is then a probe into
--    that set.
--
-- The old helpers (`is_project_member`, `can_write_project`, ...) are kept:
-- RPC functions and triggers still call them with a single project id, where
-- they are the right tool.
--
-- Policies are altered in place (`alter policy`) rather than dropped and
-- recreated, so there is no instant at which a table has no policy.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Set-returning helpers.
--
-- SECURITY DEFINER for the same reason as the originals: they read
-- project_members, whose own policy calls them, and running as the caller
-- would recurse. Each returns only rows about the caller, so exposing them
-- to `authenticated` reveals nothing a member could not already see.
-- ---------------------------------------------------------------------------
create or replace function my_project_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select project_id from public.project_members where user_id = (select auth.uid());
$$;

-- Builders and inspectors write; buyers and viewers read. Admins are handled
-- separately in each policy, so an admin's check never enumerates projects.
create or replace function my_writable_project_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select project_id from public.project_members
  where user_id = (select auth.uid()) and role in ('builder', 'inspector');
$$;

-- Everyone who shares at least one project with the caller, the caller included.
create or replace function my_project_peer_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select distinct theirs.user_id
  from public.project_members mine
  join public.project_members theirs on theirs.project_id = mine.project_id
  where mine.user_id = (select auth.uid());
$$;

create or replace function my_organization_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select organization_id from public.organization_members where user_id = (select auth.uid());
$$;

create or replace function my_managed_organization_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select organization_id from public.organization_members
  where user_id = (select auth.uid()) and role in ('owner', 'manager');
$$;

revoke execute on function my_project_ids()              from public, anon;
revoke execute on function my_writable_project_ids()     from public, anon;
revoke execute on function my_project_peer_ids()         from public, anon;
revoke execute on function my_organization_ids()         from public, anon;
revoke execute on function my_managed_organization_ids() from public, anon;
grant  execute on function my_project_ids()              to authenticated;
grant  execute on function my_writable_project_ids()     to authenticated;
grant  execute on function my_project_peer_ids()         to authenticated;
grant  execute on function my_organization_ids()         to authenticated;
grant  execute on function my_managed_organization_ids() to authenticated;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
alter policy profiles_select_self_or_shared_project on profiles
  using (
    id = (select auth.uid())
    or (select is_admin())
    or id in (select my_project_peer_ids())
  );

alter policy profiles_update_self on profiles
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Organizations
-- ---------------------------------------------------------------------------
alter policy organizations_select_member on organizations
  using ((select is_admin()) or id in (select my_organization_ids()));

alter policy organizations_update_owner on organizations
  using ((select is_admin()) or id in (select my_managed_organization_ids()))
  with check ((select is_admin()) or id in (select my_managed_organization_ids()));

alter policy organization_members_select on organization_members
  using ((select is_admin()) or organization_id in (select my_organization_ids()));

-- ---------------------------------------------------------------------------
-- Projects and membership
-- ---------------------------------------------------------------------------
alter policy projects_select_member on projects
  using ((select is_admin()) or id in (select my_project_ids()));

alter policy projects_insert_org_manager on projects
  with check (
    (select is_admin()) or organization_id in (select my_managed_organization_ids())
  );

alter policy projects_update_writer on projects
  using ((select is_admin()) or id in (select my_writable_project_ids()))
  with check ((select is_admin()) or id in (select my_writable_project_ids()));

alter policy project_members_select on project_members
  using ((select is_admin()) or project_id in (select my_project_ids()));

alter policy project_members_write on project_members
  with check ((select is_admin()) or project_id in (select my_writable_project_ids()));

alter policy project_members_delete on project_members
  using ((select is_admin()) or project_id in (select my_writable_project_ids()));

-- ---------------------------------------------------------------------------
-- Project-scoped tables with the plain read/write split -- the same list the
-- RLS migration generated its policies from, altered the same way.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  member_check constant text :=
    '((select public.is_admin()) or project_id in (select public.my_project_ids()))';
  writer_check constant text :=
    '((select public.is_admin()) or project_id in (select public.my_writable_project_ids()))';
begin
  foreach t in array array[
    'phases', 'milestones', 'updates', 'update_media',
    'budget_categories', 'cost_entries', 'payments', 'draw_requests',
    'change_orders', 'inspections', 'issues', 'progress_snapshots',
    'weather_log', 'activity_log'
  ]
  loop
    execute format('alter policy %1$s_select_member on %1$I using %2$s', t, member_check);
    execute format('alter policy %1$s_insert_writer on %1$I with check %2$s', t, writer_check);
    execute format(
      'alter policy %1$s_update_writer on %1$I using %2$s with check %2$s', t, writer_check);
    execute format('alter policy %1$s_delete_writer on %1$I using %2$s', t, writer_check);
  end loop;
end;
$$;

-- Dependencies are keyed by milestone. The subquery reads milestones under
-- the caller's own policy, exactly as the original `exists` did.
alter policy milestone_dependencies_select on milestone_dependencies
  using (
    predecessor_id in (
      select m.id from milestones m
      where (select is_admin()) or m.project_id in (select my_project_ids())
    )
  );

alter policy milestone_dependencies_write on milestone_dependencies
  using (
    predecessor_id in (
      select m.id from milestones m
      where (select is_admin()) or m.project_id in (select my_writable_project_ids())
    )
  )
  with check (
    predecessor_id in (
      select m.id from milestones m
      where (select is_admin()) or m.project_id in (select my_writable_project_ids())
    )
  );

-- ---------------------------------------------------------------------------
-- Documents: membership to read, plus the confidentiality rule -- documents
-- flagged confidential reach only the build team.
-- ---------------------------------------------------------------------------
alter policy documents_select_member on documents
  using (
    ((select is_admin()) or project_id in (select my_project_ids()))
    and (
      not is_confidential
      or (select is_admin())
      or project_id in (select my_writable_project_ids())
    )
  );

alter policy documents_insert_writer on documents
  with check ((select is_admin()) or project_id in (select my_writable_project_ids()));

alter policy documents_update_writer on documents
  using ((select is_admin()) or project_id in (select my_writable_project_ids()))
  with check ((select is_admin()) or project_id in (select my_writable_project_ids()));

alter policy documents_delete_writer on documents
  using ((select is_admin()) or project_id in (select my_writable_project_ids()));

-- The documents subqueries run under the documents policy above, so a buyer
-- still cannot acknowledge -- or learn of -- a confidential document.
alter policy document_acks_select on document_acknowledgements
  using (
    user_id = (select auth.uid())
    or document_id in (
      select d.id from documents d
      where (select is_admin()) or d.project_id in (select my_writable_project_ids())
    )
  );

alter policy document_acks_insert_self on document_acknowledgements
  with check (
    user_id = (select auth.uid())
    and document_id in (
      select d.id from documents d
      where (select is_admin()) or d.project_id in (select my_project_ids())
    )
  );

-- ---------------------------------------------------------------------------
-- Notifications, preferences -- strictly personal
-- ---------------------------------------------------------------------------
alter policy notifications_select_own on notifications
  using (user_id = (select auth.uid()));

alter policy notifications_update_own on notifications
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy notifications_delete_own on notifications
  using (user_id = (select auth.uid()));

alter policy notification_prefs_select_own on notification_preferences
  using (user_id = (select auth.uid()));

alter policy notification_prefs_upsert_own on notification_preferences
  with check (user_id = (select auth.uid()));

alter policy notification_prefs_update_own on notification_preferences
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- AI conversations -- private to the person who had them
-- ---------------------------------------------------------------------------
alter policy ai_conversations_own on ai_conversations
  using (
    user_id = (select auth.uid())
    and ((select is_admin()) or project_id in (select my_project_ids()))
  )
  with check (
    user_id = (select auth.uid())
    and ((select is_admin()) or project_id in (select my_project_ids()))
  );

alter policy ai_messages_own on ai_messages
  using (
    conversation_id in (
      select c.id from ai_conversations c where c.user_id = (select auth.uid())
    )
  )
  with check (
    conversation_id in (
      select c.id from ai_conversations c where c.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Storage. The first path segment is still cast to uuid, as before, so a
-- malformed path fails the same way it always did.
-- ---------------------------------------------------------------------------
alter policy project_media_read on storage.objects
  using (
    bucket_id = 'project-media'
    and (
      (select public.is_admin())
      or ((storage.foldername(name))[1])::uuid in (select public.my_project_ids())
    )
  );

alter policy project_media_insert on storage.objects
  with check (
    bucket_id = 'project-media'
    and (
      (select public.is_admin())
      or ((storage.foldername(name))[1])::uuid in (select public.my_writable_project_ids())
    )
  );

alter policy project_media_update on storage.objects
  using (
    bucket_id = 'project-media'
    and (
      (select public.is_admin())
      or ((storage.foldername(name))[1])::uuid in (select public.my_writable_project_ids())
    )
  );

alter policy project_media_delete on storage.objects
  using (
    bucket_id = 'project-media'
    and (
      (select public.is_admin())
      or ((storage.foldername(name))[1])::uuid in (select public.my_writable_project_ids())
    )
  );

alter policy project_documents_read on storage.objects
  using (
    bucket_id = 'project-documents'
    and (
      (select public.is_admin())
      or ((storage.foldername(name))[1])::uuid in (select public.my_project_ids())
    )
  );

alter policy project_documents_insert on storage.objects
  with check (
    bucket_id = 'project-documents'
    and (
      (select public.is_admin())
      or ((storage.foldername(name))[1])::uuid in (select public.my_writable_project_ids())
    )
  );

alter policy project_documents_delete on storage.objects
  using (
    bucket_id = 'project-documents'
    and (
      (select public.is_admin())
      or ((storage.foldername(name))[1])::uuid in (select public.my_writable_project_ids())
    )
  );

alter policy avatars_write_own on storage.objects
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

alter policy avatars_update_own on storage.objects
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

alter policy avatars_delete_own on storage.objects
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

alter policy project_media_snag_insert on storage.objects
  with check (
    bucket_id = 'project-media'
    and (
      (select public.is_admin())
      or ((storage.foldername(name))[1])::uuid in (select public.my_project_ids())
    )
    and (storage.foldername(name))[2] = 'snags'
    and (storage.foldername(name))[3] = (select auth.uid())::text
  );

-- ---------------------------------------------------------------------------
-- Buyer experience
-- ---------------------------------------------------------------------------
alter policy issues_insert_buyer on issues
  with check (
    ((select is_admin()) or project_id in (select my_project_ids()))
    and reported_by = (select auth.uid())
    and raised_by_buyer
    and status = 'open'
    and assigned_to is null
    and resolved_at is null
  );

alter policy selection_categories_select on selection_categories
  using ((select is_admin()) or project_id in (select my_project_ids()));
alter policy selection_categories_write on selection_categories
  using ((select is_admin()) or project_id in (select my_writable_project_ids()))
  with check ((select is_admin()) or project_id in (select my_writable_project_ids()));

alter policy selection_options_select on selection_options
  using ((select is_admin()) or project_id in (select my_project_ids()));
alter policy selection_options_write on selection_options
  using ((select is_admin()) or project_id in (select my_writable_project_ids()))
  with check ((select is_admin()) or project_id in (select my_writable_project_ids()));

alter policy discussions_select on discussions
  using ((select is_admin()) or project_id in (select my_project_ids()));
alter policy discussions_insert on discussions
  with check (
    ((select is_admin()) or project_id in (select my_project_ids()))
    and created_by = (select auth.uid())
  );
alter policy discussions_update_writer on discussions
  using ((select is_admin()) or project_id in (select my_writable_project_ids()))
  with check ((select is_admin()) or project_id in (select my_writable_project_ids()));

alter policy discussion_messages_select on discussion_messages
  using ((select is_admin()) or project_id in (select my_project_ids()));
alter policy discussion_messages_insert on discussion_messages
  with check (
    ((select is_admin()) or project_id in (select my_project_ids()))
    and author_id = (select auth.uid())
  );

alter policy site_visits_select on site_visits
  using ((select is_admin()) or project_id in (select my_project_ids()));
alter policy site_visits_insert_member on site_visits
  with check (
    ((select is_admin()) or project_id in (select my_project_ids()))
    and requested_by = (select auth.uid())
    and status = 'requested'
    -- 48 hours' notice, matching the site's own visiting rules.
    and starts_at >= now() + interval '48 hours'
  );
alter policy site_visits_update_writer on site_visits
  using ((select is_admin()) or project_id in (select my_writable_project_ids()))
  with check ((select is_admin()) or project_id in (select my_writable_project_ids()));
alter policy site_visits_cancel_own on site_visits
  using (requested_by = (select auth.uid()) and status in ('requested', 'confirmed'))
  with check (requested_by = (select auth.uid()) and status = 'cancelled');

alter policy move_tasks_own on move_tasks
  using (
    user_id = (select auth.uid())
    and ((select is_admin()) or project_id in (select my_project_ids()))
  )
  with check (
    user_id = (select auth.uid())
    and ((select is_admin()) or project_id in (select my_project_ids()))
  );

-- ---------------------------------------------------------------------------
-- Indexes for the helpers and the paged feeds.
-- ---------------------------------------------------------------------------

-- Every helper above starts from "rows for this user": an index-only scan
-- with the role alongside, instead of a heap visit per membership.
create index project_members_user_project_role_idx
  on project_members (user_id, project_id) include (role);
drop index if exists project_members_user_id_idx;

create index if not exists organization_members_user_org_role_idx
  on organization_members (user_id, organization_id) include (role);

-- Keyset paging orders by (timestamp desc, id desc); the id breaks ties so a
-- page boundary never falls between two rows with the same instant.
create index updates_project_published_id_idx
  on updates (project_id, published_at desc, id desc);
drop index if exists updates_project_published_idx;

create index discussions_project_last_message_id_idx
  on discussions (project_id, last_message_at desc, id desc);
drop index if exists discussions_project_idx;

-- The gallery pages photographs only.
create index update_media_project_images_idx
  on update_media (project_id, created_at desc, id desc)
  where kind = 'image';

-- "Since you last looked" reads a project's recent messages across threads.
create index discussion_messages_project_created_idx
  on discussion_messages (project_id, created_at desc);

-- Read by project on every selections page; previously only by category.
create index if not exists selection_options_project_idx
  on selection_options (project_id, sequence);

-- Dependencies are fetched by predecessor.
create index if not exists milestone_dependencies_predecessor_idx
  on milestone_dependencies (predecessor_id);
