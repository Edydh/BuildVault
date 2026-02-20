-- BuildVault: allow media storage upserts for project members
-- Date: 2026-02-19
--
-- Why:
-- Media uploads use `upsert: true` to make retries idempotent. Storage RLS must
-- allow UPDATE on existing objects in addition to INSERT.

drop policy if exists storage_media_update_member on storage.objects;

create policy storage_media_update_member
on storage.objects
for update
to authenticated
using (
  bucket_id = 'buildvault-media'
  and split_part(name, '/', 1) = 'users'
  and split_part(name, '/', 2) = (select auth.uid())::text
  and split_part(name, '/', 3) = 'projects'
  and public.storage_object_project_id(name) is not null
  and public.is_project_member(public.storage_object_project_id(name), (select auth.uid()))
)
with check (
  bucket_id = 'buildvault-media'
  and split_part(name, '/', 1) = 'users'
  and split_part(name, '/', 2) = (select auth.uid())::text
  and split_part(name, '/', 3) = 'projects'
  and public.storage_object_project_id(name) is not null
  and public.is_project_member(public.storage_object_project_id(name), (select auth.uid()))
);
