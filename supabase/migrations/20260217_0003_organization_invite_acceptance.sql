-- BuildVault: organization invite acceptance + invite visibility
-- Date: 2026-02-17

-- Allow users with pending email invites to read organization rows,
-- so organization names can be shown before invite acceptance.
drop policy if exists organizations_select_member on public.organizations;

create policy organizations_select_member
on public.organizations
for select
to authenticated
using (
  public.is_org_member(id)
  or exists (
    select 1
    from public.organization_members om
    where om.organization_id = organizations.id
      and om.status = 'invited'
      and om.invited_email is not null
      and lower(om.invited_email::text) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

-- Allow invitees to accept their own invite row by transitioning
-- from invited -> active and attaching their auth user id.
drop policy if exists organization_members_update_invitee_accept on public.organization_members;

create policy organization_members_update_invitee_accept
on public.organization_members
for update
to authenticated
using (
  status = 'invited'
  and invited_email is not null
  and lower(invited_email::text) = lower(coalesce(auth.jwt() ->> 'email', ''))
)
with check (
  user_id = auth.uid()
  and status = 'active'
  and invited_email is not null
  and lower(invited_email::text) = lower(coalesce(auth.jwt() ->> 'email', ''))
);
