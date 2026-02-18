-- BuildVault: allow owners to select their own organization rows directly
-- Date: 2026-02-18
--
-- Why:
-- Creating organizations can fail with RLS violation when the inserted row
-- is not immediately visible via membership-based select checks.
-- We explicitly allow owner_user_id = auth.uid() for select.

drop policy if exists organizations_select_member on public.organizations;

create policy organizations_select_member
on public.organizations
for select
to authenticated
using (
  owner_user_id = (select auth.uid())
  or public.is_org_member(id, (select auth.uid()))
  or exists (
    select 1
    from public.organization_members om
    where om.organization_id = organizations.id
      and om.status = 'invited'
      and om.invited_email is not null
      and lower(om.invited_email::text) = (select lower(coalesce(auth.jwt() ->> 'email', '')))
  )
);
