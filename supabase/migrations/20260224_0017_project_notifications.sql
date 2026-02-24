-- BuildVault: in-app project notifications
-- Date: 2026-02-24

create table if not exists public.project_notifications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  activity_id uuid not null references public.activity_log(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action_type text not null,
  title text,
  body text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint project_notifications_action_type_not_blank check (length(trim(action_type)) > 0)
);

create unique index if not exists idx_project_notifications_activity_recipient_unique
  on public.project_notifications (activity_id, recipient_user_id);

create index if not exists idx_project_notifications_recipient_created
  on public.project_notifications (recipient_user_id, created_at desc);

create index if not exists idx_project_notifications_recipient_read_created
  on public.project_notifications (recipient_user_id, read_at, created_at desc);

create or replace function public.fanout_project_activity_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_project_name text;
  resolved_title text;
  resolved_body text;
begin
  if new.project_id is null then
    return new;
  end if;

  select p.name
  into resolved_project_name
  from public.projects p
  where p.id = new.project_id;

  resolved_title := case new.action_type
    when 'media_added' then 'New media added'
    when 'media_deleted' then 'Media removed'
    when 'note_added' then 'New note added'
    when 'note_updated' then 'Note updated'
    when 'member_added' then 'Member added'
    when 'member_removed' then 'Member removed'
    when 'member_role_updated' then 'Member role updated'
    when 'member_invited' then 'Member invited'
    when 'invite_accepted' then 'Invitation accepted'
    when 'project_marked_completed' then 'Project completed'
    when 'project_reopened' then 'Project reopened'
    when 'project_published' then 'Project published'
    when 'project_unpublished' then 'Project unpublished'
    else 'Project update'
  end;

  resolved_body := concat(
    coalesce(nullif(new.actor_name_snapshot, ''), 'A teammate'),
    ' • ',
    coalesce(resolved_project_name, 'Project')
  );

  insert into public.project_notifications (
    id,
    project_id,
    activity_id,
    recipient_user_id,
    actor_user_id,
    action_type,
    title,
    body,
    metadata,
    created_at
  )
  select
    gen_random_uuid(),
    new.project_id,
    new.id,
    recipients.recipient_user_id,
    new.actor_user_id,
    new.action_type,
    resolved_title,
    resolved_body,
    jsonb_build_object(
      'reference_id', new.reference_id,
      'actor_name_snapshot', new.actor_name_snapshot,
      'project_name', resolved_project_name
    ),
    new.created_at
  from (
    select p.owner_user_id as recipient_user_id
    from public.projects p
    where p.id = new.project_id
    union
    select pm.user_id as recipient_user_id
    from public.project_members pm
    where pm.project_id = new.project_id
      and pm.status = 'active'
      and pm.user_id is not null
  ) recipients
  where recipients.recipient_user_id is not null
    and recipients.recipient_user_id <> coalesce(
      new.actor_user_id,
      '00000000-0000-0000-0000-000000000000'::uuid
    )
  on conflict (activity_id, recipient_user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_activity_log_fanout_notifications on public.activity_log;
create trigger trg_activity_log_fanout_notifications
after insert on public.activity_log
for each row execute function public.fanout_project_activity_notifications();

-- Best-effort backfill for recent activity so existing projects show useful notifications.
insert into public.project_notifications (
  id,
  project_id,
  activity_id,
  recipient_user_id,
  actor_user_id,
  action_type,
  title,
  body,
  metadata,
  created_at
)
select
  gen_random_uuid(),
  a.project_id,
  a.id,
  recipients.recipient_user_id,
  a.actor_user_id,
  a.action_type,
  case a.action_type
    when 'media_added' then 'New media added'
    when 'media_deleted' then 'Media removed'
    when 'note_added' then 'New note added'
    when 'note_updated' then 'Note updated'
    when 'member_added' then 'Member added'
    when 'member_removed' then 'Member removed'
    when 'member_role_updated' then 'Member role updated'
    when 'member_invited' then 'Member invited'
    when 'invite_accepted' then 'Invitation accepted'
    when 'project_marked_completed' then 'Project completed'
    when 'project_reopened' then 'Project reopened'
    when 'project_published' then 'Project published'
    when 'project_unpublished' then 'Project unpublished'
    else 'Project update'
  end,
  concat(
    coalesce(nullif(a.actor_name_snapshot, ''), 'A teammate'),
    ' • ',
    coalesce(p.name, 'Project')
  ),
  jsonb_build_object(
    'reference_id', a.reference_id,
    'actor_name_snapshot', a.actor_name_snapshot,
    'project_name', p.name
  ),
  a.created_at
from public.activity_log a
join public.projects p on p.id = a.project_id
join lateral (
  select p.owner_user_id as recipient_user_id
  union
  select pm.user_id as recipient_user_id
  from public.project_members pm
  where pm.project_id = a.project_id
    and pm.status = 'active'
    and pm.user_id is not null
) recipients on true
where a.created_at >= now() - interval '30 days'
  and recipients.recipient_user_id <> coalesce(
    a.actor_user_id,
    '00000000-0000-0000-0000-000000000000'::uuid
  )
on conflict (activity_id, recipient_user_id) do nothing;

alter table public.project_notifications enable row level security;

drop policy if exists project_notifications_select_self on public.project_notifications;
drop policy if exists project_notifications_update_self on public.project_notifications;
drop policy if exists project_notifications_delete_self on public.project_notifications;

create policy project_notifications_select_self
on public.project_notifications
for select
to authenticated
using (recipient_user_id = (select auth.uid()));

create policy project_notifications_update_self
on public.project_notifications
for update
to authenticated
using (recipient_user_id = (select auth.uid()))
with check (recipient_user_id = (select auth.uid()));

create policy project_notifications_delete_self
on public.project_notifications
for delete
to authenticated
using (recipient_user_id = (select auth.uid()));

grant select, update, delete on public.project_notifications to authenticated;
revoke all on public.project_notifications from anon;
