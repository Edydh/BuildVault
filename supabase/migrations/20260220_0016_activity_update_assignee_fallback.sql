-- BuildVault: allow assignees to update manual activities even for legacy
-- assignment payloads that may only include assignee_email or assignee_member_id.

drop policy if exists activity_log_update_manager on public.activity_log;
drop policy if exists activity_log_update_manager_or_assignee on public.activity_log;

create policy activity_log_update_manager_or_assignee
on public.activity_log
for update
to authenticated
using (
  public.has_project_role(project_id, array['owner', 'manager'], (select auth.uid()))
  or (
    public.is_project_member(project_id, (select auth.uid()))
    and (
      coalesce(metadata->>'assignee_user_id', '') = ((select auth.uid())::text)
      or (
        coalesce(metadata->>'assignee_email', '') <> ''
        and lower(metadata->>'assignee_email') = lower(coalesce(((select auth.jwt()) ->> 'email'), ''))
      )
      or exists (
        select 1
        from public.project_members pm
        where pm.project_id = activity_log.project_id
          and pm.status = 'active'
          and pm.user_id = (select auth.uid())
          and pm.id::text = coalesce(metadata->>'assignee_member_id', '')
      )
    )
  )
)
with check (
  public.has_project_role(project_id, array['owner', 'manager'], (select auth.uid()))
  or (
    public.is_project_member(project_id, (select auth.uid()))
    and (
      coalesce(metadata->>'assignee_user_id', '') = ((select auth.uid())::text)
      or (
        coalesce(metadata->>'assignee_email', '') <> ''
        and lower(metadata->>'assignee_email') = lower(coalesce(((select auth.jwt()) ->> 'email'), ''))
      )
      or exists (
        select 1
        from public.project_members pm
        where pm.project_id = activity_log.project_id
          and pm.status = 'active'
          and pm.user_id = (select auth.uid())
          and pm.id::text = coalesce(metadata->>'assignee_member_id', '')
      )
    )
  )
);
