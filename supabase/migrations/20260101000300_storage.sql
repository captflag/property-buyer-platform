-- ============================================================================
-- Storage buckets and their access rules.
--
-- Path convention for the two project buckets is `<project_id>/<rest...>`, so
-- the first path segment is the tenant key. Every policy below derives the
-- project from that segment and reuses the same membership helpers as the
-- table policies -- one access model, not two.
--
-- Both project buckets are private. Files reach the browser through short-lived
-- signed URLs minted server-side, so a leaked path is not a leaked document.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'project-media',
    'project-media',
    false,
    52428800, -- 50 MB
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4', 'video/webm']
  ),
  (
    'project-documents',
    'project-documents',
    false,
    104857600, -- 100 MB
    array[
      'application/pdf',
      'image/jpeg', 'image/png',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword', 'application/vnd.ms-excel'
    ]
  ),
  (
    'avatars',
    'avatars',
    true,
    2097152, -- 2 MB
    array['image/jpeg', 'image/png', 'image/webp']
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- project-media: any project member may read; only writers may upload.
-- ---------------------------------------------------------------------------
create policy project_media_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'project-media'
    and is_project_member(((storage.foldername(name))[1])::uuid)
  );

create policy project_media_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'project-media'
    and can_write_project(((storage.foldername(name))[1])::uuid)
  );

create policy project_media_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'project-media'
    and can_write_project(((storage.foldername(name))[1])::uuid)
  );

create policy project_media_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'project-media'
    and can_write_project(((storage.foldername(name))[1])::uuid)
  );

-- ---------------------------------------------------------------------------
-- project-documents: same shape. Confidentiality is enforced on the documents
-- row (see the RLS migration); the bucket policy gates the bytes.
-- ---------------------------------------------------------------------------
create policy project_documents_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'project-documents'
    and is_project_member(((storage.foldername(name))[1])::uuid)
  );

create policy project_documents_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'project-documents'
    and can_write_project(((storage.foldername(name))[1])::uuid)
  );

create policy project_documents_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'project-documents'
    and can_write_project(((storage.foldername(name))[1])::uuid)
  );

-- ---------------------------------------------------------------------------
-- avatars: world-readable, but you may only write your own, keyed by user id.
-- ---------------------------------------------------------------------------
create policy avatars_read on storage.objects
  for select using (bucket_id = 'avatars');

create policy avatars_write_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
