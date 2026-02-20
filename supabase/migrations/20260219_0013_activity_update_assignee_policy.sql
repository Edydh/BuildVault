-- Allow assignees to update their own activity status (accept/reject), while preserving
-- owner/manager control over activity edits.

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
    and coalesce(metadata->>'assignee_user_id', '') = ((select auth.uid())::text)
  )
)
with check (
  public.has_project_role(project_id, array['owner', 'manager'], (select auth.uid()))
  or (
    public.is_project_member(project_id, (select auth.uid()))
    and coalesce(metadata->>'assignee_user_id', '') = ((select auth.uid())::text)
  )
);
