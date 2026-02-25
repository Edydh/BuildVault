-- BuildVault: push notifications phase 2 (device tokens + delivery state)
-- Date: 2026-02-25

create table if not exists public.user_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null,
  platform text not null default 'unknown',
  device_id text,
  device_name text,
  app_build text,
  is_active boolean not null default true,
  last_registered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_push_tokens_platform_check check (platform in ('ios', 'android', 'unknown')),
  constraint user_push_tokens_token_not_blank check (length(trim(expo_push_token)) > 0)
);

create unique index if not exists idx_user_push_tokens_user_token_unique
  on public.user_push_tokens (user_id, expo_push_token);

create index if not exists idx_user_push_tokens_user_active
  on public.user_push_tokens (user_id, is_active, updated_at desc);

create index if not exists idx_user_push_tokens_active_token
  on public.user_push_tokens (is_active, expo_push_token);

drop trigger if exists trg_user_push_tokens_set_updated_at on public.user_push_tokens;
create trigger trg_user_push_tokens_set_updated_at
before update on public.user_push_tokens
for each row execute function public.set_updated_at();

alter table public.project_notifications
  add column if not exists push_attempted_at timestamptz,
  add column if not exists push_dispatched_at timestamptz,
  add column if not exists push_dispatch_error text,
  add column if not exists push_dispatch_attempts integer not null default 0;

alter table public.project_notifications
  drop constraint if exists project_notifications_push_dispatch_attempts_non_negative;

alter table public.project_notifications
  add constraint project_notifications_push_dispatch_attempts_non_negative
  check (push_dispatch_attempts >= 0);

create index if not exists idx_project_notifications_push_pending
  on public.project_notifications (push_dispatched_at, push_dispatch_attempts, created_at desc);

-- Avoid sending a flood of stale push notifications at rollout.
update public.project_notifications
set
  push_attempted_at = coalesce(push_attempted_at, now()),
  push_dispatched_at = coalesce(push_dispatched_at, now()),
  push_dispatch_error = case
    when push_dispatched_at is null then coalesce(push_dispatch_error, 'seeded_as_historical')
    else push_dispatch_error
  end
where push_dispatched_at is null
  and created_at < now() - interval '6 hours';

alter table public.user_push_tokens enable row level security;

drop policy if exists user_push_tokens_select_self on public.user_push_tokens;
drop policy if exists user_push_tokens_insert_self on public.user_push_tokens;
drop policy if exists user_push_tokens_update_self on public.user_push_tokens;
drop policy if exists user_push_tokens_delete_self on public.user_push_tokens;

create policy user_push_tokens_select_self
on public.user_push_tokens
for select
to authenticated
using (user_id = (select auth.uid()));

create policy user_push_tokens_insert_self
on public.user_push_tokens
for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy user_push_tokens_update_self
on public.user_push_tokens
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy user_push_tokens_delete_self
on public.user_push_tokens
for delete
to authenticated
using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.user_push_tokens to authenticated;
revoke all on public.user_push_tokens from anon;
