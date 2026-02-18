-- BuildVault: backfill indexes for foreign keys flagged by Performance Advisor
-- Date: 2026-02-18

create index if not exists idx_folders_created_by_user
  on public.folders (created_by_user_id);

create index if not exists idx_notes_author_user
  on public.notes (author_user_id);

create index if not exists idx_organization_members_invited_by
  on public.organization_members (invited_by);

create index if not exists idx_project_members_invited_by
  on public.project_members (invited_by);

create index if not exists idx_project_phases_created_by_user
  on public.project_phases (created_by_user_id);

create index if not exists idx_project_public_profiles_hero_media
  on public.project_public_profiles (hero_media_id);

create index if not exists idx_public_media_posts_organization
  on public.public_media_posts (organization_id);

create index if not exists idx_public_media_posts_published_by_user
  on public.public_media_posts (published_by_user_id);

create index if not exists idx_public_project_likes_user
  on public.public_project_likes (user_id);
