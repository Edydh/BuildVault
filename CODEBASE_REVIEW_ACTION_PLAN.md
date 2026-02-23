# BuildVault Action Plan (Stabilize + Rebuild)

Date: 2026-02-14 (updated 2026-02-23)
Scope: Expo React Native app (`app/`, `lib/`, `components/`)
Inputs: codebase review + UI wireframe blueprint + SQLite target model + Figma token JSON

## Product direction (agreed)

BuildVault should feel like “Apple Notes for construction media”:
- Fast capture and retrieval
- Offline-first
- Minimal UI clutter
- Large touch targets and thumb-first actions
- Project-centric structure with evidence-grade history
- Collaboration-ready: owner invites coworkers/clients into project workspaces

## Current Status (2026-02-18)

Completed in codebase:
- [x] Supabase collaboration schema and RLS baseline are in place (projects, members, activity, public profile, likes/comments, public media posts).
- [x] Supabase storage sync for media binaries is live:
  - upload on media create
  - remote URL persistence
  - backfill support when original local file still exists
  - remote-aware delete/share paths in project media screens
- [x] Public profile save/publish/unpublish now writes to Supabase (not local-only).
- [x] Feed auto-sync behavior is active for media:
  - new media in public projects auto-publishes to `public_media_posts`
  - publishing a project backfills existing media posts
  - unpublishing marks project media posts as `unpublished`
- [x] Public Profile UI now shows a sync status summary (how many media posts were synced/hidden).

Open constraints:
- [ ] Web runtime remains deferred; mobile-first path is the active scope.
- [ ] Feed rendering still reads local cache/query state; reliability depends on sync paths being invoked from app flows.

## Next Priority Sequence (updated)

1. Organization member management in Settings (invite, list, role change, remove, accept invite).
2. Activity assignment flow wired to real members:
   - picker from active project members
   - optional "add to project + assign" from organization roster.
3. Project completion controls:
   - explicit mark completed/reopen action
   - progress breakdown panel tied to phase/activity model.
4. Feed engagement (likes/comments) stabilization after collaboration flows are complete.

## Track A: Stabilization (must do before visual rebuild)

### A0.1 Data isolation by user
- Add `user_id` to `projects`, `media`, `folders`, `notes`, `activity_log`.
- Scope all reads/writes by active user.
- Decide sign-out policy explicitly (partitioned local data vs clear local data).

### A0.2 File handling correctness
- Fix document share MIME/UTI handling (currently photo/video-first).
- Unify media + image variants into one filesystem root under `buildvault/`.
- Add cleanup migration for legacy variant directories.

### A0.3 Runtime reliability fixes
- Replace `Date.now().toString()` IDs with UUIDs.
- Fix empty media-type filter behavior (all toggles off should return zero items).
- Persist regenerated video thumbnails in DB.
- Normalize auth provider mapping for UI/account consistency.
- Handle Apple sign-in non-cancel failures with user-visible feedback.
- Implement real “Never show again” behavior in note prompts.

### A0.4 Access control
- Add route guard for non-tab protected routes (`/project/*`).
- Ensure deep links cannot bypass auth.

### A0.5 Supabase migration prep
- Refactor direct SQLite access behind repository interfaces (`ProjectRepo`, `MediaRepo`, `NotesRepo`).
- Keep SQLite as offline cache abstraction so cloud sync can be introduced without screen rewrites.
- Define sync queue contract now (`pending_mutations`, `last_synced_at`) even before backend rollout.

## Track B: Rebuild architecture (UI + data v2)

### B1 Navigation and screen architecture

Target route shape:

```text
app/
  _layout.tsx
  (auth)/
    sign-in.tsx
  (tabs)/
    _layout.tsx
    index.tsx
    settings.tsx
  project/
    [projectId]/
      index.tsx
      capture.tsx
      gallery.tsx
      notes.tsx
      share.tsx
```

Screen priorities:
1. Projects Dashboard
2. Project Overview (quick actions above fold)
3. Capture (single-purpose, zero clutter)
4. Gallery (high-performance grid + multi-select)
5. Notes
6. Share (sheet/modal flow)

### B2 Design system implementation (from Figma tokens)

Create tokenized theme layer (`lib/theme/tokens.ts` + `components/ui/*`) with:
- Brand colors:
  - `primary: #1C3F94`
  - `primaryLight: #3A63F3`
- Neutrals:
  - `900: #0F172A`, `700: #334155`, `400: #94A3B8`, `100: #F1F5F9`
- Semantic:
  - `success: #16A34A`, `warning: #F59E0B`, `danger: #DC2626`
- Glass surface:
  - `rgba(255,255,255,0.08)`
- Spacing scale:
  - `4/8/12/16/20/24/32/40`
- Radius:
  - `sm 12`, `md 16`, `lg 20`, `pill 999`
- Blur:
  - `glass 20`, `navigation 30`
- Typography (DM Sans):
  - `headingLarge 22/28 700`
  - `headingMedium 18/24 600`
  - `bodyRegular 14/20 400`
  - `bodySmall 12/16 400`
  - `label 13/18 500`

Core components to standardize:
- `BVHeader`, `BVCard`, `BVButton`, `BVFloatingAction`
- `BVSearchBar`, `BVStatChip`, `BVEmptyState`, `BVFilterSheet`, `BVTabBar`

### B3 SQLite schema v2 (project-centric + audit-ready)

Primary tables:
- `projects`
- `media`
- `folders`
- `notes`
- `tags`
- `media_tags`
- `activity_log`
- optional later: `project_members`

Required additions for production readiness:
- `user_id` on project-owned entities
- ISO timestamps (`created_at`, `updated_at`, `taken_at`)
- evidence metadata (`latitude`, `longitude`, `duration`, `size`, `mime_type`)
- lifecycle fields (`project_type`, `status`, `cover_media_id`)

Core indexes:
- `idx_media_project`
- `idx_media_folder`
- `idx_media_taken_at`
- `idx_notes_project`
- `idx_activity_project`
- plus compound indexes for gallery filters/sorting

### B4 Interaction/UX standards (field mode)

- Minimum touch target: `48px` (preferred `56px+`)
- FAB size: `64px+`
- Horizontal screen padding: `16px`
- Card spacing: `12px`
- Section spacing: `24px`
- Project creation: target `<10s`
- Capture action reachable in 1 tap from project overview

### B4.1 UI implementation spec (from current Figma direction)

Visual improvements to apply in implementation:
- Increase secondary text contrast on cards and metadata rows.
- Use semantic status chips:
  - active = success
  - delayed = warning/danger
  - completed = neutral/success
- Add explicit progress value labels on bars.
- Normalize disabled button appearance (reduced contrast and no active shadow).
- Increase tab bar active-state contrast and safe-area spacing.
- Keep quick actions as equal-size, high-contrast tiles with icon + label.
- Add filter chips to activity/timeline views (`All`, `Media`, `Finance`, `Safety`).
- Add media-type badges and strong multi-select states in gallery cards.
- Make empty-state CTAs task-specific (avoid generic “Add Entry”).

Component-level acceptance criteria:
- `BVButton`:
  - variants `primary | secondary | ghost | danger`
  - states `default | loading | disabled`
  - minimum height `56`
- `BVCard`:
  - glass surface, rounded corners, optional press behavior
  - consistent internal padding (`16`)
- `BVHeader`:
  - title, optional subtitle, optional back button, optional right actions
- `BVFloatingAction`:
  - size `64`, anchored with safe-area awareness
- `BVSearchBar`:
  - search icon, clear action, high-contrast placeholder/text
- `BVTabBar`:
  - icon + label, active indicator, touch target >= `56`
- `BVFilterSheet`:
  - bottom-sheet style with selectable chips and apply/reset actions
- `BVEmptyState`:
  - icon, title, description, context-aware primary CTA

### B4.2 Project Card Progress Bar (tomorrow decision track)

Objective:
- Make the project card bar a true process indicator, not a manually set percentage.

Decision options:
1. Phase-based progress only:
- Use explicit project phases and completion state.
2. Activity-based progress only:
- Use weighted activity signals (media, notes, inspections, purchases, milestones).
3. Hybrid model (recommended):
- Primary progress from phase completion + bounded activity contribution for momentum.

Data requirements:
- Add `project_phases`:
  - `id`, `project_id`, `name`, `weight`, `status`, `due_date`, `completed_at`, `created_at`, `updated_at`
- Optional config table:
  - `activity_weights` (or static defaults in app layer)

Computation contract:
- `progress_percent = sum(completed phase weights) + capped(activity contribution)`
- Clamp to `0..100`
- Keep project `status` derived from process signals (recency, due dates, completion), not from manual user input.

UI contract:
- Project card bar always uses computed value.
- Display supporting text under/near bar, e.g.:
  - `67% • Structure phase complete`
- Remove/avoid direct manual editing of progress percentage in project forms after migration.

Implementation order (next session):
1. Decide model (A/B/C) and finalize formula.
2. Add schema + migration for `project_phases`.
3. Implement `computeProjectProgress(projectId)` in data/service layer.
4. Refactor project card + overview to consume computed progress only.
5. Add seed/default phase templates by project type (optional v1.1).

### B5 Supabase collaboration backend

Goal:
- Move from local-only persistence to Supabase-backed collaboration while preserving offline-first UX.

Core server tables:
- `projects` (`owner_user_id`, metadata)
- `project_members` (`project_id`, `user_id`, `role`, `status`)
- `project_invites` (`project_id`, `inviter_user_id`, `invitee_email`, `role`, `token`, `expires_at`, `status`)
- `media`, `folders`, `notes`, `activity_log` (project-scoped)

Roles:
- `owner`: manage project, invites, members, destructive actions
- `coworker`: create/edit media/notes and contribute activity
- `client`: read-only follower view (optionally comments later)

Security requirements:
- Enable RLS on all project-owned tables.
- Access requires active membership in `project_members`.
- Owner-only policies for membership and invites.
- Storage policies scoped by `project_id` path membership.

Storage and sync:
- Store media in Supabase Storage with project namespace paths.
- Keep local file cache for offline usage.
- Local-first writes enqueue mutations; background sync pushes/pulls when online.
- Conflict policy v1: server `updated_at` wins for editable fields; media rows append-only.

### B5.1 Organization membership management (add to avoid scope drift)

Settings > Organization must support:
- Create organization (owner).
- Invite members by email.
- Accept invite flow.
- Member list with role and status.
- Role update and remove member actions (owner/admin only).

Link to activities:
- Add Activity assignee picker should include only active project members.
- If assignee is an org member but not yet on project, support `Add to project + assign`.
- Persist assignee as stable user/member reference (not just display name).

### B5.1.1 Deferred: client role as spectator (not active contributor)

Objective:
- Keep `client` as a true observer role (read-only) and reserve active contribution for `worker`/`manager`/`owner`.

Backlog tasks:
- RLS hardening:
  - restrict `INSERT/UPDATE/DELETE` on `media`, `notes`, `folders`, and manual `activity_log` entries to `owner|manager|worker`.
  - keep `SELECT` for `client` project members.
  - keep assignee status updates allowed only when explicitly assigned and intended by policy.
- UI permissions:
  - hide/disable capture, upload, add-note, create/edit/delete activity, folder mutations for `client`.
  - keep timeline and media viewing enabled.
- Sync/service layer:
  - ensure mutation endpoints short-circuit for `client` with clear messages.
- QA:
  - add cross-device tests validating client can view project/media/activity but cannot create or mutate records.

### B5.2 Feed engagement (post-collaboration milestone)

Goal:
- Increase public feed engagement with lightweight social proof and discussion.

Delivery order:
1. V1 `Likes` (ship first, low risk).
2. V2 `Comments` + moderation controls.

V1 scope (`Likes`):
- One like per user per public project.
- Toggle like/unlike from feed card and public project screen.
- Show like count on cards/details.
- RLS: only authenticated users can create/delete their own likes.

V2 scope (`Comments`):
- Comments on public projects only.
- Owner/org admin can remove comments on owned public projects.
- Author can edit/delete own comment within policy window.
- Add abuse controls: rate limit, min/max length, soft moderation states.
- Add report action for unsafe content triage.

Non-goals for initial rollout:
- No threaded replies.
- No direct messaging from comments.
- No anonymous reactions.

### B5.3 Public Media Posts v1 (single-media public publishing)

Goal:
- Allow a team to publish one media item with a short public comment/caption, without requiring the whole project to be public.

Priority:
- High product value, but after collaboration baseline is stable (`project_members`, roles, RLS, invites).

V1 scope:
- Add `Post Public` / `Unpublish` action on project media items.
- Allow optional public caption/comment per post.
- Show media posts in Feed as first-class cards (image/video + caption + project/org attribution).
- Keep project visibility independent:
  - project can stay private
  - selected media post can still be public
- Deep link from feed post to a public media detail page.

Data model (Supabase target):
- `public_media_posts`
  - `id`
  - `project_id`
  - `media_id`
  - `organization_id` (nullable)
  - `caption`
  - `published_by_user_id`
  - `status` (`published | unpublished | removed`)
  - `created_at`, `updated_at`, `published_at`
- Constraints:
  - unique active post per media (`media_id` while `status='published'`)
  - foreign keys to `projects`, `media`, `users`

Security and privacy:
- Publish/unpublish allowed only for project owner/manager roles.
- Public read allowed only for rows where `status='published'`.
- No sensitive metadata leakage in public views (no private notes, no internal activity data).
- Add explicit confirmation before publishing.

Moderation and lifecycle:
- Unpublish must be immediate and reversible.
- Soft-delete path (`removed`) for moderation/admin tooling.
- Basic reporting hook can be added later with comments rollout.

Non-goals (v1):
- No carousel/multi-photo post composer.
- No per-post likes/comments yet (can reuse feed engagement layer in later phase).
- No scheduled publishing.

## Phased execution plan

### Phase 0: Hardening sprint (1 week)
- Complete Track A0.1 to A0.5.
- Ship bugfix release before structural rebuild.

### Phase 1: Design system + route scaffold (1 week)
- Implement token layer and DM Sans loading.
- Add `components/ui` primitives.
- Scaffold new route tree and shared layouts.

### Phase 2: Data layer migration (1 week)
- Introduce schema v2 migrations and repository helpers.
- Migrate existing local data safely.
- Add activity logging hooks for create/update/delete actions.

### Phase 2.5: Supabase foundation (1 week)
- Create Supabase schema for collaboration tables and project-owned entities.
- Implement invite flow (owner invites coworker/client by email token).
- Implement organization member management API + UI (settings modal and invite acceptance).
- Implement org-member-to-project-member promotion flow for activity assignment.
- Add feed engagement schema:
  - `public_project_likes (project_id, user_id, created_at, UNIQUE(project_id, user_id))`
  - `public_project_comments (id, project_id, user_id, body, status, created_at, updated_at)`
- Add public media post schema:
  - `public_media_posts (id, project_id, media_id, organization_id, caption, published_by_user_id, status, created_at, updated_at, published_at)`
- Implement RLS + storage policies.
- Add backend smoke tests for permission boundaries.

### Phase 3: Core screen rebuild (2 weeks)
- Rebuild Dashboard, Project Overview, Capture, Gallery, Notes, Share.
- Keep offline-first behavior and optimistic UI.
- Replace heavy render-time DB work with efficient selectors.
- Feed V1:
  - Like toggle, like count, optimistic updates, rollback on failure.
- Feed V2:
  - Comment create/edit/delete, owner moderation actions.
- Public Media Post V1:
  - Media-level `Post Public` / `Unpublish` action.
  - Caption editor and publish confirmation.
  - Feed cards for media posts + public media detail deep-link.

### Phase 4: Sync + performance + export/reporting (1 week)
- Ship sync queue worker with retry/backoff and basic conflict handling.
- FlashList tuning for 1000+ media items.
- Multi-select share/export reliability.
- Basic PDF snapshot/report output (project summary + evidence list).

### Phase 5: QA + release prep (1 week)
- E2E manual checklist on iOS + Android.
- Add smoke tests for auth/data/filter/share.
- Final polish and rollout notes.

## Definition of done

- No P0 regressions in auth, media, or data privacy.
- Rebuilt screens match agreed wireframe hierarchy and token system.
- Schema v2 is live with migration path and per-user scoping.
- Supabase collaboration is live with owner invite flow and role-based access.
- RLS guarantees users only access projects where they are members.
- App remains offline-first and performant with large media sets.
- `npm run typecheck` and `npm run lint` pass for release branch.
