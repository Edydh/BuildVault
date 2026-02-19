-- BuildVault: stabilize project creation ownership checks
-- Date: 2026-02-19
--
-- Why:
-- Project creation should bind ownership to the JWT user on the server side.
-- This avoids client payload drift and keeps RLS checks predictable.

create or replace function public.projects_assign_owner_from_auth()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  jwt_user_id uuid;
begin
  jwt_user_id := (select auth.uid());
  if jwt_user_id is not null then
    new.owner_user_id := jwt_user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_projects_assign_owner_from_auth on public.projects;
create trigger trg_projects_assign_owner_from_auth
before insert on public.projects
for each row execute function public.projects_assign_owner_from_auth();

drop policy if exists projects_insert_owner on public.projects;

create policy projects_insert_owner
on public.projects
for insert
to authenticated
with check (
  (
    organization_id is null
    or public.is_org_member(organization_id, (select auth.uid()))
    or exists (
      select 1
      from public.organizations o
      where o.id = organization_id
        and o.owner_user_id = (select auth.uid())
    )
  )
);
