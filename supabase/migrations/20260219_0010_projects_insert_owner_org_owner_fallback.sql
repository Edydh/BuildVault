-- BuildVault: allow organization owners to create projects even if membership row is out-of-sync
-- Date: 2026-02-19
--
-- Why:
-- Some accounts can own an organization row but still fail `projects` INSERT due to
-- `is_org_member(...)` evaluating false (e.g. stale or missing owner membership row).
-- Organization ownership should always allow creating projects inside that organization.

drop policy if exists projects_insert_owner on public.projects;

create policy projects_insert_owner
on public.projects
for insert
to authenticated
with check (
  owner_user_id = (select auth.uid())
  and (
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
