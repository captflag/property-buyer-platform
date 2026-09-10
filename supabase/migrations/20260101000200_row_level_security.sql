-- ============================================================================
-- Row Level Security
--
-- Default posture: every table is deny-all until a policy opens it. Read access
-- is granted by project membership; write access additionally requires the
-- builder/inspector role on that project (or admin).
--
-- Policies are split per command rather than using `for all`, because
-- `with check` and `using` mean different things on insert vs update and
-- collapsing them hides mistakes.
-- ============================================================================

alter table profiles                  enable row level security;
alter table organizations             enable row level security;
alter table organization_members      enable row level security;
alter table projects                  enable row level security;
alter table project_members           enable row level security;
alter table phases                    enable row level security;
alter table milestones                enable row level security;
alter table milestone_dependencies    enable row level security;
alter table updates                   enable row level security;
alter table update_media              enable row level security;
alter table documents                 enable row level security;
alter table document_acknowledgements enable row level security;
alter table budget_categories         enable row level security;
alter table cost_entries              enable row level security;
alter table payments                  enable row level security;
alter table draw_requests             enable row level security;
alter table change_orders             enable row level security;
alter table inspections               enable row level security;
alter table issues                    enable row level security;
alter table progress_snapshots        enable row level security;
alter table weather_log               enable row level security;
alter table notifications             enable row level security;
alter table notification_preferences  enable row level security;
alter table activity_log              enable row level security;
alter table ai_conversations          enable row level security;
alter table ai_messages               enable row level security;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create policy profiles_select_self_or_shared_project on profiles
  for select to authenticated
  using (
    id = auth.uid()
    or is_admin()
    or exists (
      select 1
      from project_members mine
      join project_members theirs on theirs.project_id = mine.project_id
      where mine.user_id = auth.uid() and theirs.user_id = profiles.id
    )
  );

create policy profiles_update_self on profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Organizations
-- ---------------------------------------------------------------------------
create policy organizations_select_member on organizations
  for select to authenticated
  using (is_org_member(id));

create policy organizations_update_owner on organizations
  for update to authenticated
  using (
    is_admin() or exists (
      select 1 from organization_members
      where organization_id = organizations.id
        and user_id = auth.uid()
        and role in ('owner', 'manager')
    )
  )
  with check (
    is_admin() or exists (
      select 1 from organization_members
      where organization_id = organizations.id
        and user_id = auth.uid()
        and role in ('owner', 'manager')
    )
  );

create policy organization_members_select on organization_members
  for select to authenticated
  using (is_org_member(organization_id));

-- ---------------------------------------------------------------------------
-- Projects and membership
-- ---------------------------------------------------------------------------
create policy projects_select_member on projects
  for select to authenticated
  using (is_project_member(id));

create policy projects_insert_org_manager on projects
  for insert to authenticated
  with check (
    is_admin() or exists (
      select 1 from organization_members
      where organization_id = projects.organization_id
        and user_id = auth.uid()
        and role in ('owner', 'manager')
    )
  );

create policy projects_update_writer on projects
  for update to authenticated
  using (can_write_project(id))
  with check (can_write_project(id));

create policy project_members_select on project_members
  for select to authenticated
  using (is_project_member(project_id));

create policy project_members_write on project_members
  for insert to authenticated
  with check (can_write_project(project_id));

create policy project_members_delete on project_members
  for delete to authenticated
  using (can_write_project(project_id));

-- ---------------------------------------------------------------------------
-- Project-scoped tables that follow the plain read/write split.
-- Generated rather than hand-written so no table is quietly forgotten.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'phases', 'milestones', 'updates', 'update_media',
    'budget_categories', 'cost_entries', 'payments', 'draw_requests',
    'change_orders', 'inspections', 'issues', 'progress_snapshots',
    'weather_log', 'activity_log'
  ]
  loop
    execute format(
      'create policy %1$s_select_member on %1$I
         for select to authenticated using (is_project_member(project_id))', t);
    execute format(
      'create policy %1$s_insert_writer on %1$I
         for insert to authenticated with check (can_write_project(project_id))', t);
    execute format(
      'create policy %1$s_update_writer on %1$I
         for update to authenticated
         using (can_write_project(project_id))
         with check (can_write_project(project_id))', t);
    execute format(
      'create policy %1$s_delete_writer on %1$I
         for delete to authenticated using (can_write_project(project_id))', t);
  end loop;
end;
$$;

-- Dependencies are keyed by milestone, not project, so they get their own pair.
create policy milestone_dependencies_select on milestone_dependencies
  for select to authenticated
  using (
    exists (
      select 1 from milestones m
      where m.id = milestone_dependencies.predecessor_id
        and is_project_member(m.project_id)
    )
  );

create policy milestone_dependencies_write on milestone_dependencies
  for all to authenticated
  using (
    exists (
      select 1 from milestones m
      where m.id = milestone_dependencies.predecessor_id
        and can_write_project(m.project_id)
    )
  )
  with check (
    exists (
      select 1 from milestones m
      where m.id = milestone_dependencies.predecessor_id
        and can_write_project(m.project_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Documents
--
-- Same read/write split as above, plus one extra rule: documents flagged
-- confidential are internal to the build team and never reach the buyer.
-- ---------------------------------------------------------------------------
create policy documents_select_member on documents
  for select to authenticated
  using (
    is_project_member(project_id)
    and (
      not is_confidential
      or can_write_project(project_id)
    )
  );

create policy documents_insert_writer on documents
  for insert to authenticated
  with check (can_write_project(project_id));

create policy documents_update_writer on documents
  for update to authenticated
  using (can_write_project(project_id))
  with check (can_write_project(project_id));

create policy documents_delete_writer on documents
  for delete to authenticated
  using (can_write_project(project_id));

-- Acknowledgements are personal: you sign for yourself, and the build team can
-- see who has signed.
create policy document_acks_select on document_acknowledgements
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from documents d
      where d.id = document_acknowledgements.document_id
        and can_write_project(d.project_id)
    )
  );

create policy document_acks_insert_self on document_acknowledgements
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from documents d
      where d.id = document_acknowledgements.document_id
        and is_project_member(d.project_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Notifications, preferences -- strictly personal
-- ---------------------------------------------------------------------------
create policy notifications_select_own on notifications
  for select to authenticated using (user_id = auth.uid());

create policy notifications_update_own on notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy notifications_delete_own on notifications
  for delete to authenticated using (user_id = auth.uid());

create policy notification_prefs_select_own on notification_preferences
  for select to authenticated using (user_id = auth.uid());

create policy notification_prefs_upsert_own on notification_preferences
  for insert to authenticated with check (user_id = auth.uid());

create policy notification_prefs_update_own on notification_preferences
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- AI conversations -- private to the person who had them
-- ---------------------------------------------------------------------------
create policy ai_conversations_own on ai_conversations
  for all to authenticated
  using (user_id = auth.uid() and is_project_member(project_id))
  with check (user_id = auth.uid() and is_project_member(project_id));

create policy ai_messages_own on ai_messages
  for all to authenticated
  using (
    exists (
      select 1 from ai_conversations c
      where c.id = ai_messages.conversation_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from ai_conversations c
      where c.id = ai_messages.conversation_id and c.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Realtime: publish the tables the client subscribes to.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table updates;
alter publication supabase_realtime add table milestones;
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table issues;
alter publication supabase_realtime add table payments;
alter publication supabase_realtime add table activity_log;
