-- BuildVault: cleanup remaining RLS performance warnings
-- Date: 2026-02-18
--
-- Targets:
-- 1) auth_rls_initplan warnings on organizations / organization_members policies
-- 2) multiple_permissive_policies warnings on organization_members UPDATE
-- 3) multiple_permissive_policies warnings on public_project_comments UPDATE/DELETE

create or replace function public.request_auth_uid()
returns uuid
language sql
stable
set search_path = public
as $$
  select auth.uid();
$$;

create or replace function public.request_auth_email()
returns text
language sql
stable
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

grant execute on function public.request_auth_uid() to authenticated, anon;
grant execute on function public.request_auth_email() to authenticated, anon;

-- organizations_select_member
drop policy if exists organizations_select_member on public.organizations;

create policy organizations_select_member
on public.organizations
for select
to authenticated
using (
  public.is_org_member(id, (select public.request_auth_uid()))
  or exists (
    select 1
    from public.organization_members om
    where om.organization_id = organizations.id
      and om.status = 'invited'
      and om.invited_email is not null
      and lower(om.invited_email::text) = (select public.request_auth_email())
  )
);

-- Consolidate organization_members UPDATE policies into one.
drop policy if exists organization_members_update_admin on public.organization_members;
drop policy if exists organization_members_update_invitee_accept on public.organization_members;

create policy organization_members_update_authenticated
on public.organization_members
for update
to authenticated
using (
  public.has_org_role(organization_id, array['owner', 'admin'], (select public.request_auth_uid()))
  or (
    status = 'invited'
    and invited_email is not null
    and lower(invited_email::text) = (select public.request_auth_email())
  )
)
with check (
  public.has_org_role(organization_id, array['owner', 'admin'], (select public.request_auth_uid()))
  or (
    user_id = (select public.request_auth_uid())
    and status = 'active'
    and invited_email is not null
    and lower(invited_email::text) = (select public.request_auth_email())
  )
);

-- organization_members_select_member_or_invitee
drop policy if exists organization_members_select_member_or_invitee on public.organization_members;

create policy organization_members_select_member_or_invitee
on public.organization_members
for select
to authenticated
using (
  public.is_org_member(organization_id, (select public.request_auth_uid()))
  or (
    invited_email is not null
    and lower(invited_email::text) = (select public.request_auth_email())
  )
);

-- Consolidate public_project_comments UPDATE policies.
drop policy if exists public_project_comments_update_self on public.public_project_comments;
drop policy if exists public_project_comments_update_manager on public.public_project_comments;

create policy public_project_comments_update_authenticated
on public.public_project_comments
for update
to authenticated
using (
  user_id = (select public.request_auth_uid())
  or public.has_project_role(project_id, array['owner', 'manager'], (select public.request_auth_uid()))
)
with check (
  user_id = (select public.request_auth_uid())
  or public.has_project_role(project_id, array['owner', 'manager'], (select public.request_auth_uid()))
);

-- Consolidate public_project_comments DELETE policies.
drop policy if exists public_project_comments_delete_self on public.public_project_comments;
drop policy if exists public_project_comments_delete_manager on public.public_project_comments;

create policy public_project_comments_delete_authenticated
on public.public_project_comments
for delete
to authenticated
using (
  user_id = (select public.request_auth_uid())
  or public.has_project_role(project_id, array['owner', 'manager'], (select public.request_auth_uid()))
);
