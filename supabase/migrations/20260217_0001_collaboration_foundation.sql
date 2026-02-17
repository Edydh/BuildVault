-- BuildVault: Supabase collaboration foundation
-- Date: 2026-02-17

create extension if not exists pgcrypto;
create extension if not exists citext;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_name_not_blank check (length(trim(name)) > 0),
  constraint organizations_slug_format check (
    slug is null or slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  )
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  invited_email citext,
  role text not null default 'member',
  status text not null default 'invited',
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_at timestamptz,
  constraint organization_members_identity_check check (
    user_id is not null or invited_email is not null
  ),
  constraint organization_members_role_check check (
    role in ('owner', 'admin', 'member', 'viewer')
  ),
  constraint organization_members_status_check check (
    status in ('active', 'invited', 'removed')
  )
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  name text not null,
  client text,
  location text,
  status text not null default 'neutral',
  status_override text,
  visibility text not null default 'private',
  public_slug text,
  public_published_at timestamptz,
  public_updated_at timestamptz,
  progress integer not null default 0,
  start_date timestamptz,
  end_date timestamptz,
  budget numeric(14, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_name_not_blank check (length(trim(name)) > 0),
  constraint projects_status_check check (
    status in ('active', 'delayed', 'completed', 'neutral')
  ),
  constraint projects_status_override_check check (
    status_override is null or status_override in ('active', 'delayed', 'completed', 'neutral')
  ),
  constraint projects_visibility_check check (
    visibility in ('private', 'public')
  ),
  constraint projects_progress_check check (
    progress between 0 and 100
  ),
  constraint projects_budget_check check (
    budget is null or budget >= 0
  ),
  constraint projects_public_slug_format check (
    public_slug is null or public_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  )
);

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  invited_email citext,
  role text not null default 'worker',
  status text not null default 'invited',
  invited_by uuid references auth.users(id) on delete set null,
  user_name_snapshot text,
  user_email_snapshot text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_at timestamptz,
  constraint project_members_identity_check check (
    user_id is not null or invited_email is not null
  ),
  constraint project_members_role_check check (
    role in ('owner', 'manager', 'worker', 'client')
  ),
  constraint project_members_status_check check (
    status in ('active', 'invited', 'removed')
  )
);

create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint folders_name_not_blank check (length(trim(name)) > 0)
);

create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  folder_id uuid references public.folders(id) on delete set null,
  uploaded_by_user_id uuid references auth.users(id) on delete set null,
  type text not null,
  uri text not null,
  thumb_uri text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_type_check check (type in ('photo', 'video', 'doc'))
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  media_id uuid references public.media(id) on delete set null,
  author_user_id uuid references auth.users(id) on delete set null,
  title text,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notes_content_not_blank check (length(trim(content)) > 0)
);

create table if not exists public.project_phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  weight numeric(6, 2) not null default 0,
  status text not null default 'pending',
  due_date timestamptz,
  completed_at timestamptz,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_phases_name_not_blank check (length(trim(name)) > 0),
  constraint project_phases_weight_check check (weight >= 0 and weight <= 100),
  constraint project_phases_status_check check (
    status in ('pending', 'in_progress', 'completed')
  )
);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  action_type text not null,
  reference_id text,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_name_snapshot text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint activity_log_action_type_not_blank check (length(trim(action_type)) > 0)
);

create table if not exists public.project_public_profiles (
  project_id uuid primary key references public.projects(id) on delete cascade,
  public_title text,
  summary text,
  city text,
  region text,
  category text,
  hero_media_id uuid references public.media(id) on delete set null,
  hero_comment text,
  contact_email citext,
  contact_phone text,
  website_url text,
  highlights_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.public_project_likes (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table if not exists public.public_project_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  status text not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint public_project_comments_status_check check (
    status in ('visible', 'hidden', 'removed')
  ),
  constraint public_project_comments_body_check check (
    char_length(trim(body)) between 1 and 1000
  )
);

create table if not exists public.public_media_posts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  media_id uuid not null references public.media(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  caption text,
  published_by_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint public_media_posts_status_check check (
    status in ('published', 'unpublished', 'removed')
  ),
  constraint public_media_posts_caption_length_check check (
    caption is null or char_length(caption) <= 1000
  )
);

create unique index if not exists idx_organizations_slug_unique
  on public.organizations (lower(slug))
  where slug is not null and length(trim(slug)) > 0;

create unique index if not exists idx_organization_members_org_user_unique
  on public.organization_members (organization_id, user_id)
  where user_id is not null;

create unique index if not exists idx_organization_members_org_email_unique
  on public.organization_members (organization_id, invited_email)
  where invited_email is not null and status in ('invited', 'active');

create unique index if not exists idx_projects_public_slug_unique
  on public.projects (lower(public_slug))
  where public_slug is not null and length(trim(public_slug)) > 0;

create unique index if not exists idx_project_members_project_user_unique
  on public.project_members (project_id, user_id)
  where user_id is not null;

create unique index if not exists idx_project_members_project_email_unique
  on public.project_members (project_id, invited_email)
  where invited_email is not null and status in ('invited', 'active');

create unique index if not exists idx_public_media_posts_media_published_unique
  on public.public_media_posts (media_id)
  where status = 'published';

create index if not exists idx_organizations_owner on public.organizations (owner_user_id);
create index if not exists idx_organization_members_org_status on public.organization_members (organization_id, status);
create index if not exists idx_organization_members_user_status on public.organization_members (user_id, status);

create index if not exists idx_projects_owner on public.projects (owner_user_id);
create index if not exists idx_projects_org on public.projects (organization_id);
create index if not exists idx_projects_visibility_updated on public.projects (visibility, public_updated_at desc);
create index if not exists idx_projects_updated_at on public.projects (updated_at desc);

create index if not exists idx_project_members_project_status on public.project_members (project_id, status);
create index if not exists idx_project_members_user_status on public.project_members (user_id, status);

create index if not exists idx_folders_project_created on public.folders (project_id, created_at desc);
create index if not exists idx_media_project_created on public.media (project_id, created_at desc);
create index if not exists idx_media_project_type_created on public.media (project_id, type, created_at desc);
create index if not exists idx_media_folder_created on public.media (folder_id, created_at desc);
create index if not exists idx_media_uploaded_by on public.media (uploaded_by_user_id, created_at desc);

create index if not exists idx_notes_project_created on public.notes (project_id, created_at desc);
create index if not exists idx_notes_media on public.notes (media_id);

create index if not exists idx_project_phases_project_status on public.project_phases (project_id, status);
create index if not exists idx_activity_log_project_created on public.activity_log (project_id, created_at desc);
create index if not exists idx_activity_log_actor_created on public.activity_log (actor_user_id, created_at desc);

create index if not exists idx_project_public_profiles_project on public.project_public_profiles (project_id);

create index if not exists idx_public_project_comments_project_status_created
  on public.public_project_comments (project_id, status, created_at desc);
create index if not exists idx_public_project_comments_user_created
  on public.public_project_comments (user_id, created_at desc);

create index if not exists idx_public_media_posts_status_published_at
  on public.public_media_posts (status, published_at desc);
create index if not exists idx_public_media_posts_project_status
  on public.public_media_posts (project_id, status, published_at desc);

create or replace function public.ensure_organization_owner_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.organization_members (
    id,
    organization_id,
    user_id,
    invited_email,
    role,
    status,
    invited_by,
    created_at,
    updated_at,
    accepted_at
  )
  select
    gen_random_uuid(),
    new.id,
    new.owner_user_id,
    null,
    'owner',
    'active',
    new.owner_user_id,
    now(),
    now(),
    now()
  where not exists (
    select 1
    from public.organization_members om
    where om.organization_id = new.id
      and om.user_id = new.owner_user_id
      and om.status <> 'removed'
  );

  return new;
end;
$$;

create or replace function public.ensure_project_owner_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.project_members (
    id,
    project_id,
    user_id,
    invited_email,
    role,
    status,
    invited_by,
    user_name_snapshot,
    user_email_snapshot,
    created_at,
    updated_at,
    accepted_at
  )
  select
    gen_random_uuid(),
    new.id,
    new.owner_user_id,
    null,
    'owner',
    'active',
    new.owner_user_id,
    null,
    (
      select u.email
      from auth.users u
      where u.id = new.owner_user_id
      limit 1
    ),
    now(),
    now(),
    now()
  where not exists (
    select 1
    from public.project_members pm
    where pm.project_id = new.id
      and pm.user_id = new.owner_user_id
      and pm.status <> 'removed'
  );

  return new;
end;
$$;

create or replace function public.validate_project_public_profile_media()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hero_project_id uuid;
begin
  if new.hero_media_id is null then
    return new;
  end if;

  select m.project_id
  into hero_project_id
  from public.media m
  where m.id = new.hero_media_id;

  if hero_project_id is null then
    raise exception 'Hero media % not found', new.hero_media_id;
  end if;

  if hero_project_id <> new.project_id then
    raise exception 'hero_media_id must belong to the same project';
  end if;

  return new;
end;
$$;

create or replace function public.validate_public_media_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_project_id uuid;
  resolved_organization_id uuid;
begin
  select m.project_id
  into resolved_project_id
  from public.media m
  where m.id = new.media_id;

  if resolved_project_id is null then
    raise exception 'Media % not found', new.media_id;
  end if;

  if new.project_id <> resolved_project_id then
    raise exception 'media_id must belong to project_id';
  end if;

  if new.organization_id is null then
    select p.organization_id
    into resolved_organization_id
    from public.projects p
    where p.id = new.project_id;
    new.organization_id := resolved_organization_id;
  end if;

  if new.published_by_user_id is null then
    new.published_by_user_id := auth.uid();
  end if;

  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  elsif new.status <> 'published' then
    new.published_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_organizations_set_updated_at on public.organizations;
create trigger trg_organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

drop trigger if exists trg_organization_members_set_updated_at on public.organization_members;
create trigger trg_organization_members_set_updated_at
before update on public.organization_members
for each row execute function public.set_updated_at();

drop trigger if exists trg_projects_set_updated_at on public.projects;
create trigger trg_projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

drop trigger if exists trg_project_members_set_updated_at on public.project_members;
create trigger trg_project_members_set_updated_at
before update on public.project_members
for each row execute function public.set_updated_at();

drop trigger if exists trg_folders_set_updated_at on public.folders;
create trigger trg_folders_set_updated_at
before update on public.folders
for each row execute function public.set_updated_at();

drop trigger if exists trg_media_set_updated_at on public.media;
create trigger trg_media_set_updated_at
before update on public.media
for each row execute function public.set_updated_at();

drop trigger if exists trg_notes_set_updated_at on public.notes;
create trigger trg_notes_set_updated_at
before update on public.notes
for each row execute function public.set_updated_at();

drop trigger if exists trg_project_phases_set_updated_at on public.project_phases;
create trigger trg_project_phases_set_updated_at
before update on public.project_phases
for each row execute function public.set_updated_at();

drop trigger if exists trg_project_public_profiles_set_updated_at on public.project_public_profiles;
create trigger trg_project_public_profiles_set_updated_at
before update on public.project_public_profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_public_project_comments_set_updated_at on public.public_project_comments;
create trigger trg_public_project_comments_set_updated_at
before update on public.public_project_comments
for each row execute function public.set_updated_at();

drop trigger if exists trg_public_media_posts_set_updated_at on public.public_media_posts;
create trigger trg_public_media_posts_set_updated_at
before update on public.public_media_posts
for each row execute function public.set_updated_at();

drop trigger if exists trg_ensure_org_owner_member on public.organizations;
create trigger trg_ensure_org_owner_member
after insert on public.organizations
for each row execute function public.ensure_organization_owner_member();

drop trigger if exists trg_ensure_project_owner_member on public.projects;
create trigger trg_ensure_project_owner_member
after insert on public.projects
for each row execute function public.ensure_project_owner_member();

drop trigger if exists trg_validate_project_public_profile_media on public.project_public_profiles;
create trigger trg_validate_project_public_profile_media
before insert or update on public.project_public_profiles
for each row execute function public.validate_project_public_profile_media();

drop trigger if exists trg_validate_public_media_post on public.public_media_posts;
create trigger trg_validate_public_media_post
before insert or update on public.public_media_posts
for each row execute function public.validate_public_media_post();

create or replace function public.is_org_member(
  p_organization_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = p_user_id
      and om.status = 'active'
  );
$$;

create or replace function public.has_org_role(
  p_organization_id uuid,
  p_roles text[],
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = p_user_id
      and om.status = 'active'
      and om.role = any(p_roles)
  );
$$;

create or replace function public.is_project_owner(
  p_project_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and p.owner_user_id = p_user_id
  );
$$;

create or replace function public.is_project_member(
  p_project_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_project_owner(p_project_id, p_user_id)
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = p_project_id
        and pm.user_id = p_user_id
        and pm.status = 'active'
    );
$$;

create or replace function public.has_project_role(
  p_project_id uuid,
  p_roles text[],
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (
      array_position(p_roles, 'owner') is not null
      and public.is_project_owner(p_project_id, p_user_id)
    )
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = p_project_id
        and pm.user_id = p_user_id
        and pm.status = 'active'
        and pm.role = any(p_roles)
    );
$$;

grant execute on function public.is_org_member(uuid, uuid) to authenticated, anon;
grant execute on function public.has_org_role(uuid, text[], uuid) to authenticated;
grant execute on function public.is_project_owner(uuid, uuid) to authenticated;
grant execute on function public.is_project_member(uuid, uuid) to authenticated, anon;
grant execute on function public.has_project_role(uuid, text[], uuid) to authenticated;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.folders enable row level security;
alter table public.media enable row level security;
alter table public.notes enable row level security;
alter table public.project_phases enable row level security;
alter table public.activity_log enable row level security;
alter table public.project_public_profiles enable row level security;
alter table public.public_project_likes enable row level security;
alter table public.public_project_comments enable row level security;
alter table public.public_media_posts enable row level security;

drop policy if exists organizations_select_member on public.organizations;
drop policy if exists organizations_insert_owner on public.organizations;
drop policy if exists organizations_update_owner on public.organizations;
drop policy if exists organizations_delete_owner on public.organizations;

create policy organizations_select_member
on public.organizations
for select
to authenticated
using (public.is_org_member(id));

create policy organizations_insert_owner
on public.organizations
for insert
to authenticated
with check (owner_user_id = auth.uid());

create policy organizations_update_owner
on public.organizations
for update
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

create policy organizations_delete_owner
on public.organizations
for delete
to authenticated
using (owner_user_id = auth.uid());

drop policy if exists organization_members_select_member_or_invitee on public.organization_members;
drop policy if exists organization_members_insert_admin on public.organization_members;
drop policy if exists organization_members_update_admin on public.organization_members;
drop policy if exists organization_members_delete_admin on public.organization_members;

create policy organization_members_select_member_or_invitee
on public.organization_members
for select
to authenticated
using (
  public.is_org_member(organization_id)
  or (
    invited_email is not null
    and lower(invited_email::text) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

create policy organization_members_insert_admin
on public.organization_members
for insert
to authenticated
with check (public.has_org_role(organization_id, array['owner', 'admin']));

create policy organization_members_update_admin
on public.organization_members
for update
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin']))
with check (public.has_org_role(organization_id, array['owner', 'admin']));

create policy organization_members_delete_admin
on public.organization_members
for delete
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin']));

drop policy if exists projects_select_public on public.projects;
drop policy if exists projects_select_member on public.projects;
drop policy if exists projects_insert_owner on public.projects;
drop policy if exists projects_update_manager on public.projects;
drop policy if exists projects_delete_owner on public.projects;

create policy projects_select_public
on public.projects
for select
to anon, authenticated
using (visibility = 'public');

create policy projects_select_member
on public.projects
for select
to authenticated
using (public.is_project_member(id));

create policy projects_insert_owner
on public.projects
for insert
to authenticated
with check (
  owner_user_id = auth.uid()
  and (
    organization_id is null
    or public.is_org_member(organization_id)
  )
);

create policy projects_update_manager
on public.projects
for update
to authenticated
using (public.has_project_role(id, array['owner', 'manager']))
with check (public.has_project_role(id, array['owner', 'manager']));

create policy projects_delete_owner
on public.projects
for delete
to authenticated
using (public.is_project_owner(id));

drop policy if exists project_members_select_member on public.project_members;
drop policy if exists project_members_insert_manager on public.project_members;
drop policy if exists project_members_update_manager on public.project_members;
drop policy if exists project_members_delete_manager on public.project_members;

create policy project_members_select_member
on public.project_members
for select
to authenticated
using (public.is_project_member(project_id));

create policy project_members_insert_manager
on public.project_members
for insert
to authenticated
with check (public.has_project_role(project_id, array['owner', 'manager']));

create policy project_members_update_manager
on public.project_members
for update
to authenticated
using (public.has_project_role(project_id, array['owner', 'manager']))
with check (public.has_project_role(project_id, array['owner', 'manager']));

create policy project_members_delete_manager
on public.project_members
for delete
to authenticated
using (public.has_project_role(project_id, array['owner', 'manager']));

drop policy if exists folders_select_member on public.folders;
drop policy if exists folders_insert_member on public.folders;
drop policy if exists folders_update_member on public.folders;
drop policy if exists folders_delete_member on public.folders;

create policy folders_select_member
on public.folders
for select
to authenticated
using (public.is_project_member(project_id));

create policy folders_insert_member
on public.folders
for insert
to authenticated
with check (public.is_project_member(project_id));

create policy folders_update_member
on public.folders
for update
to authenticated
using (public.is_project_member(project_id))
with check (public.is_project_member(project_id));

create policy folders_delete_member
on public.folders
for delete
to authenticated
using (public.is_project_member(project_id));

drop policy if exists media_select_member on public.media;
drop policy if exists media_select_public on public.media;
drop policy if exists media_insert_member on public.media;
drop policy if exists media_update_member on public.media;
drop policy if exists media_delete_member on public.media;

create policy media_select_member
on public.media
for select
to authenticated
using (public.is_project_member(project_id));

create policy media_select_public
on public.media
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.public_media_posts pmp
    where pmp.media_id = media.id
      and pmp.status = 'published'
  )
  or exists (
    select 1
    from public.projects p
    where p.id = media.project_id
      and p.visibility = 'public'
  )
);

create policy media_insert_member
on public.media
for insert
to authenticated
with check (
  public.is_project_member(project_id)
  and (
    uploaded_by_user_id is null
    or uploaded_by_user_id = auth.uid()
  )
);

create policy media_update_member
on public.media
for update
to authenticated
using (public.is_project_member(project_id))
with check (public.is_project_member(project_id));

create policy media_delete_member
on public.media
for delete
to authenticated
using (public.is_project_member(project_id));

drop policy if exists notes_select_member on public.notes;
drop policy if exists notes_insert_member on public.notes;
drop policy if exists notes_update_member on public.notes;
drop policy if exists notes_delete_member on public.notes;

create policy notes_select_member
on public.notes
for select
to authenticated
using (public.is_project_member(project_id));

create policy notes_insert_member
on public.notes
for insert
to authenticated
with check (
  public.is_project_member(project_id)
  and (
    author_user_id is null
    or author_user_id = auth.uid()
  )
);

create policy notes_update_member
on public.notes
for update
to authenticated
using (public.is_project_member(project_id))
with check (public.is_project_member(project_id));

create policy notes_delete_member
on public.notes
for delete
to authenticated
using (public.is_project_member(project_id));

drop policy if exists project_phases_select_member on public.project_phases;
drop policy if exists project_phases_insert_manager on public.project_phases;
drop policy if exists project_phases_update_manager on public.project_phases;
drop policy if exists project_phases_delete_manager on public.project_phases;

create policy project_phases_select_member
on public.project_phases
for select
to authenticated
using (public.is_project_member(project_id));

create policy project_phases_insert_manager
on public.project_phases
for insert
to authenticated
with check (public.has_project_role(project_id, array['owner', 'manager']));

create policy project_phases_update_manager
on public.project_phases
for update
to authenticated
using (public.has_project_role(project_id, array['owner', 'manager']))
with check (public.has_project_role(project_id, array['owner', 'manager']));

create policy project_phases_delete_manager
on public.project_phases
for delete
to authenticated
using (public.has_project_role(project_id, array['owner', 'manager']));

drop policy if exists activity_log_select_member on public.activity_log;
drop policy if exists activity_log_insert_member on public.activity_log;
drop policy if exists activity_log_update_manager on public.activity_log;
drop policy if exists activity_log_delete_manager on public.activity_log;

create policy activity_log_select_member
on public.activity_log
for select
to authenticated
using (public.is_project_member(project_id));

create policy activity_log_insert_member
on public.activity_log
for insert
to authenticated
with check (
  public.is_project_member(project_id)
  and (
    actor_user_id is null
    or actor_user_id = auth.uid()
  )
);

create policy activity_log_update_manager
on public.activity_log
for update
to authenticated
using (public.has_project_role(project_id, array['owner', 'manager']))
with check (public.has_project_role(project_id, array['owner', 'manager']));

create policy activity_log_delete_manager
on public.activity_log
for delete
to authenticated
using (public.has_project_role(project_id, array['owner', 'manager']));

drop policy if exists project_public_profiles_select_public on public.project_public_profiles;
drop policy if exists project_public_profiles_select_member on public.project_public_profiles;
drop policy if exists project_public_profiles_insert_manager on public.project_public_profiles;
drop policy if exists project_public_profiles_update_manager on public.project_public_profiles;
drop policy if exists project_public_profiles_delete_manager on public.project_public_profiles;

create policy project_public_profiles_select_public
on public.project_public_profiles
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_public_profiles.project_id
      and p.visibility = 'public'
  )
);

create policy project_public_profiles_select_member
on public.project_public_profiles
for select
to authenticated
using (public.is_project_member(project_id));

create policy project_public_profiles_insert_manager
on public.project_public_profiles
for insert
to authenticated
with check (public.has_project_role(project_id, array['owner', 'manager']));

create policy project_public_profiles_update_manager
on public.project_public_profiles
for update
to authenticated
using (public.has_project_role(project_id, array['owner', 'manager']))
with check (public.has_project_role(project_id, array['owner', 'manager']));

create policy project_public_profiles_delete_manager
on public.project_public_profiles
for delete
to authenticated
using (public.has_project_role(project_id, array['owner', 'manager']));

drop policy if exists public_project_likes_select_public on public.public_project_likes;
drop policy if exists public_project_likes_insert_self on public.public_project_likes;
drop policy if exists public_project_likes_delete_self on public.public_project_likes;

create policy public_project_likes_select_public
on public.public_project_likes
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.projects p
    where p.id = public_project_likes.project_id
      and p.visibility = 'public'
  )
);

create policy public_project_likes_insert_self
on public.public_project_likes
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.projects p
    where p.id = public_project_likes.project_id
      and p.visibility = 'public'
  )
);

create policy public_project_likes_delete_self
on public.public_project_likes
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.has_project_role(project_id, array['owner', 'manager'])
);

drop policy if exists public_project_comments_select_public on public.public_project_comments;
drop policy if exists public_project_comments_select_manager on public.public_project_comments;
drop policy if exists public_project_comments_insert_self on public.public_project_comments;
drop policy if exists public_project_comments_update_self on public.public_project_comments;
drop policy if exists public_project_comments_update_manager on public.public_project_comments;
drop policy if exists public_project_comments_delete_self on public.public_project_comments;
drop policy if exists public_project_comments_delete_manager on public.public_project_comments;

create policy public_project_comments_select_public
on public.public_project_comments
for select
to anon, authenticated
using (
  status = 'visible'
  and exists (
    select 1
    from public.projects p
    where p.id = public_project_comments.project_id
      and p.visibility = 'public'
  )
);

create policy public_project_comments_select_manager
on public.public_project_comments
for select
to authenticated
using (public.has_project_role(project_id, array['owner', 'manager']));

create policy public_project_comments_insert_self
on public.public_project_comments
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.projects p
    where p.id = public_project_comments.project_id
      and p.visibility = 'public'
  )
);

create policy public_project_comments_update_self
on public.public_project_comments
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy public_project_comments_update_manager
on public.public_project_comments
for update
to authenticated
using (public.has_project_role(project_id, array['owner', 'manager']))
with check (public.has_project_role(project_id, array['owner', 'manager']));

create policy public_project_comments_delete_self
on public.public_project_comments
for delete
to authenticated
using (user_id = auth.uid());

create policy public_project_comments_delete_manager
on public.public_project_comments
for delete
to authenticated
using (public.has_project_role(project_id, array['owner', 'manager']));

drop policy if exists public_media_posts_select_public on public.public_media_posts;
drop policy if exists public_media_posts_select_member on public.public_media_posts;
drop policy if exists public_media_posts_insert_manager on public.public_media_posts;
drop policy if exists public_media_posts_update_manager on public.public_media_posts;
drop policy if exists public_media_posts_delete_manager on public.public_media_posts;

create policy public_media_posts_select_public
on public.public_media_posts
for select
to anon, authenticated
using (status = 'published');

create policy public_media_posts_select_member
on public.public_media_posts
for select
to authenticated
using (public.is_project_member(project_id));

create policy public_media_posts_insert_manager
on public.public_media_posts
for insert
to authenticated
with check (
  public.has_project_role(project_id, array['owner', 'manager'])
  and (
    published_by_user_id is null
    or published_by_user_id = auth.uid()
  )
);

create policy public_media_posts_update_manager
on public.public_media_posts
for update
to authenticated
using (public.has_project_role(project_id, array['owner', 'manager']))
with check (public.has_project_role(project_id, array['owner', 'manager']));

create policy public_media_posts_delete_manager
on public.public_media_posts
for delete
to authenticated
using (public.has_project_role(project_id, array['owner', 'manager']));
