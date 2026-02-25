-- BuildVault: activity comments
-- Date: 2026-02-25

create table if not exists public.activity_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  activity_id uuid not null references public.activity_log(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  author_name_snapshot text,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activity_comments_body_not_blank check (length(trim(body)) > 0)
);

create index if not exists idx_activity_comments_project_created
  on public.activity_comments (project_id, created_at desc);

create index if not exists idx_activity_comments_activity_created
  on public.activity_comments (activity_id, created_at asc);

create index if not exists idx_activity_comments_author_created
  on public.activity_comments (author_user_id, created_at desc);

drop trigger if exists trg_activity_comments_set_updated_at on public.activity_comments;
create trigger trg_activity_comments_set_updated_at
before update on public.activity_comments
for each row execute function public.set_updated_at();

alter table public.activity_comments enable row level security;

drop policy if exists activity_comments_select_member on public.activity_comments;
drop policy if exists activity_comments_insert_member on public.activity_comments;
drop policy if exists activity_comments_update_author_or_manager on public.activity_comments;
drop policy if exists activity_comments_delete_author_or_manager on public.activity_comments;

create policy activity_comments_select_member
on public.activity_comments
for select
to authenticated
using (public.is_project_member(project_id));

create policy activity_comments_insert_member
on public.activity_comments
for insert
to authenticated
with check (
  public.is_project_member(project_id)
  and (
    author_user_id is null
    or author_user_id = (select auth.uid())
  )
);

create policy activity_comments_update_author_or_manager
on public.activity_comments
for update
to authenticated
using (
  public.has_project_role(project_id, array['owner', 'manager'])
  or author_user_id = (select auth.uid())
)
with check (
  public.has_project_role(project_id, array['owner', 'manager'])
  or author_user_id = (select auth.uid())
);

create policy activity_comments_delete_author_or_manager
on public.activity_comments
for delete
to authenticated
using (
  public.has_project_role(project_id, array['owner', 'manager'])
  or author_user_id = (select auth.uid())
);

grant select, insert, update, delete on public.activity_comments to authenticated;
revoke all on public.activity_comments from anon;
