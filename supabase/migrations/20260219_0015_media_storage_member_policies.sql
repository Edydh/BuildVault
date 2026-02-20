-- BuildVault: storage policy alignment for collaborative media sync
-- Date: 2026-02-19
--
-- Why:
-- Existing storage policies tied writes to `users/{auth.uid()}/...` path ownership.
-- Backfill and retries can involve pre-existing objects/rows where strict path-owner
-- checks cause RLS failures. We align policies to project membership.

drop policy if exists storage_media_insert_member on storage.objects;
drop policy if exists storage_media_update_member on storage.objects;
drop policy if exists storage_media_delete_member on storage.objects;
drop policy if exists storage_media_select_member on storage.objects;

create policy storage_media_select_member
on storage.objects
for select
to authenticated
using (
  bucket_id = 'buildvault-media'
  and public.storage_object_project_id(name) is not null
  and public.is_project_member(public.storage_object_project_id(name), (select auth.uid()))
);

create policy storage_media_insert_member
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'buildvault-media'
  and split_part(name, '/', 1) = 'users'
  and split_part(name, '/', 3) = 'projects'
  and public.storage_object_project_id(name) is not null
  and public.is_project_member(public.storage_object_project_id(name), (select auth.uid()))
);

create policy storage_media_update_member
on storage.objects
for update
to authenticated
using (
  bucket_id = 'buildvault-media'
  and split_part(name, '/', 1) = 'users'
  and split_part(name, '/', 3) = 'projects'
  and public.storage_object_project_id(name) is not null
  and public.is_project_member(public.storage_object_project_id(name), (select auth.uid()))
)
with check (
  bucket_id = 'buildvault-media'
  and split_part(name, '/', 1) = 'users'
  and split_part(name, '/', 3) = 'projects'
  and public.storage_object_project_id(name) is not null
  and public.is_project_member(public.storage_object_project_id(name), (select auth.uid()))
);

create policy storage_media_delete_member
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'buildvault-media'
  and public.storage_object_project_id(name) is not null
  and public.is_project_member(public.storage_object_project_id(name), (select auth.uid()))
);
