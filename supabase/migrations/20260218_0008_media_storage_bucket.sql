-- BuildVault: media binary sync via Supabase Storage
-- Date: 2026-02-18

-- Ensure storage is available and bucket exists.
insert into storage.buckets (id, name, public)
values ('buildvault-media', 'buildvault-media', true)
on conflict (id) do update
set public = excluded.public;

-- Helper to safely resolve project UUID from object path:
-- users/{user_id}/projects/{project_id}/{kind}/{filename}
create or replace function public.storage_object_project_id(object_name text)
returns uuid
language plpgsql
stable
as $$
declare
  candidate text;
begin
  candidate := split_part(object_name, '/', 4);
  if candidate ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return candidate::uuid;
  end if;
  return null;
end;
$$;

drop policy if exists storage_media_insert_member on storage.objects;
drop policy if exists storage_media_delete_member on storage.objects;

create policy storage_media_insert_member
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'buildvault-media'
  and split_part(name, '/', 1) = 'users'
  and split_part(name, '/', 2) = (select auth.uid())::text
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
