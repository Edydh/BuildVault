-- BuildVault: fan-out notifications for activity comments
-- Date: 2026-02-25

create or replace function public.fanout_activity_comment_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_project_name text;
  resolved_actor_name text;
begin
  if new.project_id is null or new.activity_id is null then
    return new;
  end if;

  select p.name
  into resolved_project_name
  from public.projects p
  where p.id = new.project_id;

  resolved_actor_name := coalesce(
    nullif(new.author_name_snapshot, ''),
    (
      select nullif(trim(coalesce(u.raw_user_meta_data->>'name', u.email)), '')
      from auth.users u
      where u.id = new.author_user_id
    ),
    'A teammate'
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
    created_at,
    read_at,
    push_attempted_at,
    push_dispatched_at,
    push_dispatch_error,
    push_dispatch_attempts
  )
  select
    gen_random_uuid(),
    new.project_id,
    new.activity_id,
    recipients.recipient_user_id,
    new.author_user_id,
    'activity_comment_added',
    'New comment',
    concat(resolved_actor_name, ' commented • ', coalesce(resolved_project_name, 'Project')),
    jsonb_build_object(
      'comment_id', new.id,
      'activity_id', new.activity_id,
      'project_name', resolved_project_name,
      'actor_name_snapshot', resolved_actor_name
    ),
    new.created_at,
    null,
    null,
    null,
    null,
    0
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
      new.author_user_id,
      '00000000-0000-0000-0000-000000000000'::uuid
    )
  on conflict (activity_id, recipient_user_id) do update
  set actor_user_id = excluded.actor_user_id,
      action_type = excluded.action_type,
      title = excluded.title,
      body = excluded.body,
      metadata = excluded.metadata,
      created_at = excluded.created_at,
      read_at = null,
      push_attempted_at = null,
      push_dispatched_at = null,
      push_dispatch_error = null,
      push_dispatch_attempts = 0;

  return new;
end;
$$;

drop trigger if exists trg_activity_comments_fanout_notifications on public.activity_comments;
create trigger trg_activity_comments_fanout_notifications
after insert on public.activity_comments
for each row execute function public.fanout_activity_comment_notifications();
