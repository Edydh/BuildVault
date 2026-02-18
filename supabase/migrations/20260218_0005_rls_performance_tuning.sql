-- BuildVault: RLS performance tuning for Supabase Performance Advisor
-- Date: 2026-02-18
--
-- Goals:
-- 1) Use init-plan friendly auth calls: (select auth.uid()) / (select auth.jwt()).
-- 2) Consolidate overlapping authenticated select policies where possible.

-- Organizations
drop policy if exists organizations_select_member on public.organizations;
drop policy if exists organizations_insert_owner on public.organizations;
drop policy if exists organizations_update_owner on public.organizations;
drop policy if exists organizations_delete_owner on public.organizations;

create policy organizations_select_member
on public.organizations
for select
to authenticated
using (
  public.is_org_member(id, (select auth.uid()))
  or exists (
    select 1
    from public.organization_members om
    where om.organization_id = organizations.id
      and om.status = 'invited'
      and om.invited_email is not null
      and lower(om.invited_email::text) = (select lower(coalesce(auth.jwt() ->> 'email', '')))
  )
);

create policy organizations_insert_owner
on public.organizations
for insert
to authenticated
with check (owner_user_id = (select auth.uid()));

create policy organizations_update_owner
on public.organizations
for update
to authenticated
using (owner_user_id = (select auth.uid()))
with check (owner_user_id = (select auth.uid()));

create policy organizations_delete_owner
on public.organizations
for delete
to authenticated
using (owner_user_id = (select auth.uid()));

-- Organization members
drop policy if exists organization_members_select_member_or_invitee on public.organization_members;
drop policy if exists organization_members_insert_admin on public.organization_members;
drop policy if exists organization_members_update_admin on public.organization_members;
drop policy if exists organization_members_update_invitee_accept on public.organization_members;
drop policy if exists organization_members_delete_admin on public.organization_members;

create policy organization_members_select_member_or_invitee
on public.organization_members
for select
to authenticated
using (
  public.is_org_member(organization_id, (select auth.uid()))
  or (
    invited_email is not null
    and lower(invited_email::text) = (select lower(coalesce(auth.jwt() ->> 'email', '')))
  )
);

create policy organization_members_insert_admin
on public.organization_members
for insert
to authenticated
with check (public.has_org_role(organization_id, array['owner', 'admin'], (select auth.uid())));

create policy organization_members_update_admin
on public.organization_members
for update
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin'], (select auth.uid())))
with check (public.has_org_role(organization_id, array['owner', 'admin'], (select auth.uid())));

-- Keep a dedicated invitee acceptance path; this may still appear as a "multiple permissive policies"
-- warning, but preserves strict acceptance semantics.
create policy organization_members_update_invitee_accept
on public.organization_members
for update
to authenticated
using (
  status = 'invited'
  and invited_email is not null
  and lower(invited_email::text) = (select lower(coalesce(auth.jwt() ->> 'email', '')))
)
with check (
  user_id = (select auth.uid())
  and status = 'active'
  and invited_email is not null
  and lower(invited_email::text) = (select lower(coalesce(auth.jwt() ->> 'email', '')))
);

create policy organization_members_delete_admin
on public.organization_members
for delete
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin'], (select auth.uid())));

-- Projects
drop policy if exists projects_select_public on public.projects;
drop policy if exists projects_select_member on public.projects;
drop policy if exists projects_select_public_anon on public.projects;
drop policy if exists projects_select_authenticated on public.projects;
drop policy if exists projects_insert_owner on public.projects;
drop policy if exists projects_update_manager on public.projects;
drop policy if exists projects_delete_owner on public.projects;

create policy projects_select_public_anon
on public.projects
for select
to anon
using (visibility = 'public');

create policy projects_select_authenticated
on public.projects
for select
to authenticated
using (
  visibility = 'public'
  or public.is_project_member(id, (select auth.uid()))
);

create policy projects_insert_owner
on public.projects
for insert
to authenticated
with check (
  owner_user_id = (select auth.uid())
  and (
    organization_id is null
    or public.is_org_member(organization_id, (select auth.uid()))
  )
);

create policy projects_update_manager
on public.projects
for update
to authenticated
using (public.has_project_role(id, array['owner', 'manager'], (select auth.uid())))
with check (public.has_project_role(id, array['owner', 'manager'], (select auth.uid())));

create policy projects_delete_owner
on public.projects
for delete
to authenticated
using (public.is_project_owner(id, (select auth.uid())));

-- Media
drop policy if exists media_select_member on public.media;
drop policy if exists media_select_public on public.media;
drop policy if exists media_select_public_anon on public.media;
drop policy if exists media_select_authenticated on public.media;
drop policy if exists media_insert_member on public.media;
drop policy if exists media_update_member on public.media;
drop policy if exists media_delete_member on public.media;

create policy media_select_public_anon
on public.media
for select
to anon
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

create policy media_select_authenticated
on public.media
for select
to authenticated
using (
  public.is_project_member(project_id, (select auth.uid()))
  or exists (
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
  public.is_project_member(project_id, (select auth.uid()))
  and (
    uploaded_by_user_id is null
    or uploaded_by_user_id = (select auth.uid())
  )
);

create policy media_update_member
on public.media
for update
to authenticated
using (public.is_project_member(project_id, (select auth.uid())))
with check (public.is_project_member(project_id, (select auth.uid())));

create policy media_delete_member
on public.media
for delete
to authenticated
using (public.is_project_member(project_id, (select auth.uid())));

-- Notes
drop policy if exists notes_select_member on public.notes;
drop policy if exists notes_insert_member on public.notes;
drop policy if exists notes_update_member on public.notes;
drop policy if exists notes_delete_member on public.notes;

create policy notes_select_member
on public.notes
for select
to authenticated
using (public.is_project_member(project_id, (select auth.uid())));

create policy notes_insert_member
on public.notes
for insert
to authenticated
with check (
  public.is_project_member(project_id, (select auth.uid()))
  and (
    author_user_id is null
    or author_user_id = (select auth.uid())
  )
);

create policy notes_update_member
on public.notes
for update
to authenticated
using (public.is_project_member(project_id, (select auth.uid())))
with check (public.is_project_member(project_id, (select auth.uid())));

create policy notes_delete_member
on public.notes
for delete
to authenticated
using (public.is_project_member(project_id, (select auth.uid())));

-- Activity log
drop policy if exists activity_log_select_member on public.activity_log;
drop policy if exists activity_log_insert_member on public.activity_log;
drop policy if exists activity_log_update_manager on public.activity_log;
drop policy if exists activity_log_delete_manager on public.activity_log;

create policy activity_log_select_member
on public.activity_log
for select
to authenticated
using (public.is_project_member(project_id, (select auth.uid())));

create policy activity_log_insert_member
on public.activity_log
for insert
to authenticated
with check (
  public.is_project_member(project_id, (select auth.uid()))
  and (
    actor_user_id is null
    or actor_user_id = (select auth.uid())
  )
);

create policy activity_log_update_manager
on public.activity_log
for update
to authenticated
using (public.has_project_role(project_id, array['owner', 'manager'], (select auth.uid())))
with check (public.has_project_role(project_id, array['owner', 'manager'], (select auth.uid())));

create policy activity_log_delete_manager
on public.activity_log
for delete
to authenticated
using (public.has_project_role(project_id, array['owner', 'manager'], (select auth.uid())));

-- Project public profiles
drop policy if exists project_public_profiles_select_public on public.project_public_profiles;
drop policy if exists project_public_profiles_select_member on public.project_public_profiles;
drop policy if exists project_public_profiles_select_public_anon on public.project_public_profiles;
drop policy if exists project_public_profiles_select_authenticated on public.project_public_profiles;
drop policy if exists project_public_profiles_insert_manager on public.project_public_profiles;
drop policy if exists project_public_profiles_update_manager on public.project_public_profiles;
drop policy if exists project_public_profiles_delete_manager on public.project_public_profiles;

create policy project_public_profiles_select_public_anon
on public.project_public_profiles
for select
to anon
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_public_profiles.project_id
      and p.visibility = 'public'
  )
);

create policy project_public_profiles_select_authenticated
on public.project_public_profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_public_profiles.project_id
      and p.visibility = 'public'
  )
  or public.is_project_member(project_id, (select auth.uid()))
);

create policy project_public_profiles_insert_manager
on public.project_public_profiles
for insert
to authenticated
with check (public.has_project_role(project_id, array['owner', 'manager'], (select auth.uid())));

create policy project_public_profiles_update_manager
on public.project_public_profiles
for update
to authenticated
using (public.has_project_role(project_id, array['owner', 'manager'], (select auth.uid())))
with check (public.has_project_role(project_id, array['owner', 'manager'], (select auth.uid())));

create policy project_public_profiles_delete_manager
on public.project_public_profiles
for delete
to authenticated
using (public.has_project_role(project_id, array['owner', 'manager'], (select auth.uid())));

-- Public project likes
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
  user_id = (select auth.uid())
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
  user_id = (select auth.uid())
  or public.has_project_role(project_id, array['owner', 'manager'], (select auth.uid()))
);

-- Public project comments
drop policy if exists public_project_comments_select_public on public.public_project_comments;
drop policy if exists public_project_comments_select_manager on public.public_project_comments;
drop policy if exists public_project_comments_select_public_anon on public.public_project_comments;
drop policy if exists public_project_comments_select_authenticated on public.public_project_comments;
drop policy if exists public_project_comments_insert_self on public.public_project_comments;
drop policy if exists public_project_comments_update_self on public.public_project_comments;
drop policy if exists public_project_comments_update_manager on public.public_project_comments;
drop policy if exists public_project_comments_delete_self on public.public_project_comments;
drop policy if exists public_project_comments_delete_manager on public.public_project_comments;

create policy public_project_comments_select_public_anon
on public.public_project_comments
for select
to anon
using (
  status = 'visible'
  and exists (
    select 1
    from public.projects p
    where p.id = public_project_comments.project_id
      and p.visibility = 'public'
  )
);

create policy public_project_comments_select_authenticated
on public.public_project_comments
for select
to authenticated
using (
  (
    status = 'visible'
    and exists (
      select 1
      from public.projects p
      where p.id = public_project_comments.project_id
        and p.visibility = 'public'
    )
  )
  or public.has_project_role(project_id, array['owner', 'manager'], (select auth.uid()))
);

create policy public_project_comments_insert_self
on public.public_project_comments
for insert
to authenticated
with check (
  user_id = (select auth.uid())
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
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy public_project_comments_update_manager
on public.public_project_comments
for update
to authenticated
using (public.has_project_role(project_id, array['owner', 'manager'], (select auth.uid())))
with check (public.has_project_role(project_id, array['owner', 'manager'], (select auth.uid())));

create policy public_project_comments_delete_self
on public.public_project_comments
for delete
to authenticated
using (user_id = (select auth.uid()));

create policy public_project_comments_delete_manager
on public.public_project_comments
for delete
to authenticated
using (public.has_project_role(project_id, array['owner', 'manager'], (select auth.uid())));

-- Public media posts
drop policy if exists public_media_posts_select_public on public.public_media_posts;
drop policy if exists public_media_posts_select_member on public.public_media_posts;
drop policy if exists public_media_posts_select_public_anon on public.public_media_posts;
drop policy if exists public_media_posts_select_authenticated on public.public_media_posts;
drop policy if exists public_media_posts_insert_manager on public.public_media_posts;
drop policy if exists public_media_posts_update_manager on public.public_media_posts;
drop policy if exists public_media_posts_delete_manager on public.public_media_posts;

create policy public_media_posts_select_public_anon
on public.public_media_posts
for select
to anon
using (status = 'published');

create policy public_media_posts_select_authenticated
on public.public_media_posts
for select
to authenticated
using (
  status = 'published'
  or public.is_project_member(project_id, (select auth.uid()))
);

create policy public_media_posts_insert_manager
on public.public_media_posts
for insert
to authenticated
with check (
  public.has_project_role(project_id, array['owner', 'manager'], (select auth.uid()))
  and (
    published_by_user_id is null
    or published_by_user_id = (select auth.uid())
  )
);

create policy public_media_posts_update_manager
on public.public_media_posts
for update
to authenticated
using (public.has_project_role(project_id, array['owner', 'manager'], (select auth.uid())))
with check (public.has_project_role(project_id, array['owner', 'manager'], (select auth.uid())));

create policy public_media_posts_delete_manager
on public.public_media_posts
for delete
to authenticated
using (public.has_project_role(project_id, array['owner', 'manager'], (select auth.uid())));
