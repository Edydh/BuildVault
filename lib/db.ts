import * as SQLite from 'expo-sqlite';
import { withErrorHandlingSync } from './errorHandler';

export type ProjectStatus = 'active' | 'delayed' | 'completed' | 'neutral';
export type ProjectVisibility = 'private' | 'public';
export type ProjectPhaseStatus = 'pending' | 'in_progress' | 'completed';

export interface Project {
  id: string;
  name: string;
  client?: string;
  location?: string;
  organization_id?: string | null;
  status: ProjectStatus;
  status_override?: ProjectStatus | null;
  visibility: ProjectVisibility;
  public_slug?: string | null;
  public_published_at?: number | null;
  public_updated_at?: number | null;
  progress: number;
  start_date?: number | null;
  end_date?: number | null;
  budget?: number | null;
  last_activity_at?: number | null;
  created_at: number;
  updated_at: number;
}

export interface Folder {
  id: string;
  project_id: string;
  name: string;
  created_at: number;
}

export interface MediaItem {
  id: string;
  project_id: string;
  folder_id?: string | null;
  type: 'photo' | 'video' | 'doc';
  uri: string;
  thumb_uri?: string | null;
  note?: string | null;
  metadata?: string | null;
  created_at: number;
}

export interface Note {
  id: string;
  project_id: string;
  media_id?: string | null;
  author_user_id?: string | null;
  title?: string | null;
  content: string;
  created_at: number;
  updated_at: number;
}

export interface User {
  id: string;
  authUserId?: string | null;
  email: string;
  name: string;
  provider: 'apple' | 'google';
  providerId: string;
  avatar?: string | null;
  created_at: number;
  last_login_at: number;
}

export interface Organization {
  id: string;
  name: string;
  slug?: string | null;
  owner_user_id: string;
  created_at: number;
  updated_at: number;
}

export type OrganizationMemberRole = 'owner' | 'admin' | 'member' | 'viewer';
export type OrganizationMemberStatus = 'active' | 'invited' | 'removed';

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id?: string | null;
  invited_email?: string | null;
  role: OrganizationMemberRole;
  status: OrganizationMemberStatus;
  invited_by?: string | null;
  created_at: number;
  updated_at: number;
  accepted_at?: number | null;
}

export interface OrganizationInvite {
  id: string;
  organization_id: string;
  organization_name: string;
  invited_email: string;
  role: OrganizationMemberRole;
  status: OrganizationMemberStatus;
  invited_by?: string | null;
  created_at: number;
  updated_at: number;
}

type RemoteOrganizationSyncRow = {
  id: string;
  name: string;
  slug?: string | null;
  owner_user_id?: string | null;
  created_at: number;
  updated_at: number;
};

type RemoteOrganizationMemberSyncRow = {
  id: string;
  organization_id: string;
  user_id?: string | null;
  invited_email?: string | null;
  role: OrganizationMemberRole;
  status: OrganizationMemberStatus;
  invited_by?: string | null;
  created_at: number;
  updated_at: number;
  accepted_at?: number | null;
};

type RemoteProjectSyncRow = {
  id: string;
  owner_user_id?: string | null;
  organization_id?: string | null;
  name: string;
  client?: string | null;
  location?: string | null;
  status?: ProjectStatus | null;
  status_override?: ProjectStatus | null;
  visibility?: ProjectVisibility | null;
  public_slug?: string | null;
  public_published_at?: number | null;
  public_updated_at?: number | null;
  progress?: number | null;
  start_date?: number | null;
  end_date?: number | null;
  budget?: number | null;
  created_at: number;
  updated_at: number;
};

type RemoteActivitySyncRow = {
  id: string;
  project_id: string;
  action_type: string;
  reference_id?: string | null;
  actor_user_id?: string | null;
  actor_name_snapshot?: string | null;
  metadata?: string | null;
  created_at: number;
};

type RemoteActivityCommentSyncRow = {
  id: string;
  project_id: string;
  activity_id: string;
  author_user_id?: string | null;
  author_name_snapshot?: string | null;
  body: string;
  created_at: number;
  updated_at: number;
};

type RemoteFolderSyncRow = {
  id: string;
  project_id: string;
  name: string;
  created_at: number;
};

type RemoteMediaSyncRow = {
  id: string;
  project_id: string;
  folder_id?: string | null;
  type: MediaItem['type'];
  uri: string;
  thumb_uri?: string | null;
  note?: string | null;
  metadata?: string | null;
  created_at: number;
};

type RemoteNoteSyncRow = {
  id: string;
  project_id: string;
  media_id?: string | null;
  author_user_id?: string | null;
  title?: string | null;
  content: string;
  created_at: number;
  updated_at: number;
};

type RemoteProjectMemberSyncRow = {
  id: string;
  project_id: string;
  user_id?: string | null;
  invited_email?: string | null;
  role: ProjectMemberRole;
  status: ProjectMemberStatus;
  invited_by?: string | null;
  user_name_snapshot?: string | null;
  user_email_snapshot?: string | null;
  created_at: number;
  updated_at: number;
  accepted_at?: number | null;
};

type RemoteProjectPublicProfileSyncRow = {
  project_id: string;
  public_title?: string | null;
  summary?: string | null;
  city?: string | null;
  region?: string | null;
  category?: string | null;
  hero_media_id?: string | null;
  hero_comment?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  website_url?: string | null;
  highlights_json?: string | null;
  created_at: number;
  updated_at: number;
};

type RemoteProjectNotificationSyncRow = {
  id: string;
  recipient_user_id: string;
  project_id: string;
  activity_id?: string | null;
  actor_user_id?: string | null;
  action_type: string;
  title?: string | null;
  body?: string | null;
  metadata?: string | null;
  read_at?: number | null;
  created_at: number;
};

export interface ProjectPublicProfile {
  project_id: string;
  public_title?: string | null;
  summary?: string | null;
  city?: string | null;
  region?: string | null;
  category?: string | null;
  hero_media_id?: string | null;
  hero_comment?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  website_url?: string | null;
  highlights_json?: string | null;
  created_at: number;
  updated_at: number;
}

export interface PublicProjectSummary {
  project_id: string;
  organization_id?: string | null;
  public_slug: string;
  title: string;
  summary?: string | null;
  city?: string | null;
  region?: string | null;
  category?: string | null;
  hero_uri?: string | null;
  hero_thumb_uri?: string | null;
  organization_name?: string | null;
  status: ProjectStatus;
  progress: number;
  published_at?: number | null;
  updated_at?: number | null;
  media_count: number;
}

export interface PublicProjectDetail extends PublicProjectSummary {
  hero_comment?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  website_url?: string | null;
  highlights?: string[];
}

export interface ProjectPublicReadiness {
  ready: boolean;
  checks: {
    slug: boolean;
    title: boolean;
    summary: boolean;
    location: boolean;
    heroMedia: boolean;
  };
  missing: string[];
  effective_slug?: string | null;
}

export type ProjectMemberRole = 'owner' | 'manager' | 'worker' | 'client';
export type ProjectMemberStatus = 'invited' | 'active' | 'removed';

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id?: string | null;
  invited_email?: string | null;
  role: ProjectMemberRole;
  status: ProjectMemberStatus;
  invited_by?: string | null;
  user_name_snapshot?: string | null;
  user_email_snapshot?: string | null;
  created_at: number;
  updated_at: number;
  accepted_at?: number | null;
}

export interface ActivityLogEntry {
  id: string;
  project_id: string;
  action_type: string;
  reference_id?: string | null;
  actor_user_id?: string | null;
  actor_name_snapshot?: string | null;
  metadata?: string | null;
  created_at: number;
}

export interface ActivityComment {
  id: string;
  project_id: string;
  activity_id: string;
  author_user_id?: string | null;
  author_name_snapshot?: string | null;
  body: string;
  created_at: number;
  updated_at: number;
}

export interface ProjectNotification {
  id: string;
  user_id: string;
  project_id: string;
  activity_id?: string | null;
  actor_user_id?: string | null;
  action_type: string;
  title?: string | null;
  body?: string | null;
  metadata?: string | null;
  read_at?: number | null;
  created_at: number;
}

export interface ProjectPhase {
  id: string;
  project_id: string;
  user_id?: string | null;
  name: string;
  weight: number;
  status: ProjectPhaseStatus;
  due_date?: number | null;
  completed_at?: number | null;
  created_at: number;
  updated_at: number;
}

export interface ProjectProgressComputation {
  project_id: string;
  progress: number;
  status: ProjectStatus;
  phase_completion: number;
  activity_contribution: number;
  last_activity_at?: number | null;
  has_phases: boolean;
  status_override?: ProjectStatus | null;
  is_status_overridden: boolean;
}

type UserIdentityRow = {
  id: string;
  auth_user_id?: string | null;
  email: string;
  name: string;
  provider: 'apple' | 'google';
  provider_id: string;
  avatar?: string | null;
  created_at: number;
  last_login_at: number;
};

const db = SQLite.openDatabaseSync('buildvault.db');
const STALE_ACTIVITY_MS = 7 * 24 * 60 * 60 * 1000;
const ACTIVITY_PROGRESS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ACTIVITY_CONTRIBUTION = 20;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let activityActor: ActivityActor | null = null;
let activeUserScopeId: string | null = null;
const ORGANIZATION_MEMBER_ROLES: OrganizationMemberRole[] = ['owner', 'admin', 'member', 'viewer'];
const ORGANIZATION_MEMBER_STATUSES: OrganizationMemberStatus[] = ['active', 'invited', 'removed'];
const PROJECT_MEMBER_ROLES: ProjectMemberRole[] = ['owner', 'manager', 'worker', 'client'];
const PROJECT_MEMBER_STATUSES: ProjectMemberStatus[] = ['invited', 'active', 'removed'];

const ACTIVITY_PROGRESS_WEIGHTS: Record<string, number> = {
  media_added: 3,
  media_moved: 1,
  note_added: 3,
  note_updated: 2,
  note_removed: 0,
  folder_created: 1,
  folder_renamed: 1,
  folder_deleted: 0,
  media_deleted: 0,
  material_purchase: 2,
  safety_inspection: 2,
  meeting_notes: 1,
  site_visit: 1,
  quality_check: 2,
  delivery: 1,
  custom_activity: 1,
  member_added: 1,
  member_removed: 0,
  member_role_updated: 1,
  member_status_updated: 1,
  member_invited: 1,
  invite_accepted: 2,
  project_created: 0,
  project_updated: 0,
  project_marked_completed: 0,
  project_reopened: 0,
  project_organization_updated: 1,
  project_public_profile_updated: 1,
  project_published: 1,
  project_unpublished: 0,
};

export interface ActivityActor {
  userId: string;
  name?: string | null;
}

function normalizeScopedUserId(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isUuid(value: string | null | undefined): boolean {
  if (!value) return false;
  return UUID_REGEX.test(value.trim());
}

function getScopedUserIdOrThrow(): string {
  const userId = normalizeScopedUserId(activeUserScopeId);
  if (!userId) {
    throw new Error('No active user scope');
  }
  return userId;
}

function hasActiveProjectMembership(projectId: string, userId: string): boolean {
  const membership = db.getFirstSync(
    `SELECT id
     FROM project_members
     WHERE project_id = ?
       AND user_id = ?
       AND status = 'active'
     LIMIT 1`,
    [projectId, userId]
  ) as { id?: string } | null;
  return !!membership?.id;
}

function getProjectAccessPredicate(alias: string): string {
  return `(
    ${alias}.user_id = ?
    OR EXISTS (
      SELECT 1
      FROM project_members pm
      WHERE pm.project_id = ${alias}.id
        AND pm.user_id = ?
        AND pm.status = 'active'
    )
  )`;
}

function assertProjectAccess(projectId: string, userId: string): void {
  const row = db.getFirstSync('SELECT id, user_id FROM projects WHERE id = ? LIMIT 1', [projectId]) as
    | { id?: string; user_id?: string }
    | null;
  if (!row?.id) {
    throw new Error('Project not found for current user');
  }

  const ownerUserId = typeof row.user_id === 'string' ? row.user_id.trim() : '';
  if (ownerUserId === userId) {
    return;
  }

  if (hasActiveProjectMembership(projectId, userId)) {
    return;
  }

  throw new Error('Project not found for current user');
}

function adoptLegacyRowsForActiveUser(userId: string) {
  try {
    db.runSync(`UPDATE projects SET user_id = ? WHERE user_id IS NULL OR trim(user_id) = ''`, [userId]);
    db.runSync(`UPDATE folders SET user_id = ? WHERE user_id IS NULL OR trim(user_id) = ''`, [userId]);
    db.runSync(`UPDATE media SET user_id = ? WHERE user_id IS NULL OR trim(user_id) = ''`, [userId]);
    db.runSync(`UPDATE activity_log SET user_id = ? WHERE user_id IS NULL OR trim(user_id) = ''`, [userId]);
    db.runSync(`UPDATE activity_comments SET user_id = ? WHERE user_id IS NULL OR trim(user_id) = ''`, [userId]);
  } catch (error) {
    console.log('Legacy user scoping migration warning:', error);
  }
}

export function setActiveUserScope(userId: string | null): void {
  const normalizedUserId = normalizeScopedUserId(userId);
  activeUserScopeId = normalizedUserId;

  if (normalizedUserId) {
    adoptLegacyRowsForActiveUser(normalizedUserId);
  }
}

export function getActiveUserScope(): string | null {
  return activeUserScopeId;
}

function isProjectMemberRole(value: unknown): value is ProjectMemberRole {
  return typeof value === 'string' && PROJECT_MEMBER_ROLES.includes(value as ProjectMemberRole);
}

function isProjectMemberStatus(value: unknown): value is ProjectMemberStatus {
  return typeof value === 'string' && PROJECT_MEMBER_STATUSES.includes(value as ProjectMemberStatus);
}

function isOrganizationMemberRole(value: unknown): value is OrganizationMemberRole {
  return typeof value === 'string' && ORGANIZATION_MEMBER_ROLES.includes(value as OrganizationMemberRole);
}

function isOrganizationMemberStatus(value: unknown): value is OrganizationMemberStatus {
  return typeof value === 'string' && ORGANIZATION_MEMBER_STATUSES.includes(value as OrganizationMemberStatus);
}

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isDuplicateColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return message.includes('duplicate column name');
}

function clampProgress(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return numeric;
}

function normalizeActivityReferenceValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveActivityReferenceId(
  referenceId?: string | null,
  metadata?: Record<string, unknown> | null
): string | null {
  const explicit = normalizeActivityReferenceValue(referenceId);
  if (referenceId !== undefined) {
    return explicit;
  }

  if (!metadata) return null;
  return (
    normalizeActivityReferenceValue(metadata.reference_id) ??
    normalizeActivityReferenceValue(metadata.media_id) ??
    normalizeActivityReferenceValue(metadata.referenceId) ??
    null
  );
}

type PhaseAggregate = {
  completedWeight: number;
  totalWeight: number;
  totalCount: number;
  overdueCount: number;
};

type ProjectProgressOptions = {
  projectId: string;
  endDate: number | null;
  legacyProgress: number;
  lastActivityAt?: number | null;
  scopedUserId?: string | null;
  statusOverride?: ProjectStatus | null;
};

function toFiniteNumber(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function getPhaseAggregate(projectId: string, scopedUserId?: string | null): PhaseAggregate {
  const userId = normalizeScopedUserId(scopedUserId);
  const params: Array<string | number> = [Date.now(), projectId];
  const scopedWhere = userId ? 'AND user_id = ?' : '';
  if (userId) params.push(userId);

  let row: Record<string, unknown> | null = null;
  try {
    row = db.getFirstSync(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'completed' THEN weight ELSE 0 END), 0) AS completed_weight,
         COALESCE(SUM(CASE WHEN weight > 0 THEN weight ELSE 0 END), 0) AS total_weight,
         COUNT(*) AS total_count,
         COALESCE(SUM(CASE
           WHEN status IN ('pending', 'in_progress')
             AND due_date IS NOT NULL
             AND due_date < ?
           THEN 1 ELSE 0 END), 0) AS overdue_count
       FROM project_phases
       WHERE project_id = ?
         ${scopedWhere}`,
      params
    ) as Record<string, unknown> | null;
  } catch {
    row = null;
  }

  return {
    completedWeight: Math.max(0, toFiniteNumber(row?.completed_weight)),
    totalWeight: Math.max(0, toFiniteNumber(row?.total_weight)),
    totalCount: Math.max(0, Math.floor(toFiniteNumber(row?.total_count))),
    overdueCount: Math.max(0, Math.floor(toFiniteNumber(row?.overdue_count))),
  };
}

function getActivityContribution(projectId: string, scopedUserId?: string | null): number {
  const userId = normalizeScopedUserId(scopedUserId);
  const windowStart = Date.now() - ACTIVITY_PROGRESS_WINDOW_MS;
  const params: Array<string | number> = [projectId, windowStart];
  const scopedWhere = userId ? 'AND user_id = ?' : '';
  if (userId) params.push(userId);

  let rows: Array<Record<string, unknown>> = [];
  try {
    rows = db.getAllSync(
      `SELECT action_type, COUNT(*) AS action_count
       FROM activity_log
       WHERE project_id = ?
         AND created_at >= ?
         ${scopedWhere}
       GROUP BY action_type`,
      params
    ) as Array<Record<string, unknown>>;
  } catch {
    rows = [];
  }

  let points = 0;
  for (const row of rows) {
    const actionType = typeof row.action_type === 'string' ? row.action_type : '';
    const actionCount = Math.max(0, Math.floor(toFiniteNumber(row.action_count)));
    if (!actionType || actionCount <= 0) continue;
    const weight = ACTIVITY_PROGRESS_WEIGHTS[actionType] ?? 2;
    if (weight <= 0) continue;
    points += actionCount * weight;
  }

  const contribution = points > 0 ? Math.max(1, Math.ceil(points / 3)) : 0;
  return Math.min(MAX_ACTIVITY_CONTRIBUTION, contribution);
}

function getLastMeaningfulActivity(projectId: string, scopedUserId?: string | null): number | null {
  const userId = normalizeScopedUserId(scopedUserId);
  const params: Array<string | number> = [projectId];
  let query = `SELECT MAX(created_at) AS last_activity_at
               FROM activity_log
               WHERE project_id = ?
                 AND action_type NOT IN ('project_created', 'project_updated')`;

  if (userId) {
    query += ' AND user_id = ?';
    params.push(userId);
  }

  try {
    const row = db.getFirstSync(query, params) as { last_activity_at?: number | null } | null;
    return toNullableNumber(row?.last_activity_at);
  } catch {
    return null;
  }
}

function deriveStatusFromProcess(options: {
  progress: number;
  phaseCompletion: number;
  endDate: number | null;
  lastActivityAt: number | null;
  hasOverduePhases: boolean;
}): ProjectStatus {
  if (options.phaseCompletion >= 100 || options.progress >= 100) return 'completed';
  if (options.hasOverduePhases) return 'delayed';
  if (options.endDate !== null && Date.now() > options.endDate) return 'delayed';
  if (!options.lastActivityAt) return 'neutral';
  if (Date.now() - options.lastActivityAt > STALE_ACTIVITY_MS) return 'delayed';
  if (options.progress <= 0) return 'neutral';
  return 'active';
}

function normalizeProjectStatusOverride(value: unknown): ProjectStatus | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (normalized === 'completed' || normalized === 'active' || normalized === 'delayed' || normalized === 'neutral') {
    return normalized;
  }
  return null;
}

function normalizeProjectStatus(value: unknown): ProjectStatus {
  if (typeof value !== 'string') return 'neutral';
  const normalized = value.trim();
  if (normalized === 'completed' || normalized === 'active' || normalized === 'delayed' || normalized === 'neutral') {
    return normalized;
  }
  return 'neutral';
}

function computeProjectProgressInternal(options: ProjectProgressOptions): ProjectProgressComputation {
  const lastActivityAt =
    options.lastActivityAt === undefined
      ? getLastMeaningfulActivity(options.projectId, options.scopedUserId)
      : options.lastActivityAt;

  const phases = getPhaseAggregate(options.projectId, options.scopedUserId);
  const hasPhases = phases.totalCount > 0;
  const activityContribution = getActivityContribution(options.projectId, options.scopedUserId);

  const phaseCompletion = hasPhases && phases.totalWeight > 0
    ? clampProgress((phases.completedWeight / phases.totalWeight) * 100)
    : 0;

  const statusOverride = normalizeProjectStatusOverride(options.statusOverride);
  if (statusOverride === 'completed') {
    return {
      project_id: options.projectId,
      progress: 100,
      status: 'completed',
      phase_completion: phaseCompletion,
      activity_contribution: activityContribution,
      last_activity_at: lastActivityAt,
      has_phases: hasPhases,
      status_override: statusOverride,
      is_status_overridden: true,
    };
  }

  const computedProgress = hasPhases
    ? clampProgress(phaseCompletion + activityContribution)
    : clampProgress(Math.max(options.legacyProgress, activityContribution * 3));

  const status = deriveStatusFromProcess({
    progress: computedProgress,
    phaseCompletion,
    endDate: options.endDate,
    lastActivityAt,
    hasOverduePhases: phases.overdueCount > 0,
  });

  return {
    project_id: options.projectId,
    progress: computedProgress,
    status,
    phase_completion: phaseCompletion,
    activity_contribution: activityContribution,
    last_activity_at: lastActivityAt,
    has_phases: hasPhases,
    status_override: null,
    is_status_overridden: false,
  };
}

function touchProject(projectId: string, at: number = Date.now(), scopedUserId?: string | null) {
  const userId = normalizeScopedUserId(scopedUserId ?? activeUserScopeId);
  try {
    if (userId) {
      db.runSync('UPDATE projects SET updated_at = ? WHERE id = ? AND user_id = ?', [at, projectId, userId]);
      return;
    }
    db.runSync('UPDATE projects SET updated_at = ? WHERE id = ?', [at, projectId]);
  } catch {
    // Keep write operations resilient when migrations are still applying.
  }
}

function logActivityInternal(
  projectId: string,
  actionType: string,
  referenceId?: string | null,
  metadata?: Record<string, unknown> | null,
  createdAt: number = Date.now(),
  actor?: ActivityActor | null
): ActivityLogEntry | null {
  try {
    const scopedUserId = normalizeScopedUserId(activeUserScopeId);
    const resolvedActor = actor ?? activityActor;
    const actorUserId = resolvedActor?.userId?.trim() ? resolvedActor.userId.trim() : null;
    const actorNameSnapshot = resolvedActor?.name?.trim() ? resolvedActor.name.trim() : null;
    const id = createId();
    const metadataJson = metadata ? JSON.stringify(metadata) : null;
    db.runSync(
      'INSERT INTO activity_log (id, user_id, project_id, action_type, reference_id, actor_user_id, actor_name_snapshot, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, scopedUserId, projectId, actionType, referenceId || null, actorUserId, actorNameSnapshot, metadataJson, createdAt]
    );
    return {
      id,
      project_id: projectId,
      action_type: actionType,
      reference_id: referenceId || null,
      actor_user_id: actorUserId,
      actor_name_snapshot: actorNameSnapshot,
      metadata: metadataJson,
      created_at: createdAt,
    };
  } catch (error) {
    console.log('Failed to write activity log:', error);
    return null;
  }
}

function mapProjectRow(row: Record<string, unknown>): Project {
  const createdAt = toNullableNumber(row.created_at) ?? Date.now();
  const id = String(row.id);
  const legacyProgress = clampProgress(row.progress);
  const endDate = toNullableNumber(row.end_date);
  const scopedUserId = typeof row.user_id === 'string' ? row.user_id : null;
  const computed = computeProjectProgressInternal({
    projectId: id,
    legacyProgress,
    endDate,
    lastActivityAt: toNullableNumber(row.last_activity_at),
    scopedUserId,
    statusOverride: normalizeProjectStatusOverride(row.status_override),
  });
  const visibility: ProjectVisibility = row.visibility === 'public' ? 'public' : 'private';

  return {
    id,
    name: String(row.name ?? ''),
    client: typeof row.client === 'string' ? row.client : undefined,
    location: typeof row.location === 'string' ? row.location : undefined,
    organization_id: typeof row.organization_id === 'string' ? row.organization_id : null,
    status: computed.status,
    status_override: computed.status_override ?? null,
    visibility,
    public_slug: typeof row.public_slug === 'string' ? row.public_slug : null,
    public_published_at: toNullableNumber(row.public_published_at),
    public_updated_at: toNullableNumber(row.public_updated_at),
    progress: computed.progress,
    start_date: toNullableNumber(row.start_date),
    end_date: endDate,
    budget: toNullableNumber(row.budget),
    last_activity_at: computed.last_activity_at,
    created_at: createdAt,
    updated_at: toNullableNumber(row.updated_at) ?? createdAt,
  };
}

function mapProjectMemberRow(row: Record<string, unknown>): ProjectMember {
  const createdAt = toNullableNumber(row.created_at) ?? Date.now();
  const role = isProjectMemberRole(row.role) ? row.role : 'worker';
  const status = isProjectMemberStatus(row.status) ? row.status : 'invited';

  return {
    id: String(row.id),
    project_id: String(row.project_id),
    user_id: typeof row.user_id === 'string' ? row.user_id : null,
    invited_email: typeof row.invited_email === 'string' ? row.invited_email : null,
    role,
    status,
    invited_by: typeof row.invited_by === 'string' ? row.invited_by : null,
    user_name_snapshot: typeof row.user_name_snapshot === 'string' ? row.user_name_snapshot : null,
    user_email_snapshot: typeof row.user_email_snapshot === 'string' ? row.user_email_snapshot : null,
    created_at: createdAt,
    updated_at: toNullableNumber(row.updated_at) ?? createdAt,
    accepted_at: toNullableNumber(row.accepted_at),
  };
}

function mapActivityRow(row: Record<string, unknown>): ActivityLogEntry {
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    action_type: String(row.action_type),
    reference_id: typeof row.reference_id === 'string' ? row.reference_id : null,
    actor_user_id: typeof row.actor_user_id === 'string' ? row.actor_user_id : null,
    actor_name_snapshot: typeof row.actor_name_snapshot === 'string' ? row.actor_name_snapshot : null,
    metadata: typeof row.metadata === 'string' ? row.metadata : null,
    created_at: toNullableNumber(row.created_at) ?? Date.now(),
  };
}

function mapActivityCommentRow(row: Record<string, unknown>): ActivityComment {
  const createdAt = toNullableNumber(row.created_at) ?? Date.now();
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    activity_id: String(row.activity_id),
    author_user_id: typeof row.author_user_id === 'string' ? row.author_user_id : null,
    author_name_snapshot: typeof row.author_name_snapshot === 'string' ? row.author_name_snapshot : null,
    body: typeof row.body === 'string' ? row.body : '',
    created_at: createdAt,
    updated_at: toNullableNumber(row.updated_at) ?? createdAt,
  };
}

function mapProjectNotificationRow(row: Record<string, unknown>): ProjectNotification {
  const createdAt = toNullableNumber(row.created_at) ?? Date.now();
  return {
    id: String(row.id),
    user_id: String(row.user_id ?? ''),
    project_id: String(row.project_id ?? ''),
    activity_id: typeof row.activity_id === 'string' ? row.activity_id : null,
    actor_user_id: typeof row.actor_user_id === 'string' ? row.actor_user_id : null,
    action_type: typeof row.action_type === 'string' ? row.action_type : 'project_updated',
    title: typeof row.title === 'string' ? row.title : null,
    body: typeof row.body === 'string' ? row.body : null,
    metadata: typeof row.metadata === 'string' ? row.metadata : null,
    read_at: toNullableNumber(row.read_at),
    created_at: createdAt,
  };
}

function mapNoteRow(row: Record<string, unknown>): Note {
  const createdAt = toNullableNumber(row.created_at) ?? Date.now();
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    media_id: typeof row.media_id === 'string' ? row.media_id : null,
    author_user_id: typeof row.author_user_id === 'string' ? row.author_user_id : null,
    title: typeof row.title === 'string' ? row.title : null,
    content: typeof row.content === 'string' ? row.content : '',
    created_at: createdAt,
    updated_at: toNullableNumber(row.updated_at) ?? createdAt,
  };
}

function mapUserRow(row: Record<string, unknown>): User {
  return {
    id: String(row.id),
    authUserId: typeof row.auth_user_id === 'string' ? row.auth_user_id : null,
    email: String(row.email ?? ''),
    name: String(row.name ?? ''),
    provider: row.provider === 'apple' ? 'apple' : 'google',
    providerId: typeof row.provider_id === 'string' ? row.provider_id : String(row.providerId ?? ''),
    avatar: typeof row.avatar === 'string' ? row.avatar : null,
    created_at: toNullableNumber(row.created_at) ?? Date.now(),
    last_login_at: toNullableNumber(row.last_login_at) ?? Date.now(),
  };
}

function mapUserIdentityRow(row: Record<string, unknown>): UserIdentityRow {
  const createdAt = toNullableNumber(row.created_at) ?? Date.now();
  return {
    id: String(row.id),
    auth_user_id: typeof row.auth_user_id === 'string' ? row.auth_user_id : null,
    email: typeof row.email === 'string' ? row.email : '',
    name: typeof row.name === 'string' ? row.name : '',
    provider: row.provider === 'apple' ? 'apple' : 'google',
    provider_id: typeof row.provider_id === 'string' ? row.provider_id : '',
    avatar: typeof row.avatar === 'string' ? row.avatar : null,
    created_at: createdAt,
    last_login_at: toNullableNumber(row.last_login_at) ?? createdAt,
  };
}

function normalizeIdentityValue(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function mergeUserRowData(target: UserIdentityRow, source: UserIdentityRow): UserIdentityRow {
  return {
    ...target,
    auth_user_id: normalizeIdentityValue(target.auth_user_id) || normalizeIdentityValue(source.auth_user_id),
    email: target.email || source.email,
    name: target.name || source.name,
    provider: target.provider || source.provider,
    provider_id: target.provider_id || source.provider_id,
    avatar: target.avatar || source.avatar || null,
    created_at: Math.min(target.created_at, source.created_at),
    last_login_at: Math.max(target.last_login_at, source.last_login_at),
  };
}

function repointUserReferences(sourceUserId: string, targetUserId: string) {
  if (sourceUserId === targetUserId) return;

  // Avoid collisions on unique (organization_id, user_id) memberships.
  db.runSync(
    `DELETE FROM organization_members
     WHERE user_id = ?
       AND organization_id IN (
         SELECT organization_id
         FROM organization_members
         WHERE user_id = ?
       )`,
    [sourceUserId, targetUserId]
  );
  db.runSync(
    `DELETE FROM project_members
     WHERE user_id = ?
       AND project_id IN (
         SELECT project_id
         FROM project_members
         WHERE user_id = ?
       )`,
    [sourceUserId, targetUserId]
  );

  db.runSync('UPDATE projects SET user_id = ? WHERE user_id = ?', [targetUserId, sourceUserId]);
  db.runSync('UPDATE folders SET user_id = ? WHERE user_id = ?', [targetUserId, sourceUserId]);
  db.runSync('UPDATE media SET user_id = ? WHERE user_id = ?', [targetUserId, sourceUserId]);
  db.runSync('UPDATE activity_log SET user_id = ? WHERE user_id = ?', [targetUserId, sourceUserId]);
  db.runSync('UPDATE activity_log SET actor_user_id = ? WHERE actor_user_id = ?', [targetUserId, sourceUserId]);
  db.runSync('UPDATE activity_comments SET user_id = ? WHERE user_id = ?', [targetUserId, sourceUserId]);
  db.runSync('UPDATE activity_comments SET author_user_id = ? WHERE author_user_id = ?', [targetUserId, sourceUserId]);
  db.runSync('UPDATE project_notifications SET user_id = ? WHERE user_id = ?', [targetUserId, sourceUserId]);
  db.runSync('UPDATE project_notifications SET actor_user_id = ? WHERE actor_user_id = ?', [targetUserId, sourceUserId]);
  db.runSync('UPDATE organizations SET owner_user_id = ? WHERE owner_user_id = ?', [targetUserId, sourceUserId]);
  db.runSync('UPDATE organization_members SET user_id = ? WHERE user_id = ?', [targetUserId, sourceUserId]);
  db.runSync('UPDATE project_members SET user_id = ? WHERE user_id = ?', [targetUserId, sourceUserId]);
  db.runSync('UPDATE organization_members SET invited_by = ? WHERE invited_by = ?', [targetUserId, sourceUserId]);
  db.runSync('UPDATE project_members SET invited_by = ? WHERE invited_by = ?', [targetUserId, sourceUserId]);
}

function mergeUserRecords(sourceUserId: string, targetUserId: string) {
  if (sourceUserId === targetUserId) return;

  const sourceRow = db.getFirstSync('SELECT * FROM users WHERE id = ? LIMIT 1', [sourceUserId]) as
    | Record<string, unknown>
    | null;
  const targetRow = db.getFirstSync('SELECT * FROM users WHERE id = ? LIMIT 1', [targetUserId]) as
    | Record<string, unknown>
    | null;

  if (!sourceRow || !targetRow) return;

  const merged = mergeUserRowData(mapUserIdentityRow(targetRow), mapUserIdentityRow(sourceRow));
  repointUserReferences(sourceUserId, targetUserId);

  db.runSync(
    `UPDATE users
     SET auth_user_id = ?,
         email = ?,
         name = ?,
         provider = ?,
         provider_id = ?,
         avatar = ?,
         created_at = ?,
         last_login_at = ?
     WHERE id = ?`,
    [
      merged.auth_user_id ?? null,
      merged.email,
      merged.name,
      merged.provider,
      merged.provider_id,
      merged.avatar ?? null,
      merged.created_at,
      merged.last_login_at,
      targetUserId,
    ]
  );

  db.runSync('DELETE FROM users WHERE id = ?', [sourceUserId]);
}

function deduplicateUsersByIdentity() {
  const duplicateAuthGroups = db.getAllSync(
    `SELECT auth_user_id
     FROM users
     WHERE auth_user_id IS NOT NULL
       AND length(trim(auth_user_id)) > 0
     GROUP BY auth_user_id
     HAVING COUNT(*) > 1`
  ) as Array<Record<string, unknown>>;

  for (const group of duplicateAuthGroups) {
    const authUserId = normalizeIdentityValue(typeof group.auth_user_id === 'string' ? group.auth_user_id : null);
    if (!authUserId) continue;
    const rows = db.getAllSync(
      `SELECT *
       FROM users
       WHERE auth_user_id = ?
       ORDER BY last_login_at DESC, created_at DESC, id ASC`,
      [authUserId]
    ) as Array<Record<string, unknown>>;

    if (rows.length < 2) continue;
    const canonicalId = String(rows[0].id);
    for (let index = 1; index < rows.length; index += 1) {
      mergeUserRecords(String(rows[index].id), canonicalId);
    }
  }

  const duplicateProviderGroups = db.getAllSync(
    `SELECT provider, provider_id
     FROM users
     WHERE provider IS NOT NULL
       AND length(trim(provider)) > 0
       AND provider_id IS NOT NULL
       AND length(trim(provider_id)) > 0
     GROUP BY provider, provider_id
     HAVING COUNT(*) > 1`
  ) as Array<Record<string, unknown>>;

  for (const group of duplicateProviderGroups) {
    const provider = typeof group.provider === 'string' ? group.provider : '';
    const providerId = typeof group.provider_id === 'string' ? group.provider_id : '';
    if (!provider || !providerId) continue;

    const rows = db.getAllSync(
      `SELECT *
       FROM users
       WHERE provider = ?
         AND provider_id = ?
       ORDER BY last_login_at DESC, created_at DESC, id ASC`,
      [provider, providerId]
    ) as Array<Record<string, unknown>>;

    if (rows.length < 2) continue;
    const canonicalId = String(rows[0].id);
    for (let index = 1; index < rows.length; index += 1) {
      mergeUserRecords(String(rows[index].id), canonicalId);
    }
  }
}

function deduplicateMembershipRows() {
  const organizationUserDuplicates = db.getAllSync(
    `SELECT organization_id, user_id
     FROM organization_members
     WHERE user_id IS NOT NULL
     GROUP BY organization_id, user_id
     HAVING COUNT(*) > 1`
  ) as Array<Record<string, unknown>>;

  for (const group of organizationUserDuplicates) {
    const organizationId = typeof group.organization_id === 'string' ? group.organization_id : '';
    const userId = typeof group.user_id === 'string' ? group.user_id : '';
    if (!organizationId || !userId) continue;

    const canonical = db.getFirstSync(
      `SELECT id
       FROM organization_members
       WHERE organization_id = ? AND user_id = ?
       ORDER BY
         CASE status WHEN 'active' THEN 0 WHEN 'invited' THEN 1 ELSE 2 END ASC,
         updated_at DESC,
         created_at DESC,
         id DESC
       LIMIT 1`,
      [organizationId, userId]
    ) as Record<string, unknown> | null;
    const canonicalId = typeof canonical?.id === 'string' ? canonical.id : null;
    if (!canonicalId) continue;

    db.runSync(
      `DELETE FROM organization_members
       WHERE organization_id = ? AND user_id = ? AND id <> ?`,
      [organizationId, userId, canonicalId]
    );
  }

  const projectUserDuplicates = db.getAllSync(
    `SELECT project_id, user_id
     FROM project_members
     WHERE user_id IS NOT NULL
     GROUP BY project_id, user_id
     HAVING COUNT(*) > 1`
  ) as Array<Record<string, unknown>>;

  for (const group of projectUserDuplicates) {
    const projectId = typeof group.project_id === 'string' ? group.project_id : '';
    const userId = typeof group.user_id === 'string' ? group.user_id : '';
    if (!projectId || !userId) continue;

    const canonical = db.getFirstSync(
      `SELECT id
       FROM project_members
       WHERE project_id = ? AND user_id = ?
       ORDER BY
         CASE status WHEN 'active' THEN 0 WHEN 'invited' THEN 1 ELSE 2 END ASC,
         updated_at DESC,
         created_at DESC,
         id DESC
       LIMIT 1`,
      [projectId, userId]
    ) as Record<string, unknown> | null;
    const canonicalId = typeof canonical?.id === 'string' ? canonical.id : null;
    if (!canonicalId) continue;

    db.runSync(
      `DELETE FROM project_members
       WHERE project_id = ? AND user_id = ? AND id <> ?`,
      [projectId, userId, canonicalId]
    );
  }
}

function mapOrganizationRow(row: Record<string, unknown>): Organization {
  const createdAt = toNullableNumber(row.created_at) ?? Date.now();
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    slug: typeof row.slug === 'string' ? row.slug : null,
    owner_user_id: String(row.owner_user_id ?? ''),
    created_at: createdAt,
    updated_at: toNullableNumber(row.updated_at) ?? createdAt,
  };
}

function mapOrganizationMemberRow(row: Record<string, unknown>): OrganizationMember {
  const createdAt = toNullableNumber(row.created_at) ?? Date.now();
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    user_id: typeof row.user_id === 'string' ? row.user_id : null,
    invited_email: typeof row.invited_email === 'string' ? row.invited_email : null,
    role: isOrganizationMemberRole(row.role) ? row.role : 'member',
    status: isOrganizationMemberStatus(row.status) ? row.status : 'invited',
    invited_by: typeof row.invited_by === 'string' ? row.invited_by : null,
    created_at: createdAt,
    updated_at: toNullableNumber(row.updated_at) ?? createdAt,
    accepted_at: toNullableNumber(row.accepted_at),
  };
}

function mapOrganizationInviteRow(row: Record<string, unknown>): OrganizationInvite {
  const createdAt = toNullableNumber(row.created_at) ?? Date.now();
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    organization_name: String(row.organization_name ?? ''),
    invited_email: String(row.invited_email ?? ''),
    role: isOrganizationMemberRole(row.role) ? row.role : 'member',
    status: isOrganizationMemberStatus(row.status) ? row.status : 'invited',
    invited_by: typeof row.invited_by === 'string' ? row.invited_by : null,
    created_at: createdAt,
    updated_at: toNullableNumber(row.updated_at) ?? createdAt,
  };
}

function mapProjectPublicProfileRow(row: Record<string, unknown>): ProjectPublicProfile {
  const createdAt = toNullableNumber(row.created_at) ?? Date.now();
  return {
    project_id: String(row.project_id),
    public_title: typeof row.public_title === 'string' ? row.public_title : null,
    summary: typeof row.summary === 'string' ? row.summary : null,
    city: typeof row.city === 'string' ? row.city : null,
    region: typeof row.region === 'string' ? row.region : null,
    category: typeof row.category === 'string' ? row.category : null,
    hero_media_id: typeof row.hero_media_id === 'string' ? row.hero_media_id : null,
    hero_comment: typeof row.hero_comment === 'string' ? row.hero_comment : null,
    contact_email: typeof row.contact_email === 'string' ? row.contact_email : null,
    contact_phone: typeof row.contact_phone === 'string' ? row.contact_phone : null,
    website_url: typeof row.website_url === 'string' ? row.website_url : null,
    highlights_json: typeof row.highlights_json === 'string' ? row.highlights_json : null,
    created_at: createdAt,
    updated_at: toNullableNumber(row.updated_at) ?? createdAt,
  };
}

function mapPublicProjectSummaryRow(row: Record<string, unknown>): PublicProjectSummary {
  const projectId = String(row.project_id);
  const computed = computeProjectProgressInternal({
    projectId,
    endDate: toNullableNumber(row.end_date),
    legacyProgress: clampProgress(row.progress),
    lastActivityAt: undefined,
    scopedUserId: null,
    statusOverride: normalizeProjectStatusOverride(row.status_override),
  });

  return {
    project_id: projectId,
    organization_id: typeof row.organization_id === 'string' ? row.organization_id : null,
    public_slug: String(row.public_slug ?? ''),
    title: String(row.title ?? ''),
    summary: typeof row.summary === 'string' ? row.summary : null,
    city: typeof row.city === 'string' ? row.city : null,
    region: typeof row.region === 'string' ? row.region : null,
    category: typeof row.category === 'string' ? row.category : null,
    hero_uri: typeof row.hero_uri === 'string' ? row.hero_uri : null,
    hero_thumb_uri: typeof row.hero_thumb_uri === 'string' ? row.hero_thumb_uri : null,
    organization_name: typeof row.organization_name === 'string' ? row.organization_name : null,
    status: computed.status,
    progress: computed.progress,
    published_at: toNullableNumber(row.published_at),
    updated_at: toNullableNumber(row.updated_at),
    media_count: Math.max(0, Number(row.media_count) || 0),
  };
}

function normalizeEmail(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOrganizationName(value?: string | null): string | null {
  if (!value) return null;
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(inc|llc|ltd|corp|corporation|company|co)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeOrganizationSlug(value?: string | null): string | null {
  if (!value) return null;
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : null;
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error && typeof error.message === 'string') {
    return error.message;
  }
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return '';
}

function assertOrganizationUniqueness(params: {
  name: string;
  slug?: string | null;
  excludeId?: string | null;
}) {
  const normalizedName = normalizeOrganizationName(params.name) ?? params.name.trim().toLowerCase();
  const normalizedSlug = normalizeOrganizationSlug(params.slug ?? null);

  const rows = db.getAllSync(
    `SELECT id, name, slug
     FROM organizations
     WHERE (? IS NULL OR id <> ?)`,
    [params.excludeId ?? null, params.excludeId ?? null]
  ) as Array<Record<string, unknown>>;

  const duplicate = rows.find((row) => {
    const rowName = typeof row.name === 'string' ? row.name : '';
    const rowSlug = typeof row.slug === 'string' ? row.slug : null;
    const rowNormalizedName = normalizeOrganizationName(rowName) ?? rowName.trim().toLowerCase();
    const slugConflict = !!normalizedSlug && !!rowSlug && rowSlug === normalizedSlug;
    const nameConflict = rowNormalizedName.length > 0 && rowNormalizedName === normalizedName;
    return slugConflict || nameConflict;
  });

  if (duplicate) {
    const duplicateName = typeof duplicate.name === 'string' ? duplicate.name : 'another organization';
    throw new Error(`Organization already exists: ${duplicateName}`);
  }
}

function getOrganizationMembership(
  organizationId: string,
  userId: string,
  options?: { includeRemoved?: boolean }
): OrganizationMember | null {
  const whereStatus = options?.includeRemoved ? '' : `AND status <> 'removed'`;
  const row = db.getFirstSync(
    `SELECT *
     FROM organization_members
     WHERE organization_id = ?
       AND user_id = ?
       ${whereStatus}
     ORDER BY created_at ASC
     LIMIT 1`,
    [organizationId, userId]
  ) as Record<string, unknown> | null;
  return row ? mapOrganizationMemberRow(row) : null;
}

function assertOrganizationAccess(organizationId: string, userId: string): OrganizationMember {
  const membership = getOrganizationMembership(organizationId, userId);
  if (!membership || membership.status !== 'active') {
    throw new Error('Organization not found for current user');
  }
  return membership;
}

function assertOrganizationManagementAccess(organizationId: string, userId: string): OrganizationMember {
  const membership = assertOrganizationAccess(organizationId, userId);
  if (membership.role !== 'owner' && membership.role !== 'admin') {
    throw new Error('Insufficient organization permissions');
  }
  return membership;
}

function getCurrentScopedUserEmail(userId: string): string | null {
  const row = db.getFirstSync(
    'SELECT email FROM users WHERE id = ? LIMIT 1',
    [userId]
  ) as { email?: string } | null;
  if (!row || typeof row.email !== 'string') return null;
  return normalizeEmail(row.email);
}

function ensureLocalUserReferenceFromAuthId(
  authUserId: string,
  options?: { fallbackEmail?: string | null; fallbackName?: string | null }
): string | null {
  const normalizedAuthUserId = authUserId.trim();
  if (!normalizedAuthUserId) return null;

  const existingByAuth = getUserByAuthUserId(normalizedAuthUserId);
  if (existingByAuth?.id) {
    return existingByAuth.id;
  }

  const existingById = getUserById(normalizedAuthUserId);
  if (existingById?.id) {
    return existingById.id;
  }

  const fallbackEmail = normalizeEmail(options?.fallbackEmail ?? null) || `${normalizedAuthUserId}@remote.buildvault.local`;
  const fallbackName =
    typeof options?.fallbackName === 'string' && options.fallbackName.trim().length > 0
      ? options.fallbackName.trim()
      : 'BuildVault Member';
  const now = Date.now();

  try {
    db.runSync(
      `INSERT INTO users
        (id, auth_user_id, email, name, provider, provider_id, avatar, created_at, last_login_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
      [normalizedAuthUserId, normalizedAuthUserId, fallbackEmail, fallbackName, 'google', `remote:${normalizedAuthUserId}`, now, now]
    );
  } catch (error) {
    const message = extractErrorMessage(error);
    if (!message.includes('UNIQUE constraint failed')) {
      console.log('Synthetic user bridge warning:', error);
    }
  }

  const resolved = getUserByAuthUserId(normalizedAuthUserId) ?? getUserById(normalizedAuthUserId);
  return resolved?.id ?? null;
}

function assertProjectPublishAccess(projectId: string, userId: string): Record<string, unknown> {
  const project = db.getFirstSync('SELECT * FROM projects WHERE id = ? LIMIT 1', [projectId]) as Record<string, unknown> | null;
  if (!project) {
    throw new Error('Project not found');
  }

  const projectOwnerUserId = typeof project.user_id === 'string' ? project.user_id : '';
  if (projectOwnerUserId === userId) {
    return project;
  }

  const organizationId = typeof project.organization_id === 'string' ? project.organization_id : null;
  if (organizationId) {
    const membership = getOrganizationMembership(organizationId, userId);
    if (membership && membership.status === 'active' && (membership.role === 'owner' || membership.role === 'admin')) {
      return project;
    }
  }

  throw new Error('Project not found for current user');
}

function ensureUniquePublicSlug(seed: string, projectId?: string): string {
  const normalizedSeed = normalizeOrganizationSlug(seed) || `project-${Date.now()}`;
  let candidate = normalizedSeed;
  let suffix = 2;

  while (true) {
    const row = db.getFirstSync(
      'SELECT id FROM projects WHERE public_slug = ? LIMIT 1',
      [candidate]
    ) as { id?: string } | null;

    if (!row?.id || (projectId && row.id === projectId)) {
      return candidate;
    }

    candidate = `${normalizedSeed}-${suffix}`;
    suffix += 1;
  }
}

function computeProjectPublicReadiness(projectId: string, slugOverride?: string | null): ProjectPublicReadiness {
  const project = db.getFirstSync(
    'SELECT id, name, public_slug FROM projects WHERE id = ? LIMIT 1',
    [projectId]
  ) as Record<string, unknown> | null;

  if (!project) {
    return {
      ready: false,
      checks: {
        slug: false,
        title: false,
        summary: false,
        location: false,
        heroMedia: false,
      },
      missing: ['project'],
      effective_slug: null,
    };
  }

  const profile = db.getFirstSync(
    'SELECT public_title, summary, city, region, hero_media_id FROM project_public_profiles WHERE project_id = ? LIMIT 1',
    [projectId]
  ) as Record<string, unknown> | null;

  const fallbackTitle = typeof project.name === 'string' ? project.name.trim() : 'Project';
  const effectiveSlug = normalizeOrganizationSlug(
    slugOverride ??
      (typeof project.public_slug === 'string' ? project.public_slug : null) ??
      fallbackTitle
  );

  const titleCandidate =
    (typeof profile?.public_title === 'string' ? profile.public_title.trim() : '') || fallbackTitle;
  const summaryCandidate = typeof profile?.summary === 'string' ? profile.summary.trim() : '';
  const cityCandidate = typeof profile?.city === 'string' ? profile.city.trim() : '';
  const regionCandidate = typeof profile?.region === 'string' ? profile.region.trim() : '';
  const heroMediaId = typeof profile?.hero_media_id === 'string' ? profile.hero_media_id.trim() : '';

  let hasHeroMedia = false;
  if (heroMediaId) {
    const heroMedia = db.getFirstSync(
      'SELECT id FROM media WHERE id = ? AND project_id = ? LIMIT 1',
      [heroMediaId, projectId]
    ) as { id?: string } | null;
    hasHeroMedia = !!heroMedia?.id;
  }

  const checks = {
    slug: !!effectiveSlug,
    title: titleCandidate.length > 0,
    summary: summaryCandidate.length > 0,
    location: cityCandidate.length > 0 || regionCandidate.length > 0,
    heroMedia: hasHeroMedia,
  };

  const missing: string[] = [];
  if (!checks.slug) missing.push('public slug');
  if (!checks.title) missing.push('public title');
  if (!checks.summary) missing.push('summary');
  if (!checks.location) missing.push('city or region');
  if (!checks.heroMedia) missing.push('hero media');

  return {
    ready: Object.values(checks).every(Boolean),
    checks,
    missing,
    effective_slug: effectiveSlug,
  };
}

function getExistingProjectMemberRecord(
  projectId: string,
  userId?: string | null,
  invitedEmail?: string | null
): Record<string, unknown> | null {
  if (userId) {
    return db.getFirstSync(
      `SELECT * FROM project_members
       WHERE project_id = ? AND user_id = ?
       ORDER BY created_at ASC
       LIMIT 1`,
      [projectId, userId]
    ) as Record<string, unknown> | null;
  }

  const normalizedEmail = normalizeEmail(invitedEmail);
  if (!normalizedEmail) return null;

  return db.getFirstSync(
    `SELECT * FROM project_members
     WHERE project_id = ?
       AND LOWER(COALESCE(invited_email, '')) = ?
     ORDER BY created_at ASC
     LIMIT 1`,
    [projectId, normalizedEmail]
  ) as Record<string, unknown> | null;
}

function saveProjectMemberInternal(data: {
  projectId: string;
  userId?: string | null;
  invitedEmail?: string | null;
  role: ProjectMemberRole;
  status: ProjectMemberStatus;
  invitedBy?: string | null;
  userNameSnapshot?: string | null;
  userEmailSnapshot?: string | null;
  acceptedAt?: number | null;
}): { member: ProjectMember; isNew: boolean; previous: ProjectMember | null } {
  const userId = data.userId?.trim() || null;
  const invitedEmail = normalizeEmail(data.invitedEmail);
  if (!userId && !invitedEmail) {
    throw new Error('Project member requires a userId or invitedEmail');
  }

  const now = Date.now();
  const existingRecord = getExistingProjectMemberRecord(data.projectId, userId, invitedEmail);

  if (existingRecord) {
    const previous = mapProjectMemberRow(existingRecord);
    const acceptedAt = data.acceptedAt === undefined
      ? previous.accepted_at ?? null
      : data.acceptedAt;
    const nextInvitedEmail = invitedEmail ?? previous.invited_email ?? null;
    const nextUserName = data.userNameSnapshot?.trim()
      ? data.userNameSnapshot.trim()
      : previous.user_name_snapshot ?? null;
    const nextUserEmail = data.userEmailSnapshot?.trim()
      ? data.userEmailSnapshot.trim()
      : previous.user_email_snapshot ?? null;
    const nextInvitedBy = data.invitedBy === undefined ? previous.invited_by ?? null : data.invitedBy;

    db.runSync(
      `UPDATE project_members
       SET user_id = ?,
           invited_email = ?,
           role = ?,
           status = ?,
           invited_by = ?,
           user_name_snapshot = ?,
           user_email_snapshot = ?,
           accepted_at = ?,
           updated_at = ?
       WHERE id = ?`,
      [
        userId ?? previous.user_id ?? null,
        nextInvitedEmail,
        data.role,
        data.status,
        nextInvitedBy ?? null,
        nextUserName,
        nextUserEmail,
        acceptedAt,
        now,
        previous.id,
      ]
    );

    const updated = db.getFirstSync('SELECT * FROM project_members WHERE id = ?', [previous.id]) as Record<string, unknown>;
    return {
      member: mapProjectMemberRow(updated),
      isNew: false,
      previous,
    };
  }

  const id = createId();
  const createdAt = now;
  const acceptedAt = data.acceptedAt === undefined ? null : data.acceptedAt;
  const userNameSnapshot = data.userNameSnapshot?.trim() ? data.userNameSnapshot.trim() : null;
  const userEmailSnapshot = data.userEmailSnapshot?.trim() ? data.userEmailSnapshot.trim() : null;

  db.runSync(
    `INSERT INTO project_members
      (id, project_id, user_id, invited_email, role, status, invited_by, user_name_snapshot, user_email_snapshot, created_at, updated_at, accepted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.projectId,
      userId,
      invitedEmail,
      data.role,
      data.status,
      data.invitedBy || null,
      userNameSnapshot,
      userEmailSnapshot,
      createdAt,
      createdAt,
      acceptedAt,
    ]
  );

  const created = db.getFirstSync('SELECT * FROM project_members WHERE id = ?', [id]) as Record<string, unknown>;
  return {
    member: mapProjectMemberRow(created),
    isNew: true,
    previous: null,
  };
}

export function migrate() {
  return withErrorHandlingSync(() => {
    db.execSync(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY NOT NULL,
        auth_user_id TEXT,
        email TEXT NOT NULL,
        name TEXT NOT NULL,
        provider TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        avatar TEXT,
        created_at INTEGER NOT NULL,
        last_login_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        slug TEXT,
        owner_user_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (owner_user_id) REFERENCES users (id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS organization_members (
        id TEXT PRIMARY KEY NOT NULL,
        organization_id TEXT NOT NULL,
        user_id TEXT,
        invited_email TEXT,
        role TEXT NOT NULL DEFAULT 'member',
        status TEXT NOT NULL DEFAULT 'invited',
        invited_by TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        accepted_at INTEGER,
        FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
      );
      CREATE TABLE IF NOT EXISTS project_members (
        id TEXT PRIMARY KEY NOT NULL,
        project_id TEXT NOT NULL,
        user_id TEXT,
        invited_email TEXT,
        role TEXT NOT NULL DEFAULT 'worker',
        status TEXT NOT NULL DEFAULT 'invited',
        invited_by TEXT,
        user_name_snapshot TEXT,
        user_email_snapshot TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        accepted_at INTEGER,
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
      );
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT,
        organization_id TEXT,
        name TEXT NOT NULL,
        client TEXT,
        location TEXT,
        visibility TEXT NOT NULL DEFAULT 'private',
        public_slug TEXT,
        public_published_at INTEGER,
        public_updated_at INTEGER,
        status TEXT NOT NULL DEFAULT 'neutral',
        status_override TEXT,
        progress INTEGER NOT NULL DEFAULT 0,
        start_date INTEGER,
        end_date INTEGER,
        budget REAL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE SET NULL
      );
      CREATE TABLE IF NOT EXISTS project_phases (
        id TEXT PRIMARY KEY NOT NULL,
        project_id TEXT NOT NULL,
        user_id TEXT,
        name TEXT NOT NULL,
        weight REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        due_date INTEGER,
        completed_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS media (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT,
        project_id TEXT NOT NULL,
        folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
        type TEXT NOT NULL,
        uri TEXT NOT NULL,
        thumb_uri TEXT,
        note TEXT,
        metadata TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT,
        project_id TEXT NOT NULL,
        media_id TEXT,
        author_user_id TEXT,
        title TEXT,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
        FOREIGN KEY (media_id) REFERENCES media (id) ON DELETE SET NULL
      );
      CREATE TABLE IF NOT EXISTS activity_log (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT,
        project_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        reference_id TEXT,
        actor_user_id TEXT,
        actor_name_snapshot TEXT,
        metadata TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS activity_comments (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT,
        project_id TEXT NOT NULL,
        activity_id TEXT NOT NULL,
        author_user_id TEXT,
        author_name_snapshot TEXT,
        body TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
        FOREIGN KEY (activity_id) REFERENCES activity_log (id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS project_notifications (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        activity_id TEXT,
        actor_user_id TEXT,
        action_type TEXT NOT NULL,
        title TEXT,
        body TEXT,
        metadata TEXT,
        read_at INTEGER,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS project_public_profiles (
        project_id TEXT PRIMARY KEY NOT NULL,
        public_title TEXT,
        summary TEXT,
        city TEXT,
        region TEXT,
        category TEXT,
        hero_media_id TEXT,
        hero_comment TEXT,
        contact_email TEXT,
        contact_phone TEXT,
        website_url TEXT,
        highlights_json TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
        FOREIGN KEY (hero_media_id) REFERENCES media (id) ON DELETE SET NULL
      );
    `);

    const alterStatements = [
      `ALTER TABLE media ADD COLUMN folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL`,
      `ALTER TABLE media ADD COLUMN metadata TEXT`,
      `ALTER TABLE notes ADD COLUMN user_id TEXT`,
      `ALTER TABLE notes ADD COLUMN media_id TEXT`,
      `ALTER TABLE notes ADD COLUMN author_user_id TEXT`,
      `ALTER TABLE notes ADD COLUMN title TEXT`,
      `ALTER TABLE notes ADD COLUMN updated_at INTEGER`,
      `ALTER TABLE projects ADD COLUMN status TEXT DEFAULT 'neutral'`,
      `ALTER TABLE projects ADD COLUMN status_override TEXT`,
      `ALTER TABLE projects ADD COLUMN progress INTEGER DEFAULT 0`,
      `ALTER TABLE projects ADD COLUMN start_date INTEGER`,
      `ALTER TABLE projects ADD COLUMN end_date INTEGER`,
      `ALTER TABLE projects ADD COLUMN budget REAL`,
      `ALTER TABLE projects ADD COLUMN updated_at INTEGER`,
      `ALTER TABLE projects ADD COLUMN organization_id TEXT`,
      `ALTER TABLE projects ADD COLUMN visibility TEXT DEFAULT 'private'`,
      `ALTER TABLE projects ADD COLUMN public_slug TEXT`,
      `ALTER TABLE projects ADD COLUMN public_published_at INTEGER`,
      `ALTER TABLE projects ADD COLUMN public_updated_at INTEGER`,
      `ALTER TABLE users ADD COLUMN auth_user_id TEXT`,
      `ALTER TABLE projects ADD COLUMN user_id TEXT`,
      `ALTER TABLE folders ADD COLUMN user_id TEXT`,
      `ALTER TABLE media ADD COLUMN user_id TEXT`,
      `ALTER TABLE project_public_profiles ADD COLUMN hero_comment TEXT`,
      `ALTER TABLE activity_log ADD COLUMN user_id TEXT`,
      `ALTER TABLE project_members ADD COLUMN user_id TEXT`,
      `ALTER TABLE project_members ADD COLUMN invited_email TEXT`,
      `ALTER TABLE project_members ADD COLUMN role TEXT DEFAULT 'worker'`,
      `ALTER TABLE project_members ADD COLUMN status TEXT DEFAULT 'invited'`,
      `ALTER TABLE project_members ADD COLUMN invited_by TEXT`,
      `ALTER TABLE project_members ADD COLUMN user_name_snapshot TEXT`,
      `ALTER TABLE project_members ADD COLUMN user_email_snapshot TEXT`,
      `ALTER TABLE project_members ADD COLUMN updated_at INTEGER`,
      `ALTER TABLE project_members ADD COLUMN accepted_at INTEGER`,
      `ALTER TABLE activity_log ADD COLUMN actor_user_id TEXT`,
      `ALTER TABLE activity_log ADD COLUMN actor_name_snapshot TEXT`,
    ];

    for (const statement of alterStatements) {
      try {
        db.execSync(statement);
      } catch (error) {
        if (!isDuplicateColumnError(error)) {
          console.log('Unexpected migration error:', error);
        }
      }
    }

    db.execSync(`
      UPDATE projects SET status = 'neutral' WHERE status IS NULL OR trim(status) = '';
      UPDATE projects SET status_override = NULL WHERE status_override IS NOT NULL AND trim(status_override) = '';
      UPDATE projects SET progress = 0 WHERE progress IS NULL;
      UPDATE projects SET start_date = created_at WHERE start_date IS NULL;
      UPDATE projects SET updated_at = created_at WHERE updated_at IS NULL;
      UPDATE projects SET visibility = 'private' WHERE visibility IS NULL OR trim(visibility) = '';
      UPDATE projects SET public_updated_at = updated_at WHERE public_updated_at IS NULL;
      UPDATE projects SET user_id = '' WHERE user_id IS NULL;
      UPDATE folders SET user_id = '' WHERE user_id IS NULL;
      UPDATE media SET user_id = '' WHERE user_id IS NULL;
      UPDATE notes SET user_id = '' WHERE user_id IS NULL;
      UPDATE notes SET updated_at = created_at WHERE updated_at IS NULL;
      UPDATE activity_log SET user_id = '' WHERE user_id IS NULL;
      UPDATE activity_comments SET user_id = '' WHERE user_id IS NULL;
      UPDATE activity_comments SET updated_at = created_at WHERE updated_at IS NULL;
      UPDATE organizations SET updated_at = created_at WHERE updated_at IS NULL;
      UPDATE organization_members SET role = 'member' WHERE role IS NULL OR trim(role) = '';
      UPDATE organization_members SET status = 'invited' WHERE status IS NULL OR trim(status) = '';
      UPDATE organization_members SET updated_at = created_at WHERE updated_at IS NULL;
      UPDATE project_members SET role = 'worker' WHERE role IS NULL OR trim(role) = '';
      UPDATE project_members SET status = 'invited' WHERE status IS NULL OR trim(status) = '';
      UPDATE project_members SET updated_at = created_at WHERE updated_at IS NULL;
      UPDATE project_phases SET user_id = '' WHERE user_id IS NULL;
      UPDATE project_phases SET status = 'pending' WHERE status IS NULL OR trim(status) = '';
      UPDATE project_phases SET weight = 0 WHERE weight IS NULL;
      UPDATE project_phases SET updated_at = created_at WHERE updated_at IS NULL;
    `);

    try {
      deduplicateUsersByIdentity();
    } catch (error) {
      console.log('User identity deduplication warning:', error);
    }

    // Create performance indexes (idempotent)
    try {
      db.execSync(`
        CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);
        CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at);
        CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
        CREATE INDEX IF NOT EXISTS idx_projects_user_updated ON projects(user_id, updated_at);
        CREATE INDEX IF NOT EXISTS idx_projects_organization ON projects(organization_id);
        CREATE INDEX IF NOT EXISTS idx_projects_visibility_updated ON projects(visibility, public_updated_at);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_public_slug_unique
          ON projects(public_slug)
          WHERE public_slug IS NOT NULL AND length(trim(public_slug)) > 0;
        CREATE INDEX IF NOT EXISTS idx_media_project_created_at ON media(project_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_media_user_project_created_at ON media(user_id, project_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_media_project_type_created_at ON media(project_id, type, created_at);
        CREATE INDEX IF NOT EXISTS idx_media_project_folder_created_at ON media(project_id, folder_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_media_project_note_present ON media(project_id) WHERE note IS NOT NULL AND length(trim(note)) > 0;
        CREATE INDEX IF NOT EXISTS idx_notes_user_project_created_at ON notes(user_id, project_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_notes_user_media_updated_at ON notes(user_id, media_id, updated_at);
        CREATE INDEX IF NOT EXISTS idx_folders_user_project ON folders(user_id, project_id);
        CREATE INDEX IF NOT EXISTS idx_activity_user_project_created_at ON activity_log(user_id, project_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_activity_project_created_at ON activity_log(project_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_activity_comments_user_project_created_at ON activity_comments(user_id, project_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_activity_comments_project_activity_created_at ON activity_comments(project_id, activity_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_activity_comments_activity_created_at ON activity_comments(activity_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_project_notifications_user_created
          ON project_notifications(user_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_project_notifications_user_read_created
          ON project_notifications(user_id, read_at, created_at DESC);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_user_id_unique
          ON users(auth_user_id)
          WHERE auth_user_id IS NOT NULL AND length(trim(auth_user_id)) > 0;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_provider_provider_id_unique
          ON users(provider, provider_id)
          WHERE provider IS NOT NULL AND length(trim(provider)) > 0
            AND provider_id IS NOT NULL AND length(trim(provider_id)) > 0;
        CREATE INDEX IF NOT EXISTS idx_organizations_owner ON organizations(owner_user_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_slug_unique
          ON organizations(slug)
          WHERE slug IS NOT NULL AND length(trim(slug)) > 0;
        CREATE INDEX IF NOT EXISTS idx_organization_members_org ON organization_members(organization_id);
        CREATE INDEX IF NOT EXISTS idx_organization_members_user ON organization_members(user_id);
        CREATE INDEX IF NOT EXISTS idx_organization_members_email ON organization_members(invited_email);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_members_org_user_unique
          ON organization_members(organization_id, user_id)
          WHERE user_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_project_public_profiles_project ON project_public_profiles(project_id);
        CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
        CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
        CREATE INDEX IF NOT EXISTS idx_project_members_invited_email ON project_members(invited_email);
        CREATE INDEX IF NOT EXISTS idx_project_phases_project ON project_phases(project_id);
        CREATE INDEX IF NOT EXISTS idx_project_phases_user_project ON project_phases(user_id, project_id);
        CREATE INDEX IF NOT EXISTS idx_project_phases_project_status ON project_phases(project_id, status);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_project_members_project_user_unique
          ON project_members(project_id, user_id) WHERE user_id IS NOT NULL;
      `);
    } catch (error) {
      console.log('Error creating indexes:', error);
    }
  }, 'Database migration', false);
}

export function getProjects(search?: string): Project[] {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    const projectAccessPredicate = getProjectAccessPredicate('p');
    const query = search
      ? `SELECT p.*, (
          SELECT MAX(a.created_at)
          FROM activity_log a
          WHERE a.project_id = p.id
            AND a.action_type NOT IN ('project_created', 'project_updated')
        ) AS last_activity_at
        FROM projects p
        WHERE ${projectAccessPredicate}
          AND (p.name LIKE ? OR COALESCE(p.client, '') LIKE ? OR COALESCE(p.location, '') LIKE ?)
        ORDER BY p.updated_at DESC, p.created_at DESC`
      : `SELECT p.*, (
          SELECT MAX(a.created_at)
          FROM activity_log a
          WHERE a.project_id = p.id
            AND a.action_type NOT IN ('project_created', 'project_updated')
        ) AS last_activity_at
        FROM projects p
        WHERE ${projectAccessPredicate}
        ORDER BY p.updated_at DESC, p.created_at DESC`;

    const params = search
      ? [userId, userId, `%${search}%`, `%${search}%`, `%${search}%`]
      : [userId, userId];
    const result = db.getAllSync(query, params) as Array<Record<string, unknown>>;
    return result.map(mapProjectRow);
  }, 'Get projects');
}

export function createProject(data: {
  name: string;
  client?: string;
  location?: string;
  organization_id?: string | null;
  start_date?: number | null;
  end_date?: number | null;
  budget?: number | null;
}): Project {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    const organizationId = typeof data.organization_id === 'string' ? data.organization_id : null;
    if (organizationId) {
      assertOrganizationAccess(organizationId, userId);
    }
    const id = createId();
    const created_at = Date.now();
    const updated_at = created_at;
    const status: ProjectStatus = 'neutral';
    const progress = 0;
    const start_date = data.start_date ?? created_at;
    const end_date = data.end_date ?? null;
    const budget = data.budget ?? null;

    db.runSync(
      'INSERT INTO projects (id, user_id, organization_id, name, client, location, status, progress, start_date, end_date, budget, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        userId,
        organizationId,
        data.name,
        data.client || null,
        data.location || null,
        status,
        progress,
        start_date,
        end_date,
        budget,
        created_at,
        updated_at,
      ]
    );

    logActivityInternal(id, 'project_created', id, {
      name: data.name,
      progress,
    }, created_at);

    if (activityActor?.userId) {
      const actorUser = getUserById(activityActor.userId);
      saveProjectMemberInternal({
        projectId: id,
        userId: activityActor.userId,
        invitedEmail: actorUser?.email ?? null,
        role: 'owner',
        status: 'active',
        userNameSnapshot: actorUser?.name ?? activityActor.name ?? null,
        userEmailSnapshot: actorUser?.email ?? null,
        acceptedAt: created_at,
      });
    }

    return {
      id,
      name: data.name,
      client: data.client,
      location: data.location,
      organization_id: organizationId,
      status,
      visibility: 'private',
      public_slug: null,
      public_published_at: null,
      public_updated_at: updated_at,
      progress,
      start_date,
      end_date,
      budget,
      last_activity_at: null,
      created_at,
      updated_at,
    };
  }, 'Create project');
}

export function updateProject(
  id: string,
  data: Partial<Omit<Project, 'id' | 'created_at' | 'updated_at' | 'status' | 'status_override' | 'last_activity_at' | 'progress'>>
): void {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    assertProjectAccess(id, userId);
    const updates: string[] = [];
    const values: Array<string | number | null> = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.client !== undefined) {
      updates.push('client = ?');
      values.push(data.client || null);
    }
    if (data.location !== undefined) {
      updates.push('location = ?');
      values.push(data.location || null);
    }
    if (data.organization_id !== undefined) {
      const organizationId = typeof data.organization_id === 'string' ? data.organization_id : null;
      if (organizationId) {
        assertOrganizationAccess(organizationId, userId);
      }
      updates.push('organization_id = ?');
      values.push(organizationId);
    }
    if (data.start_date !== undefined) {
      updates.push('start_date = ?');
      values.push(data.start_date ?? null);
    }
    if (data.end_date !== undefined) {
      updates.push('end_date = ?');
      values.push(data.end_date ?? null);
    }
    if (data.budget !== undefined) {
      updates.push('budget = ?');
      values.push(data.budget ?? null);
    }

    if (updates.length === 0) return;

    const updatedAt = Date.now();
    updates.push('updated_at = ?');
    values.push(updatedAt);

    values.push(id);
    values.push(userId);
    const query = `UPDATE projects SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`;
    db.runSync(query, values);

    logActivityInternal(id, 'project_updated', id, {
      fields: Object.keys(data),
    }, updatedAt);
  }, 'Update project');
}

export function setProjectCompletionState(projectId: string, completed: boolean): Project | null {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    assertProjectAccess(projectId, userId);

    const updatedAt = Date.now();
    if (completed) {
      db.runSync(
        'UPDATE projects SET status_override = ?, updated_at = ? WHERE id = ? AND user_id = ?',
        ['completed', updatedAt, projectId, userId]
      );
      logActivityInternal(projectId, 'project_marked_completed', projectId, null, updatedAt);
    } else {
      db.runSync(
        'UPDATE projects SET status_override = NULL, updated_at = ? WHERE id = ? AND user_id = ?',
        [updatedAt, projectId, userId]
      );
      logActivityInternal(projectId, 'project_reopened', projectId, null, updatedAt);
    }

    return getProjectById(projectId);
  }, 'Set project completion state');
}

export function mergeOrganizationSnapshotFromSupabase(data: {
  currentAuthUserId: string;
  organizations: RemoteOrganizationSyncRow[];
  members: RemoteOrganizationMemberSyncRow[];
}): void {
  return withErrorHandlingSync(() => {
    const scopedUserId = getScopedUserIdOrThrow();
    const scopedUser = getUserById(scopedUserId);
    const scopedAuthUserId = scopedUser?.authUserId?.trim() || data.currentAuthUserId.trim();

    const normalizeUserId = (
      remoteUserId?: string | null,
      options?: { fallbackEmail?: string | null; fallbackName?: string | null }
    ): string | null => {
      if (!remoteUserId) return null;
      const trimmed = remoteUserId.trim();
      if (!trimmed) return null;
      if (trimmed === scopedAuthUserId) {
        return scopedUserId;
      }
      const localUser = getUserByAuthUserId(trimmed);
      if (localUser?.id) {
        return localUser.id;
      }
      return ensureLocalUserReferenceFromAuthId(trimmed, options);
    };

    for (const organization of data.organizations) {
      const id = organization.id.trim();
      if (!id) continue;
      const name = organization.name.trim();
      if (!name) continue;
      const slug = normalizeOrganizationSlug(organization.slug ?? null);
      const ownerUserId = normalizeUserId(organization.owner_user_id, { fallbackName: 'Organization Owner' }) ?? scopedUserId;
      const createdAt = organization.created_at || Date.now();
      const updatedAt = organization.updated_at || createdAt;

      db.runSync(
        `INSERT INTO organizations (id, name, slug, owner_user_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           slug = excluded.slug,
           owner_user_id = excluded.owner_user_id,
           updated_at = excluded.updated_at`,
        [id, name, slug, ownerUserId, createdAt, updatedAt]
      );
    }

    for (const member of data.members) {
      const id = member.id.trim();
      const organizationId = member.organization_id.trim();
      if (!id || !organizationId) continue;
      const userId = normalizeUserId(member.user_id ?? null, {
        fallbackEmail: member.invited_email ?? null,
        fallbackName: 'Organization Member',
      });
      const invitedEmail = normalizeEmail(member.invited_email ?? null);
      const role = isOrganizationMemberRole(member.role) ? member.role : 'member';
      const status = isOrganizationMemberStatus(member.status) ? member.status : 'invited';
      const invitedBy = normalizeUserId(member.invited_by ?? null, { fallbackName: 'Organization Admin' });
      const createdAt = member.created_at || Date.now();
      const updatedAt = member.updated_at || createdAt;
      const acceptedAt = member.accepted_at ?? (status === 'active' ? updatedAt : null);

      if (userId) {
        const conflictingUserMembership = db.getFirstSync(
          `SELECT id
           FROM organization_members
           WHERE organization_id = ?
             AND user_id = ?
             AND id <> ?
           LIMIT 1`,
          [organizationId, userId, id]
        ) as Record<string, unknown> | null;
        if (conflictingUserMembership && typeof conflictingUserMembership.id === 'string') {
          db.runSync('DELETE FROM organization_members WHERE id = ?', [conflictingUserMembership.id]);
        }
      }

      db.runSync(
        `INSERT INTO organization_members
          (id, organization_id, user_id, invited_email, role, status, invited_by, created_at, updated_at, accepted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           organization_id = excluded.organization_id,
           user_id = excluded.user_id,
           invited_email = excluded.invited_email,
           role = excluded.role,
           status = excluded.status,
           invited_by = excluded.invited_by,
           updated_at = excluded.updated_at,
           accepted_at = excluded.accepted_at`,
        [id, organizationId, userId, invitedEmail, role, status, invitedBy, createdAt, updatedAt, acceptedAt]
      );
    }

    deduplicateMembershipRows();
  }, 'Merge organization snapshot from Supabase');
}

export function mergeProjectsAndActivitySnapshotFromSupabase(data: {
  currentAuthUserId: string;
  projects: RemoteProjectSyncRow[];
  activities: RemoteActivitySyncRow[];
}): void {
  return withErrorHandlingSync(() => {
    const scopedUserId = getScopedUserIdOrThrow();
    const scopedUser = getUserById(scopedUserId);
    const scopedAuthUserId = scopedUser?.authUserId?.trim() || data.currentAuthUserId.trim();

    const normalizeUserId = (remoteUserId?: string | null): string | null => {
      if (!remoteUserId) return null;
      const trimmed = remoteUserId.trim();
      if (!trimmed) return null;
      if (trimmed === scopedAuthUserId) {
        return scopedUserId;
      }
      const localUser = getUserByAuthUserId(trimmed);
      return localUser?.id ?? trimmed;
    };

    for (const project of data.projects) {
      const id = project.id.trim();
      const name = project.name.trim();
      if (!id || !name) continue;

      const ownerUserId = normalizeUserId(project.owner_user_id) ?? scopedUserId;
      const organizationId = typeof project.organization_id === 'string' ? project.organization_id.trim() || null : null;
      const status = normalizeProjectStatus(project.status);
      const statusOverride = normalizeProjectStatusOverride(project.status_override);
      const visibility: ProjectVisibility = project.visibility === 'public' ? 'public' : 'private';
      const publicSlug = typeof project.public_slug === 'string' ? project.public_slug.trim() || null : null;
      const progress = clampProgress(project.progress);
      const createdAt = project.created_at || Date.now();
      const updatedAt = project.updated_at || createdAt;
      const startDate = project.start_date ?? createdAt;
      const endDate = project.end_date ?? null;
      const budget = toNullableNumber(project.budget);
      const publicPublishedAt = project.public_published_at ?? null;
      const publicUpdatedAt = project.public_updated_at ?? updatedAt;

      db.runSync(
        `INSERT INTO projects
          (id, user_id, organization_id, name, client, location, visibility, public_slug, public_published_at, public_updated_at, status, status_override, progress, start_date, end_date, budget, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           user_id = excluded.user_id,
           organization_id = excluded.organization_id,
           name = excluded.name,
           client = excluded.client,
           location = excluded.location,
           visibility = excluded.visibility,
           public_slug = excluded.public_slug,
           public_published_at = excluded.public_published_at,
           public_updated_at = excluded.public_updated_at,
           status = excluded.status,
           status_override = excluded.status_override,
           progress = excluded.progress,
           start_date = excluded.start_date,
           end_date = excluded.end_date,
           budget = excluded.budget,
           updated_at = excluded.updated_at`,
        [
          id,
          ownerUserId,
          organizationId,
          name,
          project.client?.trim() || null,
          project.location?.trim() || null,
          visibility,
          publicSlug,
          publicPublishedAt,
          publicUpdatedAt,
          status,
          statusOverride,
          progress,
          startDate,
          endDate,
          budget,
          createdAt,
          updatedAt,
        ]
      );

    }

    for (const activity of data.activities) {
      const id = activity.id.trim();
      const projectId = activity.project_id.trim();
      const actionType = activity.action_type.trim();
      if (!id || !projectId || !actionType) continue;

      const projectRow = db.getFirstSync('SELECT user_id FROM projects WHERE id = ? LIMIT 1', [projectId]) as
        | Record<string, unknown>
        | null;
      const ownerUserId = normalizeScopedUserId(
        typeof projectRow?.user_id === 'string' ? projectRow.user_id : null
      ) ?? scopedUserId;

      const referenceId = normalizeActivityReferenceValue(activity.reference_id ?? null);
      const actorUserId = normalizeUserId(activity.actor_user_id ?? null);
      const actorNameSnapshot = activity.actor_name_snapshot?.trim() || null;
      const metadata = activity.metadata?.trim() || null;
      const createdAt = activity.created_at || Date.now();

      db.runSync(
        `INSERT INTO activity_log
          (id, user_id, project_id, action_type, reference_id, actor_user_id, actor_name_snapshot, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           user_id = excluded.user_id,
           project_id = excluded.project_id,
           action_type = excluded.action_type,
           reference_id = excluded.reference_id,
           actor_user_id = excluded.actor_user_id,
           actor_name_snapshot = excluded.actor_name_snapshot,
           metadata = excluded.metadata,
           created_at = excluded.created_at`,
        [id, ownerUserId, projectId, actionType, referenceId, actorUserId, actorNameSnapshot, metadata, createdAt]
      );
    }
  }, 'Merge projects and activity snapshot from Supabase');
}

export function mergeProjectNotificationsSnapshotFromSupabase(
  data: {
    currentAuthUserId: string;
    notifications: RemoteProjectNotificationSyncRow[];
  },
  options?: { pruneMissing?: boolean }
): void {
  return withErrorHandlingSync(() => {
    const scopedUserId = getScopedUserIdOrThrow();
    const scopedUser = getUserById(scopedUserId);
    const scopedAuthUserId = scopedUser?.authUserId?.trim() || data.currentAuthUserId.trim();
    const seenIds = new Set<string>();

    const normalizeActorUserId = (remoteUserId?: string | null): string | null => {
      if (!remoteUserId) return null;
      const trimmed = remoteUserId.trim();
      if (!trimmed) return null;
      if (trimmed === scopedAuthUserId) {
        return scopedUserId;
      }
      const localUser = getUserByAuthUserId(trimmed);
      return localUser?.id ?? null;
    };

    for (const notification of data.notifications) {
      const id = notification.id.trim();
      const projectId = notification.project_id.trim();
      const actionType = notification.action_type.trim();
      if (!id || !projectId || !actionType) continue;

      const recipientAuthUserId = notification.recipient_user_id?.trim() || '';
      if (recipientAuthUserId && recipientAuthUserId !== scopedAuthUserId) {
        continue;
      }

      const actorUserId = normalizeActorUserId(notification.actor_user_id ?? null);
      const title = typeof notification.title === 'string' ? notification.title.trim() || null : null;
      const body = typeof notification.body === 'string' ? notification.body.trim() || null : null;
      const metadata = typeof notification.metadata === 'string' ? notification.metadata : null;
      const readAt = notification.read_at ?? null;
      const createdAt = notification.created_at || Date.now();

      db.runSync(
        `INSERT INTO project_notifications
          (id, user_id, project_id, activity_id, actor_user_id, action_type, title, body, metadata, read_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           user_id = excluded.user_id,
           project_id = excluded.project_id,
           activity_id = excluded.activity_id,
           actor_user_id = excluded.actor_user_id,
           action_type = excluded.action_type,
           title = excluded.title,
           body = excluded.body,
           metadata = excluded.metadata,
           read_at = excluded.read_at,
           created_at = excluded.created_at`,
        [
          id,
          scopedUserId,
          projectId,
          notification.activity_id || null,
          actorUserId,
          actionType,
          title,
          body,
          metadata,
          readAt,
          createdAt,
        ]
      );
      seenIds.add(id);
    }

    if (options?.pruneMissing) {
      if (seenIds.size === 0) {
        db.runSync('DELETE FROM project_notifications WHERE user_id = ?', [scopedUserId]);
      } else {
        const placeholders = Array.from({ length: seenIds.size }, () => '?').join(', ');
        db.runSync(
          `DELETE FROM project_notifications
           WHERE user_id = ?
             AND id NOT IN (${placeholders})`,
          [scopedUserId, ...seenIds]
        );
      }
    }
  }, 'Merge project notifications snapshot from Supabase');
}

export function mergeProjectContentSnapshotFromSupabase(
  data: {
    projectId: string;
    folders: RemoteFolderSyncRow[];
    media: RemoteMediaSyncRow[];
  },
  options?: { pruneMissing?: boolean }
): void {
  return withErrorHandlingSync(() => {
    const scopedUserId = getScopedUserIdOrThrow();
    const projectId = data.projectId.trim();
    if (!projectId) return;

    const projectRow = db.getFirstSync(
      `SELECT id
       FROM projects
       WHERE id = ?
       LIMIT 1`,
      [projectId]
    ) as { id?: string } | null;
    if (!projectRow?.id) return;

    for (const folder of data.folders) {
      const id = folder.id.trim();
      const remoteProjectId = folder.project_id.trim();
      const name = folder.name.trim();
      if (!id || !remoteProjectId || !name) continue;
      if (remoteProjectId !== projectId) continue;

      const createdAt = folder.created_at || Date.now();
      db.runSync(
        `INSERT INTO folders (id, user_id, project_id, name, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           user_id = excluded.user_id,
           project_id = excluded.project_id,
           name = excluded.name`,
        [id, scopedUserId, projectId, name, createdAt]
      );
    }

    for (const mediaItem of data.media) {
      const id = mediaItem.id.trim();
      const remoteProjectId = mediaItem.project_id.trim();
      if (!id || !remoteProjectId) continue;
      if (remoteProjectId !== projectId) continue;

      const type = mediaItem.type === 'video' || mediaItem.type === 'doc' ? mediaItem.type : 'photo';
      const folderId = typeof mediaItem.folder_id === 'string' ? mediaItem.folder_id.trim() || null : null;
      const createdAt = mediaItem.created_at || Date.now();

      db.runSync(
        `INSERT INTO media (id, user_id, project_id, folder_id, type, uri, thumb_uri, note, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           user_id = excluded.user_id,
           project_id = excluded.project_id,
           folder_id = excluded.folder_id,
           type = excluded.type,
           uri = excluded.uri,
           thumb_uri = excluded.thumb_uri,
           note = excluded.note,
           metadata = excluded.metadata`,
        [
          id,
          scopedUserId,
          projectId,
          folderId,
          type,
          mediaItem.uri,
          mediaItem.thumb_uri || null,
          mediaItem.note || null,
          mediaItem.metadata || null,
          createdAt,
        ]
      );
    }

    if (!options?.pruneMissing) return;

    const remoteMediaIds = new Set(
      data.media
        .map((item) => item.id.trim())
        .filter((value) => value.length > 0)
    );
    const localMediaIds = db.getAllSync(
      `SELECT id
       FROM media
       WHERE project_id = ?
         AND user_id = ?`,
      [projectId, scopedUserId]
    ) as Array<Record<string, unknown>>;

    for (const row of localMediaIds) {
      const id = typeof row.id === 'string' ? row.id.trim() : '';
      if (!id || !isUuid(id)) continue;
      if (remoteMediaIds.has(id)) continue;
      db.runSync('DELETE FROM media WHERE id = ? AND user_id = ?', [id, scopedUserId]);
    }

    const remoteFolderIds = new Set(
      data.folders
        .map((item) => item.id.trim())
        .filter((value) => value.length > 0)
    );
    const localFolderIds = db.getAllSync(
      `SELECT id
       FROM folders
       WHERE project_id = ?
         AND user_id = ?`,
      [projectId, scopedUserId]
    ) as Array<Record<string, unknown>>;

    for (const row of localFolderIds) {
      const id = typeof row.id === 'string' ? row.id.trim() : '';
      if (!id || !isUuid(id)) continue;
      if (remoteFolderIds.has(id)) continue;
      db.runSync('UPDATE media SET folder_id = NULL WHERE folder_id = ? AND user_id = ?', [id, scopedUserId]);
      db.runSync('DELETE FROM folders WHERE id = ? AND user_id = ?', [id, scopedUserId]);
    }
  }, 'Merge project content snapshot from Supabase');
}

export function mergeProjectNotesSnapshotFromSupabase(
  data: {
    currentAuthUserId: string;
    projectId: string;
    notes: RemoteNoteSyncRow[];
  },
  options?: { pruneMissing?: boolean }
): void {
  return withErrorHandlingSync(() => {
    const scopedUserId = getScopedUserIdOrThrow();
    const scopedUser = getUserById(scopedUserId);
    const scopedAuthUserId = scopedUser?.authUserId?.trim() || data.currentAuthUserId.trim();
    const projectId = data.projectId.trim();
    if (!projectId) return;

    const projectRow = db.getFirstSync(
      `SELECT id
       FROM projects
       WHERE id = ?
       LIMIT 1`,
      [projectId]
    ) as { id?: string } | null;
    if (!projectRow?.id) return;

    const normalizeUserId = (remoteUserId?: string | null): string | null => {
      if (!remoteUserId) return null;
      const trimmed = remoteUserId.trim();
      if (!trimmed) return null;
      if (trimmed === scopedAuthUserId) return scopedUserId;
      const localUser = getUserByAuthUserId(trimmed);
      return localUser?.id ?? trimmed;
    };

    for (const note of data.notes) {
      const id = note.id.trim();
      const remoteProjectId = note.project_id.trim();
      const content = note.content.trim();
      if (!id || !remoteProjectId || !content) continue;
      if (remoteProjectId !== projectId) continue;

      const mediaId = typeof note.media_id === 'string' ? note.media_id.trim() || null : null;
      const authorUserId = normalizeUserId(note.author_user_id) ?? null;
      const title = typeof note.title === 'string' ? note.title.trim() || null : null;
      const createdAt = note.created_at || Date.now();
      const updatedAt = note.updated_at || createdAt;

      db.runSync(
        `INSERT INTO notes (id, user_id, project_id, media_id, author_user_id, title, content, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           user_id = excluded.user_id,
           project_id = excluded.project_id,
           media_id = excluded.media_id,
           author_user_id = excluded.author_user_id,
           title = excluded.title,
           content = excluded.content,
           created_at = excluded.created_at,
           updated_at = excluded.updated_at`,
        [id, scopedUserId, projectId, mediaId, authorUserId, title, content, createdAt, updatedAt]
      );
    }

    if (!options?.pruneMissing) return;
    const remoteNoteIds = new Set(
      data.notes
        .map((note) => note.id.trim())
        .filter((value) => value.length > 0)
    );
    const localNoteIds = db.getAllSync(
      `SELECT id
       FROM notes
       WHERE project_id = ?
         AND user_id = ?`,
      [projectId, scopedUserId]
    ) as Array<Record<string, unknown>>;

    for (const row of localNoteIds) {
      const id = typeof row.id === 'string' ? row.id.trim() : '';
      if (!id || !isUuid(id)) continue;
      if (remoteNoteIds.has(id)) continue;
      db.runSync('DELETE FROM notes WHERE id = ? AND user_id = ?', [id, scopedUserId]);
    }
  }, 'Merge project notes snapshot from Supabase');
}

export function mergeProjectActivityCommentsSnapshotFromSupabase(
  data: {
    currentAuthUserId: string;
    projectId: string;
    comments: RemoteActivityCommentSyncRow[];
  },
  options?: { pruneMissing?: boolean }
): void {
  return withErrorHandlingSync(() => {
    const scopedUserId = getScopedUserIdOrThrow();
    const scopedUser = getUserById(scopedUserId);
    const scopedAuthUserId = scopedUser?.authUserId?.trim() || data.currentAuthUserId.trim();
    const projectId = data.projectId.trim();
    if (!projectId) return;

    const projectRow = db.getFirstSync(
      `SELECT id
       FROM projects
       WHERE id = ?
       LIMIT 1`,
      [projectId]
    ) as { id?: string } | null;
    if (!projectRow?.id) return;

    const normalizeUserId = (remoteUserId?: string | null): string | null => {
      if (!remoteUserId) return null;
      const trimmed = remoteUserId.trim();
      if (!trimmed) return null;
      if (trimmed === scopedAuthUserId) return scopedUserId;
      const localUser = getUserByAuthUserId(trimmed);
      return localUser?.id ?? trimmed;
    };

    for (const comment of data.comments) {
      const id = comment.id.trim();
      const remoteProjectId = comment.project_id.trim();
      const activityId = comment.activity_id.trim();
      const body = comment.body.trim();
      if (!id || !remoteProjectId || !activityId || !body) continue;
      if (remoteProjectId !== projectId) continue;

      const authorUserId = normalizeUserId(comment.author_user_id) ?? null;
      const authorNameSnapshot =
        typeof comment.author_name_snapshot === 'string' ? comment.author_name_snapshot.trim() || null : null;
      const createdAt = comment.created_at || Date.now();
      const updatedAt = comment.updated_at || createdAt;

      db.runSync(
        `INSERT INTO activity_comments
          (id, user_id, project_id, activity_id, author_user_id, author_name_snapshot, body, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           user_id = excluded.user_id,
           project_id = excluded.project_id,
           activity_id = excluded.activity_id,
           author_user_id = excluded.author_user_id,
           author_name_snapshot = excluded.author_name_snapshot,
           body = excluded.body,
           created_at = excluded.created_at,
           updated_at = excluded.updated_at`,
        [id, scopedUserId, projectId, activityId, authorUserId, authorNameSnapshot, body, createdAt, updatedAt]
      );
    }

    if (!options?.pruneMissing) return;
    const remoteCommentIds = new Set(
      data.comments
        .map((comment) => comment.id.trim())
        .filter((value) => value.length > 0)
    );
    const localCommentIds = db.getAllSync(
      `SELECT id
       FROM activity_comments
       WHERE project_id = ?
         AND user_id = ?`,
      [projectId, scopedUserId]
    ) as Array<Record<string, unknown>>;

    for (const row of localCommentIds) {
      const id = typeof row.id === 'string' ? row.id.trim() : '';
      if (!id || !isUuid(id)) continue;
      if (remoteCommentIds.has(id)) continue;
      db.runSync('DELETE FROM activity_comments WHERE id = ? AND user_id = ?', [id, scopedUserId]);
    }
  }, 'Merge project activity comments snapshot from Supabase');
}

export function mergeProjectMembersSnapshotFromSupabase(
  data: {
    currentAuthUserId: string;
    projectId: string;
    members: RemoteProjectMemberSyncRow[];
  },
  options?: { pruneMissing?: boolean }
): void {
  return withErrorHandlingSync(() => {
    const scopedUserId = getScopedUserIdOrThrow();
    const scopedUser = getUserById(scopedUserId);
    const scopedAuthUserId = scopedUser?.authUserId?.trim() || data.currentAuthUserId.trim();
    const projectId = data.projectId.trim();
    if (!projectId) return;

    const projectRow = db.getFirstSync(
      `SELECT id
       FROM projects
       WHERE id = ?
       LIMIT 1`,
      [projectId]
    ) as { id?: string } | null;
    if (!projectRow?.id) return;

    const normalizeUserId = (
      remoteUserId?: string | null,
      options?: { fallbackEmail?: string | null; fallbackName?: string | null }
    ): string | null => {
      if (!remoteUserId) return null;
      const trimmed = remoteUserId.trim();
      if (!trimmed) return null;
      if (trimmed === scopedAuthUserId) {
        return scopedUserId;
      }
      const localUser = getUserByAuthUserId(trimmed);
      if (localUser?.id) {
        return localUser.id;
      }
      return ensureLocalUserReferenceFromAuthId(trimmed, options);
    };

    for (const member of data.members) {
      const id = member.id.trim();
      const remoteProjectId = member.project_id.trim();
      if (!id || !remoteProjectId) continue;
      if (remoteProjectId !== projectId) continue;

      const userId = normalizeUserId(member.user_id ?? null, {
        fallbackEmail: member.user_email_snapshot ?? member.invited_email ?? null,
        fallbackName: member.user_name_snapshot ?? 'Project Member',
      });
      const invitedEmail = normalizeEmail(member.invited_email ?? null);
      if (!userId && !invitedEmail) continue;

      const role = isProjectMemberRole(member.role) ? member.role : 'worker';
      const status = isProjectMemberStatus(member.status) ? member.status : 'invited';
      const invitedBy = normalizeUserId(member.invited_by ?? null, { fallbackName: 'Project Manager' });
      const userNameSnapshot = member.user_name_snapshot?.trim() || null;
      const userEmailSnapshot = normalizeEmail(member.user_email_snapshot ?? null) || invitedEmail;
      const createdAt = member.created_at || Date.now();
      const updatedAt = member.updated_at || createdAt;
      const acceptedAt = member.accepted_at ?? (status === 'active' ? updatedAt : null);

      if (userId) {
        const conflictingUserMembership = db.getFirstSync(
          `SELECT id
           FROM project_members
           WHERE project_id = ?
             AND user_id = ?
             AND id <> ?
           LIMIT 1`,
          [projectId, userId, id]
        ) as Record<string, unknown> | null;
        if (conflictingUserMembership && typeof conflictingUserMembership.id === 'string') {
          db.runSync('DELETE FROM project_members WHERE id = ?', [conflictingUserMembership.id]);
        }
      }

      db.runSync(
        `INSERT INTO project_members
          (id, project_id, user_id, invited_email, role, status, invited_by, user_name_snapshot, user_email_snapshot, created_at, updated_at, accepted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           project_id = excluded.project_id,
           user_id = excluded.user_id,
           invited_email = excluded.invited_email,
           role = excluded.role,
           status = excluded.status,
           invited_by = excluded.invited_by,
           user_name_snapshot = excluded.user_name_snapshot,
           user_email_snapshot = excluded.user_email_snapshot,
           created_at = excluded.created_at,
           updated_at = excluded.updated_at,
           accepted_at = excluded.accepted_at`,
        [
          id,
          projectId,
          userId,
          invitedEmail,
          role,
          status,
          invitedBy,
          userNameSnapshot,
          userEmailSnapshot,
          createdAt,
          updatedAt,
          acceptedAt,
        ]
      );
    }

    if (options?.pruneMissing) {
      const remoteMemberIds = new Set(
        data.members
          .map((member) => member.id.trim())
          .filter((value) => value.length > 0)
      );

      const localMemberIds = db.getAllSync(
        `SELECT id
         FROM project_members
         WHERE project_id = ?`,
        [projectId]
      ) as Array<Record<string, unknown>>;

      for (const row of localMemberIds) {
        const id = typeof row.id === 'string' ? row.id.trim() : '';
        if (!id || !isUuid(id)) continue;
        if (remoteMemberIds.has(id)) continue;
        db.runSync('DELETE FROM project_members WHERE id = ?', [id]);
      }
    }

    deduplicateMembershipRows();
  }, 'Merge project members snapshot from Supabase');
}

export function mergeProjectPublicProfileSnapshotFromSupabase(
  projectId: string,
  profile: RemoteProjectPublicProfileSyncRow | null
): void {
  return withErrorHandlingSync(() => {
    const normalizedProjectId = projectId.trim();
    if (!normalizedProjectId) return;

    if (!profile) {
      db.runSync('DELETE FROM project_public_profiles WHERE project_id = ?', [normalizedProjectId]);
      return;
    }

    const createdAt = profile.created_at || Date.now();
    const updatedAt = profile.updated_at || createdAt;

    db.runSync(
      `INSERT INTO project_public_profiles
        (project_id, public_title, summary, city, region, category, hero_media_id, hero_comment, contact_email, contact_phone, website_url, highlights_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(project_id) DO UPDATE SET
         public_title = excluded.public_title,
         summary = excluded.summary,
         city = excluded.city,
         region = excluded.region,
         category = excluded.category,
         hero_media_id = excluded.hero_media_id,
         hero_comment = excluded.hero_comment,
         contact_email = excluded.contact_email,
         contact_phone = excluded.contact_phone,
         website_url = excluded.website_url,
         highlights_json = excluded.highlights_json,
         updated_at = excluded.updated_at`,
      [
        normalizedProjectId,
        profile.public_title?.trim() || null,
        profile.summary?.trim() || null,
        profile.city?.trim() || null,
        profile.region?.trim() || null,
        profile.category?.trim() || null,
        profile.hero_media_id || null,
        profile.hero_comment?.trim() || null,
        profile.contact_email?.trim() || null,
        profile.contact_phone?.trim() || null,
        profile.website_url?.trim() || null,
        profile.highlights_json || null,
        createdAt,
        updatedAt,
      ]
    );
  }, 'Merge project public profile snapshot from Supabase');
}

export function deleteProject(id: string) {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    assertProjectAccess(id, userId);
    db.runSync('DELETE FROM projects WHERE id = ? AND user_id = ?', [id, userId]);
  }, 'Delete project');
}

export function getProjectById(id: string): Project | null {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    const projectAccessPredicate = getProjectAccessPredicate('p');
    const result = db.getFirstSync(
      `SELECT p.*, (
        SELECT MAX(a.created_at)
        FROM activity_log a
        WHERE a.project_id = p.id
          AND a.action_type NOT IN ('project_created', 'project_updated')
      ) AS last_activity_at
      FROM projects p
      WHERE p.id = ?
        AND ${projectAccessPredicate}`,
      [id, userId, userId]
    ) as Record<string, unknown> | null;
    return result ? mapProjectRow(result) : null;
  }, 'Get project by ID');
}

export function computeProjectProgress(projectId: string): ProjectProgressComputation | null {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    const projectAccessPredicate = getProjectAccessPredicate('p');
    const row = db.getFirstSync(
      `SELECT p.*, (
        SELECT MAX(a.created_at)
        FROM activity_log a
        WHERE a.project_id = p.id
          AND a.action_type NOT IN ('project_created', 'project_updated')
      ) AS last_activity_at
      FROM projects p
      WHERE p.id = ?
        AND ${projectAccessPredicate}`,
      [projectId, userId, userId]
    ) as Record<string, unknown> | null;

    if (!row) {
      return null;
    }

    return computeProjectProgressInternal({
      projectId,
      endDate: toNullableNumber(row.end_date),
      legacyProgress: clampProgress(row.progress),
      lastActivityAt: toNullableNumber(row.last_activity_at),
      scopedUserId: undefined,
      statusOverride: normalizeProjectStatusOverride(row.status_override),
    });
  }, 'Compute project progress');
}

export function createOrganization(data: {
  name: string;
  slug?: string | null;
}): Organization {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    const now = Date.now();
    const id = createId();
    const name = data.name.trim();
    if (!name) {
      throw new Error('Organization name is required');
    }

    const slug = normalizeOrganizationSlug(data.slug ?? name) || `org-${id.slice(0, 10)}`;
    assertOrganizationUniqueness({ name, slug });

    try {
      db.runSync(
        `INSERT INTO organizations (id, name, slug, owner_user_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, name, slug, userId, now, now]
      );
    } catch (error) {
      const message = extractErrorMessage(error);
      if (message.includes('UNIQUE constraint failed')) {
        throw new Error('Organization name or slug is already in use');
      }
      throw error;
    }

    const ownerMemberId = createId();
    db.runSync(
      `INSERT INTO organization_members
        (id, organization_id, user_id, invited_email, role, status, invited_by, created_at, updated_at, accepted_at)
       VALUES (?, ?, ?, NULL, 'owner', 'active', ?, ?, ?, ?)`,
      [ownerMemberId, id, userId, userId, now, now, now]
    );

    return {
      id,
      name,
      slug,
      owner_user_id: userId,
      created_at: now,
      updated_at: now,
    };
  }, 'Create organization');
}

export function getOrganizationsForCurrentUser(): Organization[] {
  return withErrorHandlingSync(() => {
    const userId = getActiveUserScope()?.trim();
    if (!userId) {
      return [];
    }
    const rows = db.getAllSync(
      `SELECT o.*
       FROM organizations o
       INNER JOIN organization_members m ON m.organization_id = o.id
       WHERE m.user_id = ?
         AND m.status = 'active'
       ORDER BY o.updated_at DESC, o.created_at DESC`,
      [userId]
    ) as Array<Record<string, unknown>>;
    return rows.map(mapOrganizationRow);
  }, 'Get organizations for current user');
}

export function getOrganizationById(id: string): Organization | null {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    const row = db.getFirstSync(
      `SELECT o.*
       FROM organizations o
       INNER JOIN organization_members m ON m.organization_id = o.id
       WHERE o.id = ?
         AND m.user_id = ?
         AND m.status = 'active'
       LIMIT 1`,
      [id, userId]
    ) as Record<string, unknown> | null;
    return row ? mapOrganizationRow(row) : null;
  }, 'Get organization by ID');
}

export function updateOrganizationName(id: string, name: string): Organization | null {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    assertOrganizationManagementAccess(id, userId);

    const nextName = name.trim();
    if (!nextName) {
      throw new Error('Organization name is required');
    }
    assertOrganizationUniqueness({ name: nextName, excludeId: id });

    const updatedAt = Date.now();
    db.runSync('UPDATE organizations SET name = ?, updated_at = ? WHERE id = ?', [nextName, updatedAt, id]);
    return getOrganizationById(id);
  }, 'Update organization name');
}

export function deleteOrganizationForCurrentUser(organizationId: string): void {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    const normalizedId = organizationId.trim();
    if (!normalizedId) return;

    const row = db.getFirstSync(
      'SELECT id, owner_user_id FROM organizations WHERE id = ? LIMIT 1',
      [normalizedId]
    ) as { id?: string; owner_user_id?: string } | null;

    if (!row?.id) return;
    if (row.owner_user_id !== userId) {
      throw new Error('Only organization owner can delete organization');
    }

    db.runSync('DELETE FROM organizations WHERE id = ?', [normalizedId]);
  }, 'Delete organization');
}

export function getOrganizationMembers(
  organizationId: string,
  options?: { includeRemoved?: boolean }
): OrganizationMember[] {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    assertOrganizationAccess(organizationId, userId);
    const whereRemoved = options?.includeRemoved ? '' : `AND status <> 'removed'`;
    const rows = db.getAllSync(
      `SELECT *
       FROM organization_members
       WHERE organization_id = ?
       ${whereRemoved}
       ORDER BY
         CASE role
           WHEN 'owner' THEN 0
           WHEN 'admin' THEN 1
           WHEN 'member' THEN 2
           ELSE 3
         END ASC,
         created_at ASC`,
      [organizationId]
    ) as Array<Record<string, unknown>>;
    return rows.map(mapOrganizationMemberRow);
  }, 'Get organization members');
}

export function setOrganizationMemberRole(
  organizationId: string,
  memberId: string,
  role: OrganizationMemberRole
): OrganizationMember | null {
  return withErrorHandlingSync(() => {
    const currentUserId = getScopedUserIdOrThrow();
    const actingMembership = assertOrganizationManagementAccess(organizationId, currentUserId);

    const existing = db.getFirstSync(
      `SELECT *
       FROM organization_members
       WHERE organization_id = ? AND id = ?
       LIMIT 1`,
      [organizationId, memberId]
    ) as Record<string, unknown> | null;
    if (!existing) return null;

    const member = mapOrganizationMemberRow(existing);
    if (member.status === 'removed') {
      throw new Error('Cannot update a removed member');
    }
    if (member.role === role) {
      return member;
    }

    if (actingMembership.role === 'admin') {
      if (member.role === 'owner' || member.role === 'admin') {
        throw new Error('Only owner can change owner/admin roles');
      }
      if (role === 'owner' || role === 'admin') {
        throw new Error('Only owner can assign owner/admin roles');
      }
    }

    if (member.role === 'owner' && role !== 'owner' && member.status === 'active') {
      const owners = db.getFirstSync(
        `SELECT COUNT(*) AS count
         FROM organization_members
         WHERE organization_id = ?
           AND role = 'owner'
           AND status = 'active'`,
        [organizationId]
      ) as { count?: number } | null;
      if ((owners?.count ?? 0) <= 1) {
        throw new Error('Cannot demote the last active owner');
      }
    }

    const now = Date.now();
    db.runSync(
      `UPDATE organization_members
       SET role = ?, updated_at = ?
       WHERE id = ?`,
      [role, now, member.id]
    );

    const updated = db.getFirstSync('SELECT * FROM organization_members WHERE id = ? LIMIT 1', [member.id]) as
      | Record<string, unknown>
      | null;
    if (!updated) {
      throw new Error('Unable to update organization member role');
    }
    return mapOrganizationMemberRow(updated);
  }, 'Set organization member role');
}

export function removeOrganizationMember(organizationId: string, memberId: string): void {
  return withErrorHandlingSync(() => {
    const currentUserId = getScopedUserIdOrThrow();
    const actingMembership = assertOrganizationManagementAccess(organizationId, currentUserId);

    const existing = db.getFirstSync(
      `SELECT *
       FROM organization_members
       WHERE organization_id = ? AND id = ?
       LIMIT 1`,
      [organizationId, memberId]
    ) as Record<string, unknown> | null;
    if (!existing) return;

    const member = mapOrganizationMemberRow(existing);
    if (member.status === 'removed') return;

    if (actingMembership.role === 'admin' && (member.role === 'owner' || member.role === 'admin')) {
      throw new Error('Only owner can remove owner/admin members');
    }

    if (member.role === 'owner' && member.status === 'active') {
      const owners = db.getFirstSync(
        `SELECT COUNT(*) AS count
         FROM organization_members
         WHERE organization_id = ?
           AND role = 'owner'
           AND status = 'active'`,
        [organizationId]
      ) as { count?: number } | null;
      if ((owners?.count ?? 0) <= 1) {
        throw new Error('Cannot remove the last active owner');
      }
    }

    const now = Date.now();
    db.runSync(
      `UPDATE organization_members
       SET status = 'removed', updated_at = ?
       WHERE id = ?`,
      [now, member.id]
    );
  }, 'Remove organization member');
}

export function upsertOrganizationMember(data: {
  organizationId: string;
  userId: string;
  role?: OrganizationMemberRole;
  status?: OrganizationMemberStatus;
  invitedBy?: string | null;
}): OrganizationMember {
  return withErrorHandlingSync(() => {
    const currentUserId = getScopedUserIdOrThrow();
    assertOrganizationManagementAccess(data.organizationId, currentUserId);

    const role = data.role ?? 'member';
    const status = data.status ?? 'active';
    const now = Date.now();
    const existing = db.getFirstSync(
      `SELECT *
       FROM organization_members
       WHERE organization_id = ? AND user_id = ?
       ORDER BY created_at ASC
       LIMIT 1`,
      [data.organizationId, data.userId]
    ) as Record<string, unknown> | null;

    if (existing) {
      const previous = mapOrganizationMemberRow(existing);
      db.runSync(
        `UPDATE organization_members
         SET role = ?,
             status = ?,
             invited_by = ?,
             updated_at = ?,
             accepted_at = ?
         WHERE id = ?`,
        [role, status, data.invitedBy ?? previous.invited_by ?? null, now, status === 'active' ? now : null, previous.id]
      );
      const updated = db.getFirstSync('SELECT * FROM organization_members WHERE id = ?', [previous.id]) as
        | Record<string, unknown>
        | null;
      if (!updated) {
        throw new Error('Unable to update organization member');
      }
      return mapOrganizationMemberRow(updated);
    }

    const id = createId();
    db.runSync(
      `INSERT INTO organization_members
        (id, organization_id, user_id, invited_email, role, status, invited_by, created_at, updated_at, accepted_at)
       VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)`,
      [id, data.organizationId, data.userId, role, status, data.invitedBy ?? null, now, now, status === 'active' ? now : null]
    );
    const created = db.getFirstSync('SELECT * FROM organization_members WHERE id = ?', [id]) as Record<string, unknown> | null;
    if (!created) {
      throw new Error('Unable to create organization member');
    }
    return mapOrganizationMemberRow(created);
  }, 'Upsert organization member');
}

export function inviteOrganizationMember(data: {
  organizationId: string;
  email: string;
  role?: Exclude<OrganizationMemberRole, 'owner'>;
  invitedBy?: string | null;
}): OrganizationMember {
  return withErrorHandlingSync(() => {
    const currentUserId = getScopedUserIdOrThrow();
    assertOrganizationManagementAccess(data.organizationId, currentUserId);

    const normalizedEmail = normalizeEmail(data.email);
    if (!normalizedEmail) {
      throw new Error('Invite email is required');
    }

    const role = data.role ?? 'member';
    const now = Date.now();
    const existing = db.getFirstSync(
      `SELECT *
       FROM organization_members
       WHERE organization_id = ?
         AND LOWER(COALESCE(invited_email, '')) = ?
       ORDER BY created_at ASC
       LIMIT 1`,
      [data.organizationId, normalizedEmail]
    ) as Record<string, unknown> | null;

    if (existing) {
      const previous = mapOrganizationMemberRow(existing);
      db.runSync(
        `UPDATE organization_members
         SET role = ?,
             status = 'invited',
             invited_email = ?,
             invited_by = ?,
             updated_at = ?,
             accepted_at = NULL
         WHERE id = ?`,
        [role, normalizedEmail, data.invitedBy ?? previous.invited_by ?? null, now, previous.id]
      );
      const updated = db.getFirstSync('SELECT * FROM organization_members WHERE id = ?', [previous.id]) as
        | Record<string, unknown>
        | null;
      if (!updated) {
        throw new Error('Unable to update organization invite');
      }
      return mapOrganizationMemberRow(updated);
    }

    const id = createId();
    db.runSync(
      `INSERT INTO organization_members
        (id, organization_id, user_id, invited_email, role, status, invited_by, created_at, updated_at, accepted_at)
       VALUES (?, ?, NULL, ?, ?, 'invited', ?, ?, ?, NULL)`,
      [id, data.organizationId, normalizedEmail, role, data.invitedBy ?? null, now, now]
    );
    const created = db.getFirstSync('SELECT * FROM organization_members WHERE id = ?', [id]) as Record<string, unknown> | null;
    if (!created) {
      throw new Error('Unable to invite organization member');
    }
    return mapOrganizationMemberRow(created);
  }, 'Invite organization member');
}

export function getPendingOrganizationInvitesForCurrentUser(): OrganizationInvite[] {
  return withErrorHandlingSync(() => {
    const userId = getActiveUserScope()?.trim();
    if (!userId) {
      return [];
    }
    const userEmail = getCurrentScopedUserEmail(userId);
    if (!userEmail) {
      return [];
    }

    const rows = db.getAllSync(
      `SELECT
         m.*,
         o.name AS organization_name
       FROM organization_members m
       INNER JOIN organizations o ON o.id = m.organization_id
       WHERE m.status = 'invited'
         AND LOWER(COALESCE(m.invited_email, '')) = ?
       ORDER BY m.updated_at DESC, m.created_at DESC`,
      [userEmail]
    ) as Array<Record<string, unknown>>;

    return rows.map(mapOrganizationInviteRow);
  }, 'Get pending organization invites');
}

export function acceptOrganizationInvite(inviteId: string): OrganizationMember {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    const userEmail = getCurrentScopedUserEmail(userId);
    if (!userEmail) {
      throw new Error('No email found for current user');
    }

    const inviteRow = db.getFirstSync(
      `SELECT *
       FROM organization_members
       WHERE id = ?
         AND status = 'invited'
         AND LOWER(COALESCE(invited_email, '')) = ?
       LIMIT 1`,
      [inviteId, userEmail]
    ) as Record<string, unknown> | null;

    if (!inviteRow) {
      throw new Error('Invitation not found or no longer valid');
    }

    const invite = mapOrganizationMemberRow(inviteRow);
    const existingForUser = db.getFirstSync(
      `SELECT *
       FROM organization_members
       WHERE organization_id = ?
         AND user_id = ?
       ORDER BY created_at ASC
       LIMIT 1`,
      [invite.organization_id, userId]
    ) as Record<string, unknown> | null;

    const now = Date.now();
    if (existingForUser) {
      const existing = mapOrganizationMemberRow(existingForUser);
      db.runSync(
        `UPDATE organization_members
         SET role = ?,
             status = 'active',
             invited_email = ?,
             updated_at = ?,
             accepted_at = ?
         WHERE id = ?`,
        [invite.role, userEmail, now, now, existing.id]
      );
      db.runSync('DELETE FROM organization_members WHERE id = ?', [inviteId]);

      const updated = db.getFirstSync('SELECT * FROM organization_members WHERE id = ? LIMIT 1', [existing.id]) as
        | Record<string, unknown>
        | null;
      if (!updated) {
        throw new Error('Unable to finalize organization membership');
      }
      return mapOrganizationMemberRow(updated);
    }

    db.runSync(
      `UPDATE organization_members
       SET user_id = ?,
           invited_email = ?,
           status = 'active',
           updated_at = ?,
           accepted_at = ?
       WHERE id = ?`,
      [userId, userEmail, now, now, inviteId]
    );

    const accepted = db.getFirstSync('SELECT * FROM organization_members WHERE id = ? LIMIT 1', [inviteId]) as
      | Record<string, unknown>
      | null;
    if (!accepted) {
      throw new Error('Unable to accept invitation');
    }
    return mapOrganizationMemberRow(accepted);
  }, 'Accept organization invite');
}

export function setProjectOrganization(projectId: string, organizationId: string | null): void {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    assertProjectAccess(projectId, userId);
    const normalizedOrgId = organizationId?.trim() || null;
    if (normalizedOrgId) {
      assertOrganizationAccess(normalizedOrgId, userId);
    }

    const updatedAt = Date.now();
    db.runSync(
      'UPDATE projects SET organization_id = ?, updated_at = ? WHERE id = ? AND user_id = ?',
      [normalizedOrgId, updatedAt, projectId, userId]
    );

    logActivityInternal(projectId, 'project_organization_updated', projectId, {
      organization_id: normalizedOrgId,
    }, updatedAt);
  }, 'Set project organization');
}

export function getProjectsByOrganization(organizationId: string): Project[] {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    assertOrganizationAccess(organizationId, userId);
    const projectAccessPredicate = getProjectAccessPredicate('p');

    const rows = db.getAllSync(
      `SELECT p.*, (
        SELECT MAX(a.created_at)
        FROM activity_log a
        WHERE a.project_id = p.id
          AND a.action_type NOT IN ('project_created', 'project_updated')
      ) AS last_activity_at
      FROM projects p
      WHERE p.organization_id = ?
        AND ${projectAccessPredicate}
      ORDER BY p.updated_at DESC, p.created_at DESC`,
      [organizationId, userId, userId]
    ) as Array<Record<string, unknown>>;

    return rows.map(mapProjectRow);
  }, 'Get projects by organization');
}

export function getProjectPublicProfile(projectId: string): ProjectPublicProfile | null {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    assertProjectPublishAccess(projectId, userId);

    const row = db.getFirstSync(
      'SELECT * FROM project_public_profiles WHERE project_id = ? LIMIT 1',
      [projectId]
    ) as Record<string, unknown> | null;
    return row ? mapProjectPublicProfileRow(row) : null;
  }, 'Get project public profile');
}

export function getProjectPublicReadiness(
  projectId: string,
  options?: { slug?: string | null }
): ProjectPublicReadiness {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    assertProjectPublishAccess(projectId, userId);
    return computeProjectPublicReadiness(projectId, options?.slug ?? null);
  }, 'Get project public readiness');
}

export function upsertProjectPublicProfile(
  projectId: string,
  data: Partial<
    Omit<ProjectPublicProfile, 'project_id' | 'created_at' | 'updated_at' | 'hero_media_id'> & {
      hero_media_id?: string | null;
      highlights?: string[] | null;
    }
  >
): ProjectPublicProfile {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    const project = assertProjectPublishAccess(projectId, userId);
    const projectOwnerUserId = typeof project.user_id === 'string' ? project.user_id : '';

    if (data.hero_media_id) {
      const heroMedia = db.getFirstSync(
        'SELECT id FROM media WHERE id = ? AND project_id = ? AND user_id = ? LIMIT 1',
        [data.hero_media_id, projectId, projectOwnerUserId]
      ) as { id?: string } | null;
      if (!heroMedia?.id) {
        throw new Error('Hero media must belong to this project');
      }
    }

    const now = Date.now();
    const existing = db.getFirstSync(
      'SELECT * FROM project_public_profiles WHERE project_id = ? LIMIT 1',
      [projectId]
    ) as Record<string, unknown> | null;

    const highlightsJson =
      data.highlights === undefined
        ? undefined
        : data.highlights === null
          ? null
          : JSON.stringify(data.highlights.slice(0, 8));

    if (existing) {
      const updates: string[] = [];
      const values: Array<string | number | null> = [];

      if (data.public_title !== undefined) {
        updates.push('public_title = ?');
        values.push(data.public_title?.trim() || null);
      }
      if (data.summary !== undefined) {
        updates.push('summary = ?');
        values.push(data.summary?.trim() || null);
      }
      if (data.city !== undefined) {
        updates.push('city = ?');
        values.push(data.city?.trim() || null);
      }
      if (data.region !== undefined) {
        updates.push('region = ?');
        values.push(data.region?.trim() || null);
      }
      if (data.category !== undefined) {
        updates.push('category = ?');
        values.push(data.category?.trim() || null);
      }
      if (data.hero_media_id !== undefined) {
        updates.push('hero_media_id = ?');
        values.push(data.hero_media_id || null);
      }
      if (data.hero_comment !== undefined) {
        updates.push('hero_comment = ?');
        values.push(data.hero_comment?.trim() || null);
      }
      if (data.contact_email !== undefined) {
        updates.push('contact_email = ?');
        values.push(normalizeEmail(data.contact_email) || null);
      }
      if (data.contact_phone !== undefined) {
        updates.push('contact_phone = ?');
        values.push(data.contact_phone?.trim() || null);
      }
      if (data.website_url !== undefined) {
        updates.push('website_url = ?');
        values.push(data.website_url?.trim() || null);
      }
      if (highlightsJson !== undefined) {
        updates.push('highlights_json = ?');
        values.push(highlightsJson);
      }

      updates.push('updated_at = ?');
      values.push(now);
      values.push(projectId);

      db.runSync(`UPDATE project_public_profiles SET ${updates.join(', ')} WHERE project_id = ?`, values);
    } else {
      db.runSync(
        `INSERT INTO project_public_profiles
          (project_id, public_title, summary, city, region, category, hero_media_id, hero_comment, contact_email, contact_phone, website_url, highlights_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          projectId,
          data.public_title?.trim() || null,
          data.summary?.trim() || null,
          data.city?.trim() || null,
          data.region?.trim() || null,
          data.category?.trim() || null,
          data.hero_media_id || null,
          data.hero_comment?.trim() || null,
          normalizeEmail(data.contact_email) || null,
          data.contact_phone?.trim() || null,
          data.website_url?.trim() || null,
          highlightsJson ?? null,
          now,
          now,
        ]
      );
    }

    db.runSync('UPDATE projects SET public_updated_at = ?, updated_at = ? WHERE id = ?', [now, now, projectId]);
    touchProject(projectId, now);
    logActivityInternal(projectId, 'project_public_profile_updated', projectId, null, now);

    const row = db.getFirstSync('SELECT * FROM project_public_profiles WHERE project_id = ? LIMIT 1', [projectId]) as
      | Record<string, unknown>
      | null;
    if (!row) {
      throw new Error('Unable to load project public profile');
    }
    return mapProjectPublicProfileRow(row);
  }, 'Upsert project public profile');
}

export function setProjectVisibility(
  projectId: string,
  visibility: ProjectVisibility,
  options?: { slug?: string | null }
): Project {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    const project = assertProjectPublishAccess(projectId, userId);
    const now = Date.now();
    const currentVisibility: ProjectVisibility = project.visibility === 'public' ? 'public' : 'private';
    const currentName = typeof project.name === 'string' ? project.name : 'project';
    const currentSlug = typeof project.public_slug === 'string' ? project.public_slug : null;

    if (visibility === 'public') {
      const candidateSeed = options?.slug?.trim() || currentSlug || currentName;
      const nextSlug = ensureUniquePublicSlug(candidateSeed, projectId);
      const readiness = computeProjectPublicReadiness(projectId, nextSlug);
      if (!readiness.ready) {
        throw new Error(`Project not ready to publish. Missing: ${readiness.missing.join(', ')}`);
      }
      db.runSync(
        `UPDATE projects
         SET visibility = 'public',
             public_slug = ?,
             public_published_at = COALESCE(public_published_at, ?),
             public_updated_at = ?,
             updated_at = ?
         WHERE id = ?`,
        [nextSlug, now, now, now, projectId]
      );
      if (currentVisibility !== 'public') {
        logActivityInternal(projectId, 'project_published', projectId, { public_slug: nextSlug }, now);
      }
    } else {
      db.runSync(
        `UPDATE projects
         SET visibility = 'private',
             public_updated_at = ?,
             updated_at = ?
         WHERE id = ?`,
        [now, now, projectId]
      );
      if (currentVisibility !== 'private') {
        logActivityInternal(projectId, 'project_unpublished', projectId, null, now);
      }
    }

    touchProject(projectId, now);
    const row = db.getFirstSync('SELECT * FROM projects WHERE id = ? LIMIT 1', [projectId]) as Record<string, unknown> | null;
    if (!row) {
      throw new Error('Unable to load updated project');
    }
    return mapProjectRow(row);
  }, 'Set project visibility');
}

export function getPublicProjectFeed(limit = 20, offset = 0): PublicProjectSummary[] {
  return withErrorHandlingSync(() => {
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit || 20)));
    const safeOffset = Math.max(0, Math.floor(offset || 0));

    const rows = db.getAllSync(
      `SELECT
         p.id AS project_id,
         p.organization_id,
         p.public_slug,
         COALESCE(pp.public_title, p.name) AS title,
         pp.summary,
         pp.city,
         pp.region,
         pp.category,
         COALESCE(
           hm.uri,
           (
             SELECT m.uri
             FROM media m
             WHERE m.project_id = p.id
               AND m.type IN ('photo', 'video')
             ORDER BY m.created_at DESC
             LIMIT 1
           )
         ) AS hero_uri,
         COALESCE(
           hm.thumb_uri,
           hm.uri,
           (
             SELECT COALESCE(m.thumb_uri, m.uri)
             FROM media m
             WHERE m.project_id = p.id
               AND m.type IN ('photo', 'video')
             ORDER BY m.created_at DESC
             LIMIT 1
           )
         ) AS hero_thumb_uri,
         o.name AS organization_name,
         p.status,
         p.progress,
         p.end_date,
         p.public_published_at AS published_at,
         p.public_updated_at AS updated_at,
         (
           SELECT COUNT(*)
           FROM media m
           WHERE m.project_id = p.id
         ) AS media_count
       FROM projects p
       LEFT JOIN project_public_profiles pp ON pp.project_id = p.id
       LEFT JOIN organizations o ON o.id = p.organization_id
       LEFT JOIN media hm ON hm.id = pp.hero_media_id
       WHERE p.visibility = 'public'
         AND p.public_slug IS NOT NULL
         AND length(trim(p.public_slug)) > 0
       ORDER BY COALESCE(p.public_updated_at, p.updated_at) DESC
       LIMIT ? OFFSET ?`,
      [safeLimit, safeOffset]
    ) as Array<Record<string, unknown>>;

    return rows.map(mapPublicProjectSummaryRow);
  }, 'Get public project feed');
}

export function getPublicProjectBySlug(slug: string): PublicProjectDetail | null {
  return withErrorHandlingSync(() => {
    const normalizedSlug = normalizeOrganizationSlug(slug);
    if (!normalizedSlug) return null;

    const row = db.getFirstSync(
      `SELECT
         p.id AS project_id,
         p.organization_id,
         p.public_slug,
         COALESCE(pp.public_title, p.name) AS title,
         pp.summary,
         pp.city,
         pp.region,
         pp.category,
         COALESCE(
           hm.uri,
           (
             SELECT m.uri
             FROM media m
             WHERE m.project_id = p.id
               AND m.type IN ('photo', 'video')
             ORDER BY m.created_at DESC
             LIMIT 1
           )
         ) AS hero_uri,
         COALESCE(
           hm.thumb_uri,
           hm.uri,
           (
             SELECT COALESCE(m.thumb_uri, m.uri)
             FROM media m
             WHERE m.project_id = p.id
               AND m.type IN ('photo', 'video')
             ORDER BY m.created_at DESC
             LIMIT 1
           )
         ) AS hero_thumb_uri,
         o.name AS organization_name,
         p.status,
         p.progress,
         p.end_date,
         p.public_published_at AS published_at,
         p.public_updated_at AS updated_at,
         (
           SELECT COUNT(*)
           FROM media m
           WHERE m.project_id = p.id
         ) AS media_count,
         pp.hero_comment,
         pp.contact_email,
         pp.contact_phone,
         pp.website_url,
         pp.highlights_json
       FROM projects p
       LEFT JOIN project_public_profiles pp ON pp.project_id = p.id
       LEFT JOIN organizations o ON o.id = p.organization_id
       LEFT JOIN media hm ON hm.id = pp.hero_media_id
       WHERE p.visibility = 'public'
         AND p.public_slug = ?
       LIMIT 1`,
      [normalizedSlug]
    ) as Record<string, unknown> | null;

    if (!row) return null;
    const base = mapPublicProjectSummaryRow(row);

    let highlights: string[] = [];
    if (typeof row.highlights_json === 'string' && row.highlights_json.trim()) {
      try {
        const parsed = JSON.parse(row.highlights_json);
        if (Array.isArray(parsed)) {
          highlights = parsed
            .filter((item): item is string => typeof item === 'string')
            .map((item) => item.trim())
            .filter((item) => item.length > 0)
            .slice(0, 8);
        }
      } catch {
        highlights = [];
      }
    }

    return {
      ...base,
      hero_comment: typeof row.hero_comment === 'string' ? row.hero_comment : null,
      contact_email: typeof row.contact_email === 'string' ? row.contact_email : null,
      contact_phone: typeof row.contact_phone === 'string' ? row.contact_phone : null,
      website_url: typeof row.website_url === 'string' ? row.website_url : null,
      highlights,
    };
  }, 'Get public project by slug');
}

export function getProjectMembers(
  projectId: string,
  options?: { includeRemoved?: boolean }
): ProjectMember[] {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    assertProjectAccess(projectId, userId);
    const where = options?.includeRemoved ? '' : `AND status <> 'removed'`;
    const rows = db.getAllSync(
      `SELECT *
       FROM project_members
       WHERE project_id = ?
       ${where}
       ORDER BY
         CASE role
           WHEN 'owner' THEN 0
           WHEN 'manager' THEN 1
           WHEN 'worker' THEN 2
           ELSE 3
         END ASC,
         created_at ASC`,
      [projectId]
    ) as Array<Record<string, unknown>>;
    return rows.map(mapProjectMemberRow);
  }, 'Get project members');
}

export function getProjectMemberByUser(projectId: string, userId: string): ProjectMember | null {
  return withErrorHandlingSync(() => {
    const scopedUserId = getScopedUserIdOrThrow();
    assertProjectAccess(projectId, scopedUserId);
    const row = db.getFirstSync(
      `SELECT * FROM project_members
       WHERE project_id = ? AND user_id = ?
       ORDER BY created_at ASC
       LIMIT 1`,
      [projectId, userId]
    ) as Record<string, unknown> | null;
    return row ? mapProjectMemberRow(row) : null;
  }, 'Get project member by user');
}

export function getProjectMemberById(projectId: string, memberId: string): ProjectMember | null {
  return withErrorHandlingSync(() => {
    const scopedUserId = getScopedUserIdOrThrow();
    assertProjectAccess(projectId, scopedUserId);
    const row = db.getFirstSync(
      `SELECT * FROM project_members
       WHERE project_id = ? AND id = ?
       LIMIT 1`,
      [projectId, memberId]
    ) as Record<string, unknown> | null;
    return row ? mapProjectMemberRow(row) : null;
  }, 'Get project member by id');
}

export function setProjectMemberRoleById(
  projectId: string,
  memberId: string,
  role: ProjectMemberRole
): ProjectMember | null {
  return withErrorHandlingSync(() => {
    const scopedUserId = getScopedUserIdOrThrow();
    assertProjectAccess(projectId, scopedUserId);
    const existing = getProjectMemberById(projectId, memberId);
    if (!existing) return null;
    if (existing.role === role) return existing;

    const now = Date.now();
    db.runSync(
      `UPDATE project_members
       SET role = ?,
           updated_at = ?
       WHERE project_id = ? AND id = ?`,
      [role, now, projectId, memberId]
    );
    const updatedRow = db.getFirstSync(
      `SELECT * FROM project_members
       WHERE project_id = ? AND id = ?
       LIMIT 1`,
      [projectId, memberId]
    ) as Record<string, unknown> | null;
    const member = updatedRow ? mapProjectMemberRow(updatedRow) : null;
    if (!member) return null;

    touchProject(projectId, now);
    logActivityInternal(projectId, 'member_role_updated', member.id, {
      user_id: member.user_id,
      name: member.user_name_snapshot,
      from_role: existing.role,
      to_role: role,
    }, now);
    return member;
  }, 'Set project member role by id');
}

export function removeProjectMemberById(projectId: string, memberId: string): void {
  return withErrorHandlingSync(() => {
    const scopedUserId = getScopedUserIdOrThrow();
    assertProjectAccess(projectId, scopedUserId);
    const existing = getProjectMemberById(projectId, memberId);
    if (!existing) return;
    if (existing.status === 'removed') return;

    if (existing.role === 'owner' && existing.status === 'active') {
      const ownerCount = db.getFirstSync(
        `SELECT COUNT(*) AS count
         FROM project_members
         WHERE project_id = ?
           AND role = 'owner'
           AND status = 'active'`,
        [projectId]
      ) as { count?: number } | null;
      if ((ownerCount?.count ?? 0) <= 1) {
        throw new Error('Cannot remove the last project owner');
      }
    }

    const now = Date.now();
    db.runSync(
      `UPDATE project_members
       SET status = 'removed',
           updated_at = ?
       WHERE project_id = ? AND id = ?`,
      [now, projectId, memberId]
    );
    const updatedRow = db.getFirstSync(
      `SELECT * FROM project_members
       WHERE project_id = ? AND id = ?
       LIMIT 1`,
      [projectId, memberId]
    ) as Record<string, unknown> | null;
    const member = updatedRow ? mapProjectMemberRow(updatedRow) : null;
    if (!member) return;

    touchProject(projectId, now);
    logActivityInternal(projectId, 'member_removed', member.id, {
      user_id: member.user_id,
      name: member.user_name_snapshot,
      role: member.role,
    }, now);
  }, 'Remove project member by id');
}

export function upsertProjectMember(data: {
  projectId: string;
  userId: string;
  role?: ProjectMemberRole;
  status?: ProjectMemberStatus;
  invitedBy?: string | null;
}): ProjectMember {
  return withErrorHandlingSync(() => {
    const scopedUserId = getScopedUserIdOrThrow();
    assertProjectAccess(data.projectId, scopedUserId);
    const user = getUserById(data.userId);
    const role = data.role ?? 'worker';
    const status = data.status ?? 'active';
    const now = Date.now();

    const { member, isNew, previous } = saveProjectMemberInternal({
      projectId: data.projectId,
      userId: data.userId,
      invitedEmail: user?.email ?? null,
      role,
      status,
      invitedBy: data.invitedBy,
      userNameSnapshot: user?.name ?? null,
      userEmailSnapshot: user?.email ?? null,
      acceptedAt: status === 'active' ? now : null,
    });

    touchProject(data.projectId, now);

    if (isNew) {
      logActivityInternal(data.projectId, 'member_added', member.id, {
        user_id: member.user_id,
        name: member.user_name_snapshot,
        role: member.role,
        status: member.status,
      }, now);
    } else if (previous) {
      if (previous.status === 'invited' && member.status === 'active') {
        logActivityInternal(data.projectId, 'invite_accepted', member.id, {
          user_id: member.user_id,
          name: member.user_name_snapshot,
          role: member.role,
        }, now);
      } else if (previous.role !== member.role) {
        logActivityInternal(data.projectId, 'member_role_updated', member.id, {
          user_id: member.user_id,
          name: member.user_name_snapshot,
          from_role: previous.role,
          to_role: member.role,
        }, now);
      } else if (previous.status !== member.status) {
        logActivityInternal(data.projectId, 'member_status_updated', member.id, {
          user_id: member.user_id,
          name: member.user_name_snapshot,
          from_status: previous.status,
          to_status: member.status,
        }, now);
      }
    }

    return member;
  }, 'Upsert project member');
}

export function inviteProjectMember(data: {
  projectId: string;
  email: string;
  role?: Exclude<ProjectMemberRole, 'owner'>;
  invitedBy?: string | null;
}): ProjectMember {
  return withErrorHandlingSync(() => {
    const scopedUserId = getScopedUserIdOrThrow();
    assertProjectAccess(data.projectId, scopedUserId);
    const role: ProjectMemberRole = data.role ?? 'worker';

    const now = Date.now();
    const normalizedEmail = normalizeEmail(data.email);
    if (!normalizedEmail) {
      throw new Error('Invite email is required');
    }

    const { member } = saveProjectMemberInternal({
      projectId: data.projectId,
      invitedEmail: normalizedEmail,
      role,
      status: 'invited',
      invitedBy: data.invitedBy,
      userEmailSnapshot: normalizedEmail,
      acceptedAt: null,
    });

    touchProject(data.projectId, now);
    logActivityInternal(data.projectId, 'member_invited', member.id, {
      email: normalizedEmail,
      role: member.role,
    }, now);
    return member;
  }, 'Invite project member');
}

export function acceptProjectInvite(projectId: string, userId: string): ProjectMember | null {
  return withErrorHandlingSync(() => {
    const scopedUserId = getScopedUserIdOrThrow();
    assertProjectAccess(projectId, scopedUserId);
    const user = getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const existingRecord = getExistingProjectMemberRecord(projectId, user.id, user.email);
    if (!existingRecord) {
      return null;
    }

    const existing = mapProjectMemberRow(existingRecord);
    const now = Date.now();
    const { member } = saveProjectMemberInternal({
      projectId,
      userId: user.id,
      invitedEmail: user.email,
      role: existing.role,
      status: 'active',
      invitedBy: existing.invited_by ?? null,
      userNameSnapshot: user.name,
      userEmailSnapshot: user.email,
      acceptedAt: now,
    });

    touchProject(projectId, now);
    logActivityInternal(projectId, 'invite_accepted', member.id, {
      user_id: member.user_id,
      name: member.user_name_snapshot,
      role: member.role,
    }, now);
    return member;
  }, 'Accept project invite');
}

export function setProjectMemberRole(projectId: string, userId: string, role: ProjectMemberRole): ProjectMember | null {
  return withErrorHandlingSync(() => {
    const scopedUserId = getScopedUserIdOrThrow();
    assertProjectAccess(projectId, scopedUserId);
    const existing = getProjectMemberByUser(projectId, userId);
    if (!existing) return null;
    if (existing.role === role) return existing;

    const now = Date.now();
    const { member } = saveProjectMemberInternal({
      projectId,
      userId,
      invitedEmail: existing.invited_email ?? existing.user_email_snapshot ?? null,
      role,
      status: existing.status,
      invitedBy: existing.invited_by ?? null,
      userNameSnapshot: existing.user_name_snapshot ?? null,
      userEmailSnapshot: existing.user_email_snapshot ?? null,
      acceptedAt: existing.accepted_at ?? null,
    });

    touchProject(projectId, now);
    logActivityInternal(projectId, 'member_role_updated', member.id, {
      user_id: member.user_id,
      name: member.user_name_snapshot,
      from_role: existing.role,
      to_role: role,
    }, now);
    return member;
  }, 'Set project member role');
}

export function removeProjectMember(projectId: string, userId: string): void {
  return withErrorHandlingSync(() => {
    const scopedUserId = getScopedUserIdOrThrow();
    assertProjectAccess(projectId, scopedUserId);
    const existing = getProjectMemberByUser(projectId, userId);
    if (!existing) return;
    if (existing.status === 'removed') return;

    if (existing.role === 'owner' && existing.status === 'active') {
      const ownerCount = db.getFirstSync(
        `SELECT COUNT(*) AS count
         FROM project_members
         WHERE project_id = ?
           AND role = 'owner'
           AND status = 'active'`,
        [projectId]
      ) as { count?: number } | null;
      if ((ownerCount?.count ?? 0) <= 1) {
        throw new Error('Cannot remove the last project owner');
      }
    }

    const now = Date.now();
    const { member } = saveProjectMemberInternal({
      projectId,
      userId,
      invitedEmail: existing.invited_email ?? existing.user_email_snapshot ?? null,
      role: existing.role,
      status: 'removed',
      invitedBy: existing.invited_by ?? null,
      userNameSnapshot: existing.user_name_snapshot ?? null,
      userEmailSnapshot: existing.user_email_snapshot ?? null,
      acceptedAt: existing.accepted_at ?? null,
    });

    touchProject(projectId, now);
    logActivityInternal(projectId, 'member_removed', member.id, {
      user_id: member.user_id,
      name: member.user_name_snapshot,
      role: member.role,
    }, now);
  }, 'Remove project member');
}

function applyLatestNoteOverlayToMedia(items: MediaItem[], scopedUserId: string): MediaItem[] {
  if (items.length === 0) return items;
  const mediaIds = Array.from(new Set(items.map((item) => item.id).filter((id) => id.trim().length > 0)));
  if (mediaIds.length === 0) return items;

  const placeholders = mediaIds.map(() => '?').join(',');
  const rows = db.getAllSync(
    `SELECT media_id, content
     FROM notes
     WHERE user_id = ?
       AND media_id IN (${placeholders})
       AND content IS NOT NULL
       AND length(trim(content)) > 0
     ORDER BY updated_at DESC, created_at DESC`,
    [scopedUserId, ...mediaIds]
  ) as Array<Record<string, unknown>>;

  const latestByMedia = new Map<string, string>();
  for (const row of rows) {
    const mediaId = typeof row.media_id === 'string' ? row.media_id : '';
    if (!mediaId || latestByMedia.has(mediaId)) continue;
    const content = typeof row.content === 'string' ? row.content : '';
    latestByMedia.set(mediaId, content);
  }

  return items.map((item) => {
    const latest = latestByMedia.get(item.id);
    if (latest === undefined) return item;
    return { ...item, note: latest };
  });
}

export function getMediaByProject(projectId: string, type?: MediaItem['type']): MediaItem[] {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    const normalizedProjectId = typeof projectId === 'string' ? projectId.trim() : '';
    if (!normalizedProjectId) {
      return [];
    }
    assertProjectAccess(normalizedProjectId, userId);

    const query = type
      ? `SELECT * FROM media WHERE project_id = ? AND user_id = ? AND type = ? ORDER BY created_at DESC`
      : `SELECT * FROM media WHERE project_id = ? AND user_id = ? ORDER BY created_at DESC`;

    const params = type ? [normalizedProjectId, userId, type] : [normalizedProjectId, userId];
    const result = db.getAllSync(query, params) as MediaItem[];
    return applyLatestNoteOverlayToMedia(result, userId);
  }, 'Get media by project');
}

export function createMedia(data: Omit<MediaItem, 'id' | 'created_at'>): MediaItem {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    assertProjectAccess(data.project_id, userId);
    if (data.folder_id) {
      const folder = db.getFirstSync(
        'SELECT id FROM folders WHERE id = ? AND project_id = ? AND user_id = ?',
        [data.folder_id, data.project_id, userId]
      ) as { id?: string } | null;
      if (!folder?.id) {
        throw new Error('Folder not found for current user');
      }
    }
    const id = createId();
    const created_at = Date.now();

    db.runSync(
      'INSERT INTO media (id, user_id, project_id, folder_id, type, uri, thumb_uri, note, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        userId,
        data.project_id,
        data.folder_id || null,
        data.type,
        data.uri,
        data.thumb_uri || null,
        data.note || null,
        data.metadata || null,
        created_at,
      ]
    );

    const parsedMetadata =
      typeof data.metadata === 'string'
        ? (() => {
            try {
              const parsed = JSON.parse(data.metadata);
              return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
                ? (parsed as Record<string, unknown>)
                : {};
            } catch {
              return {};
            }
          })()
        : data.metadata && typeof data.metadata === 'object'
          ? (data.metadata as Record<string, unknown>)
          : {};
    const documentKind =
      typeof parsedMetadata.document_kind === 'string'
        ? parsedMetadata.document_kind.trim().toLowerCase() || null
        : null;
    const captureKind =
      typeof parsedMetadata.capture_kind === 'string'
        ? parsedMetadata.capture_kind.trim().toLowerCase() || null
        : null;

    touchProject(data.project_id, created_at, userId);
    logActivityInternal(data.project_id, 'media_added', id, {
      type: data.type,
      folder_id: data.folder_id || null,
      has_note: !!data.note?.trim(),
      document_kind: documentKind,
      capture_kind: captureKind,
    }, created_at);

    return { id, ...data, created_at };
  }, 'Create media');
}

export function deleteMedia(id: string) {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    const media = db.getFirstSync('SELECT project_id, type, folder_id FROM media WHERE id = ? AND user_id = ?', [id, userId]) as {
      project_id?: string;
      type?: MediaItem['type'];
      folder_id?: string | null;
    } | null;

    db.runSync('DELETE FROM notes WHERE media_id = ? AND user_id = ?', [id, userId]);
    db.runSync('DELETE FROM media WHERE id = ? AND user_id = ?', [id, userId]);

    if (media?.project_id) {
      touchProject(media.project_id, Date.now(), userId);
      logActivityInternal(media.project_id, 'media_deleted', id, {
        type: media.type || null,
        folder_id: media.folder_id || null,
      });
    }
  }, 'Delete media');
}

export function updateMediaNote(id: string, note: string | null) {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    const existing = db.getFirstSync('SELECT project_id, note FROM media WHERE id = ? AND user_id = ?', [id, userId]) as {
      project_id?: string;
      note?: string | null;
    } | null;
    if (!existing?.project_id) return;

    const currentNoteRow = db.getFirstSync(
      `SELECT *
       FROM notes
       WHERE media_id = ?
         AND user_id = ?
       ORDER BY updated_at DESC, created_at DESC
       LIMIT 1`,
      [id, userId]
    ) as Record<string, unknown> | null;

    const nextContent = typeof note === 'string' ? note.trim() : '';
    const now = Date.now();

    if (nextContent.length > 0) {
      if (currentNoteRow?.id) {
        db.runSync(
          `UPDATE notes
           SET content = ?, updated_at = ?, author_user_id = ?
           WHERE id = ? AND user_id = ?`,
          [nextContent, now, userId, String(currentNoteRow.id), userId]
        );
      } else {
        db.runSync(
          `INSERT INTO notes
            (id, user_id, project_id, media_id, author_user_id, title, content, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [createId(), userId, existing.project_id, id, userId, null, nextContent, now, now]
        );
      }
    } else {
      db.runSync('DELETE FROM notes WHERE media_id = ? AND user_id = ?', [id, userId]);
    }

    db.runSync('UPDATE media SET note = ? WHERE id = ? AND user_id = ?', [nextContent || null, id, userId]);

    const previousHasNote = !!existing.note?.trim() || !!(currentNoteRow && String(currentNoteRow.content ?? '').trim().length > 0);
    const nextHasNote = nextContent.length > 0;
    const actionType = !previousHasNote && nextHasNote
      ? 'note_added'
      : previousHasNote && !nextHasNote
        ? 'note_removed'
        : 'note_updated';

    touchProject(existing.project_id, now, userId);
    logActivityInternal(existing.project_id, actionType, id, { has_note: nextHasNote, note_scope: 'media', media_id: id }, now);
  }, 'Update media note');
}

export function updateMediaThumbnail(id: string, thumbUri: string | null) {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    const existing = db.getFirstSync('SELECT project_id FROM media WHERE id = ? AND user_id = ?', [id, userId]) as {
      project_id?: string;
    } | null;
    db.runSync('UPDATE media SET thumb_uri = ? WHERE id = ? AND user_id = ?', [thumbUri, id, userId]);
    if (existing?.project_id) {
      touchProject(existing.project_id, Date.now(), userId);
    }
  }, 'Update media thumbnail');
}

export function getMediaById(id: string): MediaItem | null {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    const result = db.getFirstSync('SELECT * FROM media WHERE id = ? AND user_id = ?', [id, userId]) as MediaItem | null;
    if (!result) return null;
    const [withNote] = applyLatestNoteOverlayToMedia([result], userId);
    return withNote ?? result;
  }, 'Get media by ID');
}

export function getMediaFiltered(
  projectId: string,
  opts: {
    folderId?: string | null;
    types?: Array<MediaItem['type']>;
    hasNoteOnly?: boolean;
    dateFrom?: number | null;
    dateTo?: number | null;
    sortBy?: 'date_desc' | 'date_asc' | 'name_asc' | 'type_asc';
  }
): MediaItem[] {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    assertProjectAccess(projectId, userId);
    const where: string[] = ['project_id = ?', 'user_id = ?'];
    const params: Array<string | number> = [projectId, userId];

    if (opts.folderId === null) {
      where.push('folder_id IS NULL');
    } else if (typeof opts.folderId === 'string') {
      where.push('folder_id = ?');
      params.push(opts.folderId);
    }

    if (opts.types && opts.types.length > 0 && opts.types.length < 3) {
      const placeholders = opts.types.map(() => '?').join(',');
      where.push(`type IN (${placeholders})`);
      params.push(...opts.types);
    }

    if (opts.hasNoteOnly) {
      where.push(
        `(note IS NOT NULL AND length(trim(note)) > 0
          OR EXISTS (
            SELECT 1
            FROM notes n
            WHERE n.media_id = media.id
              AND n.user_id = ?
              AND n.content IS NOT NULL
              AND length(trim(n.content)) > 0
          ))`
      );
      params.push(userId);
    }

    if (opts.dateFrom) {
      where.push('created_at >= ?');
      params.push(opts.dateFrom);
    }
    if (opts.dateTo) {
      where.push('created_at <= ?');
      params.push(opts.dateTo);
    }

    const sortBy = opts.sortBy || 'date_desc';
    let orderBy = 'ORDER BY created_at DESC';
    switch (sortBy) {
      case 'date_asc':
        orderBy = 'ORDER BY created_at ASC';
        break;
      case 'name_asc':
        orderBy = 'ORDER BY COALESCE(note, uri) COLLATE NOCASE ASC, created_at DESC';
        break;
      case 'type_asc':
        orderBy = 'ORDER BY type ASC, created_at DESC';
        break;
      case 'date_desc':
      default:
        orderBy = 'ORDER BY created_at DESC';
        break;
    }

    const sql = `SELECT * FROM media WHERE ${where.join(' AND ')} ${orderBy}`;
    const result = db.getAllSync(sql, params) as MediaItem[];
    return applyLatestNoteOverlayToMedia(result, userId);
  }, 'Get media filtered');
}

export function getNotesByProject(projectId: string, mediaId?: string | null): Note[] {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    assertProjectAccess(projectId, userId);

    const params: Array<string | number> = [projectId, userId];
    let query = `
      SELECT *
      FROM notes
      WHERE project_id = ?
        AND user_id = ?
    `;

    if (typeof mediaId === 'string') {
      query += ' AND media_id = ?';
      params.push(mediaId);
    } else if (mediaId === null) {
      query += ' AND media_id IS NULL';
    }

    query += ' ORDER BY updated_at DESC, created_at DESC';
    const rows = db.getAllSync(query, params) as Array<Record<string, unknown>>;
    return rows.map(mapNoteRow);
  }, 'Get notes by project');
}

export function createProjectNote(data: {
  project_id: string;
  content: string;
  title?: string | null;
  media_id?: string | null;
}): Note {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    assertProjectAccess(data.project_id, userId);

    const content = data.content.trim();
    if (!content) {
      throw new Error('Note content is required');
    }

    const title = typeof data.title === 'string' ? data.title.trim() : '';
    const mediaId =
      typeof data.media_id === 'string' && data.media_id.trim().length > 0 ? data.media_id.trim() : null;

    if (mediaId) {
      const media = db.getFirstSync(
        'SELECT id FROM media WHERE id = ? AND project_id = ? AND user_id = ? LIMIT 1',
        [mediaId, data.project_id, userId]
      ) as { id?: string } | null;
      if (!media?.id) {
        throw new Error('Linked media not found');
      }
      db.runSync('UPDATE media SET note = ? WHERE id = ? AND user_id = ?', [content, mediaId, userId]);
    }

    const id = createId();
    const now = Date.now();
    db.runSync(
      `INSERT INTO notes
        (id, user_id, project_id, media_id, author_user_id, title, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, data.project_id, mediaId, userId, title || null, content, now, now]
    );

    touchProject(data.project_id, now, userId);
    logActivityInternal(
      data.project_id,
      'note_added',
      mediaId || id,
      {
        has_note: true,
        note_scope: mediaId ? 'media' : 'project',
        media_id: mediaId,
        title: title || null,
      },
      now
    );

    return {
      id,
      project_id: data.project_id,
      media_id: mediaId,
      author_user_id: userId,
      title: title || null,
      content,
      created_at: now,
      updated_at: now,
    };
  }, 'Create project note');
}

export function updateProjectNote(
  noteId: string,
  data: {
    content: string;
    title?: string | null;
  }
): Note | null {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    const existing = db.getFirstSync(
      `SELECT *
       FROM notes
       WHERE id = ?
         AND user_id = ?
       LIMIT 1`,
      [noteId, userId]
    ) as Record<string, unknown> | null;
    if (!existing) return null;

    const projectId = typeof existing.project_id === 'string' ? existing.project_id : '';
    if (!projectId) return null;
    assertProjectAccess(projectId, userId);

    const content = data.content.trim();
    if (!content) {
      throw new Error('Note content is required');
    }
    const title = typeof data.title === 'string' ? data.title.trim() : '';
    const mediaId = typeof existing.media_id === 'string' ? existing.media_id : null;
    const now = Date.now();

    db.runSync(
      `UPDATE notes
       SET title = ?, content = ?, author_user_id = ?, updated_at = ?
       WHERE id = ?
         AND user_id = ?`,
      [title || null, content, userId, now, noteId, userId]
    );

    if (mediaId) {
      db.runSync('UPDATE media SET note = ? WHERE id = ? AND user_id = ?', [content, mediaId, userId]);
    }

    touchProject(projectId, now, userId);
    logActivityInternal(
      projectId,
      'note_updated',
      mediaId || noteId,
      {
        has_note: true,
        note_scope: mediaId ? 'media' : 'project',
        media_id: mediaId,
        title: title || null,
      },
      now
    );

    return {
      id: noteId,
      project_id: projectId,
      media_id: mediaId,
      author_user_id: userId,
      title: title || null,
      content,
      created_at: toNullableNumber(existing.created_at) ?? now,
      updated_at: now,
    };
  }, 'Update project note');
}

export function deleteProjectNote(noteId: string): void {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    const existing = db.getFirstSync(
      `SELECT id, project_id, media_id
       FROM notes
       WHERE id = ?
         AND user_id = ?
       LIMIT 1`,
      [noteId, userId]
    ) as { id?: string; project_id?: string; media_id?: string | null } | null;
    if (!existing?.id || !existing.project_id) return;
    assertProjectAccess(existing.project_id, userId);

    db.runSync('DELETE FROM notes WHERE id = ? AND user_id = ?', [noteId, userId]);

    if (existing.media_id) {
      const latestRemaining = db.getFirstSync(
        `SELECT content
         FROM notes
         WHERE media_id = ?
           AND user_id = ?
           AND content IS NOT NULL
           AND length(trim(content)) > 0
         ORDER BY updated_at DESC, created_at DESC
         LIMIT 1`,
        [existing.media_id, userId]
      ) as { content?: string | null } | null;
      const nextContent =
        typeof latestRemaining?.content === 'string' && latestRemaining.content.trim().length > 0
          ? latestRemaining.content.trim()
          : null;
      db.runSync('UPDATE media SET note = ? WHERE id = ? AND user_id = ?', [nextContent, existing.media_id, userId]);
    }

    const now = Date.now();
    touchProject(existing.project_id, now, userId);
    logActivityInternal(
      existing.project_id,
      'note_removed',
      existing.media_id || noteId,
      {
        has_note: false,
        note_scope: existing.media_id ? 'media' : 'project',
        media_id: existing.media_id || null,
      },
      now
    );
  }, 'Delete project note');
}

export function getLatestNoteByMedia(mediaId: string): Note | null {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    const row = db.getFirstSync(
      `SELECT *
       FROM notes
       WHERE media_id = ?
         AND user_id = ?
       ORDER BY updated_at DESC, created_at DESC
       LIMIT 1`,
      [mediaId, userId]
    ) as Record<string, unknown> | null;
    return row ? mapNoteRow(row) : null;
  }, 'Get latest note by media');
}

export function getEffectiveMediaNote(mediaId: string): string | null {
  return withErrorHandlingSync(() => {
    const latest = getLatestNoteByMedia(mediaId);
    if (latest?.content?.trim()) {
      return latest.content;
    }
    const userId = getScopedUserIdOrThrow();
    const row = db.getFirstSync(
      'SELECT note FROM media WHERE id = ? AND user_id = ? LIMIT 1',
      [mediaId, userId]
    ) as { note?: string | null } | null;
    const fallback = typeof row?.note === 'string' ? row.note.trim() : '';
    return fallback.length > 0 ? fallback : null;
  }, 'Get effective media note');
}

// User management functions
export function createUser(data: Omit<User, 'id' | 'created_at' | 'last_login_at'>): User {
  return withErrorHandlingSync(() => {
    const id = createId();
    const created_at = Date.now();
    const last_login_at = Date.now();

    try {
      db.runSync(
        'INSERT INTO users (id, auth_user_id, email, name, provider, provider_id, avatar, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          id,
          data.authUserId || null,
          data.email,
          data.name,
          data.provider,
          data.providerId,
          data.avatar || null,
          created_at,
          last_login_at,
        ]
      );
    } catch (error) {
      const message = extractErrorMessage(error);

      if (message.includes('UNIQUE constraint failed')) {
        if (data.authUserId) {
          const existingByAuthId = db.getFirstSync('SELECT * FROM users WHERE auth_user_id = ? LIMIT 1', [data.authUserId]) as
            | Record<string, unknown>
            | null;
          if (existingByAuthId) {
            db.runSync('UPDATE users SET last_login_at = ? WHERE id = ?', [last_login_at, String(existingByAuthId.id)]);
            return mapUserRow(existingByAuthId);
          }
        }

        const existingByProvider = db.getFirstSync(
          'SELECT * FROM users WHERE provider = ? AND provider_id = ? LIMIT 1',
          [data.provider, data.providerId]
        ) as Record<string, unknown> | null;
        if (existingByProvider) {
          db.runSync('UPDATE users SET last_login_at = ? WHERE id = ?', [last_login_at, String(existingByProvider.id)]);
          return mapUserRow(existingByProvider);
        }
      }

      throw error;
    }

    return { id, ...data, created_at, last_login_at };
  }, 'Create user');
}

export function getUserByProviderId(providerId: string, provider: 'apple' | 'google'): User | null {
  return withErrorHandlingSync(() => {
    const result = db.getFirstSync('SELECT * FROM users WHERE provider_id = ? AND provider = ?', [providerId, provider]) as
      | Record<string, unknown>
      | null;
    return result ? mapUserRow(result) : null;
  }, 'Get user by provider ID');
}

export function getUserByAuthUserId(authUserId: string): User | null {
  return withErrorHandlingSync(() => {
    const normalized = authUserId.trim();
    if (!normalized) return null;
    const result = db.getFirstSync('SELECT * FROM users WHERE auth_user_id = ?', [normalized]) as
      | Record<string, unknown>
      | null;
    return result ? mapUserRow(result) : null;
  }, 'Get user by auth user ID');
}

export function updateUserLastLogin(id: string) {
  return withErrorHandlingSync(() => {
    const last_login_at = Date.now();
    db.runSync('UPDATE users SET last_login_at = ? WHERE id = ?', [last_login_at, id]);
  }, 'Update user last login');
}

export function updateUserProfile(id: string, data: Partial<Pick<User, 'name' | 'avatar'>>): User | null {
  return withErrorHandlingSync(() => {
    const updates: string[] = [];
    const values: Array<string | null> = [];

    if (data.name !== undefined) {
      const nextName = data.name.trim();
      if (!nextName) {
        throw new Error('User name cannot be empty');
      }
      updates.push('name = ?');
      values.push(nextName);
    }

    if (data.avatar !== undefined) {
      updates.push('avatar = ?');
      values.push(data.avatar || null);
    }

    if (updates.length === 0) {
      return getUserById(id);
    }

    values.push(id);
    db.runSync(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
    return getUserById(id);
  }, 'Update user profile');
}

export function getUserById(id: string): User | null {
  return withErrorHandlingSync(() => {
    const result = db.getFirstSync('SELECT * FROM users WHERE id = ?', [id]) as Record<string, unknown> | null;
    return result ? mapUserRow(result) : null;
  }, 'Get user by ID');
}

export function updateUserAuthIdentity(
  id: string,
  data: {
    authUserId: string;
    provider?: 'apple' | 'google';
    providerId?: string;
    email?: string;
    name?: string;
    avatar?: string | null;
  }
): User | null {
  return withErrorHandlingSync(() => {
    const authUserId = data.authUserId.trim();
    if (!authUserId) {
      throw new Error('authUserId is required');
    }

    const updates: string[] = ['auth_user_id = ?', 'last_login_at = ?'];
    const values: Array<string | number | null> = [authUserId, Date.now()];

    if (data.provider) {
      updates.push('provider = ?');
      values.push(data.provider);
    }
    if (data.providerId?.trim()) {
      updates.push('provider_id = ?');
      values.push(data.providerId.trim());
    }
    if (data.email?.trim()) {
      updates.push('email = ?');
      values.push(data.email.trim());
    }
    if (data.name?.trim()) {
      updates.push('name = ?');
      values.push(data.name.trim());
    }
    if (data.avatar !== undefined) {
      const nextAvatar = typeof data.avatar === 'string' ? data.avatar.trim() : '';
      updates.push('avatar = ?');
      values.push(nextAvatar.length > 0 ? nextAvatar : null);
    }

    values.push(id);
    try {
      db.runSync(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
      return getUserById(id);
    } catch (error) {
      const message = extractErrorMessage(error);
      if (message.includes('UNIQUE constraint failed')) {
        const existingByAuthId = db.getFirstSync('SELECT * FROM users WHERE auth_user_id = ? LIMIT 1', [authUserId]) as
          | Record<string, unknown>
          | null;
        if (existingByAuthId) {
          const existingUserId = String(existingByAuthId.id);
          if (existingUserId !== id) {
            mergeUserRecords(id, existingUserId);
            return getUserById(existingUserId);
          }
          return mapUserRow(existingByAuthId);
        }
      }
      throw error;
    }
  }, 'Update user auth identity');
}

export function deleteUser(id: string) {
  return withErrorHandlingSync(() => {
    db.runSync('DELETE FROM users WHERE id = ?', [id]);
  }, 'Delete user');
}

// Folder management functions
export function createFolder(data: Omit<Folder, 'id' | 'created_at'>): Folder {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    assertProjectAccess(data.project_id, userId);
    const id = createId();
    const created_at = Date.now();

    db.runSync(
      'INSERT INTO folders (id, user_id, project_id, name, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, userId, data.project_id, data.name, created_at]
    );

    touchProject(data.project_id, created_at, userId);
    logActivityInternal(data.project_id, 'folder_created', id, { name: data.name }, created_at);

    return { id, ...data, created_at };
  }, 'Create folder');
}

export function getFoldersByProject(projectId: string): Folder[] {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    assertProjectAccess(projectId, userId);
    const result = db.getAllSync(
      'SELECT * FROM folders WHERE project_id = ? AND user_id = ? ORDER BY created_at ASC',
      [projectId, userId]
    ) as Folder[];
    return result;
  }, 'Get folders by project');
}

export function getFolderById(id: string): Folder | null {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    const result = db.getFirstSync('SELECT * FROM folders WHERE id = ? AND user_id = ?', [id, userId]) as Folder | null;
    return result;
  }, 'Get folder by ID');
}

export function updateFolderName(id: string, name: string) {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    const folder = db.getFirstSync('SELECT project_id, name FROM folders WHERE id = ? AND user_id = ?', [id, userId]) as {
      project_id?: string;
      name?: string;
    } | null;

    db.runSync('UPDATE folders SET name = ? WHERE id = ? AND user_id = ?', [name, id, userId]);

    if (folder?.project_id) {
      touchProject(folder.project_id, Date.now(), userId);
      logActivityInternal(folder.project_id, 'folder_renamed', id, {
        from: folder.name || null,
        to: name,
      });
    }
  }, 'Update folder name');
}

export function deleteFolder(id: string) {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    const folder = db.getFirstSync('SELECT project_id, name FROM folders WHERE id = ? AND user_id = ?', [id, userId]) as {
      project_id?: string;
      name?: string;
    } | null;

    // Move all media in this folder to the root level (folder_id = null)
    db.runSync('UPDATE media SET folder_id = NULL WHERE folder_id = ? AND user_id = ?', [id, userId]);
    // Delete the folder
    db.runSync('DELETE FROM folders WHERE id = ? AND user_id = ?', [id, userId]);

    if (folder?.project_id) {
      touchProject(folder.project_id, Date.now(), userId);
      logActivityInternal(folder.project_id, 'folder_deleted', id, {
        name: folder.name || null,
      });
    }
  }, 'Delete folder');
}

export function getMediaByFolder(projectId: string, folderId?: string | null): MediaItem[] {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    assertProjectAccess(projectId, userId);
    const query = folderId
      ? 'SELECT * FROM media WHERE project_id = ? AND user_id = ? AND folder_id = ? ORDER BY created_at DESC'
      : 'SELECT * FROM media WHERE project_id = ? AND user_id = ? AND folder_id IS NULL ORDER BY created_at DESC';

    const params = folderId ? [projectId, userId, folderId] : [projectId, userId];
    const result = db.getAllSync(query, params) as MediaItem[];
    return applyLatestNoteOverlayToMedia(result, userId);
  }, 'Get media by folder');
}

export function moveMediaToFolder(mediaId: string, folderId: string | null) {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    const media = db.getFirstSync('SELECT project_id, folder_id FROM media WHERE id = ? AND user_id = ?', [mediaId, userId]) as {
      project_id?: string;
      folder_id?: string | null;
    } | null;

    if (!media?.project_id) {
      return;
    }

    if (folderId) {
      const folder = db.getFirstSync(
        'SELECT id FROM folders WHERE id = ? AND user_id = ? AND project_id = ?',
        [folderId, userId, media.project_id]
      ) as { id?: string } | null;
      if (!folder?.id) {
        throw new Error('Folder not found for current user');
      }
    }

    db.runSync('UPDATE media SET folder_id = ? WHERE id = ? AND user_id = ?', [folderId, mediaId, userId]);

    touchProject(media.project_id, Date.now(), userId);
    logActivityInternal(media.project_id, 'media_moved', mediaId, {
      from_folder_id: media.folder_id || null,
      to_folder_id: folderId,
    });
  }, 'Move media to folder');
}

export function createActivity(
  projectId: string,
  actionType: string,
  referenceId?: string | null,
  metadata?: Record<string, unknown> | null,
  actor?: ActivityActor | null
): ActivityLogEntry {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    assertProjectAccess(projectId, userId);
    const resolvedReferenceId = resolveActivityReferenceId(referenceId, metadata);
    const created = logActivityInternal(projectId, actionType, resolvedReferenceId, metadata, Date.now(), actor);
    if (!created) {
      throw new Error('Unable to create activity');
    }
    touchProject(projectId, created.created_at, userId);
    return created;
  }, 'Create activity');
}

export function updateActivity(
  id: string,
  data: {
    actionType?: string;
    referenceId?: string | null;
    metadata?: Record<string, unknown> | null;
  }
): ActivityLogEntry | null {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    const existing = db.getFirstSync('SELECT * FROM activity_log WHERE id = ? AND user_id = ?', [id, userId]) as
      | Record<string, unknown>
      | null;
    if (!existing) {
      return null;
    }

    const updates: string[] = [];
    const values: Array<string | null> = [];
    const existingReferenceId = normalizeActivityReferenceValue(existing.reference_id);

    if (data.actionType !== undefined) {
      updates.push('action_type = ?');
      values.push(data.actionType.trim());
    }

    if (data.referenceId !== undefined) {
      updates.push('reference_id = ?');
      values.push(resolveActivityReferenceId(data.referenceId, data.metadata));
    } else if (data.metadata !== undefined) {
      const inferredReferenceId = resolveActivityReferenceId(undefined, data.metadata);
      if (inferredReferenceId && inferredReferenceId !== existingReferenceId) {
        updates.push('reference_id = ?');
        values.push(inferredReferenceId);
      }
    }

    if (data.metadata !== undefined) {
      updates.push('metadata = ?');
      values.push(data.metadata ? JSON.stringify(data.metadata) : null);
    }

    if (updates.length === 0) {
      return mapActivityRow(existing);
    }

    values.push(id);
    values.push(userId);
    db.runSync(`UPDATE activity_log SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, values);
    const updated = db.getFirstSync('SELECT * FROM activity_log WHERE id = ? AND user_id = ?', [id, userId]) as
      | Record<string, unknown>
      | null;
    if (!updated) return null;

    const projectId = typeof existing.project_id === 'string' ? existing.project_id : '';
    if (projectId) {
      touchProject(projectId, Date.now(), userId);
    }
    return mapActivityRow(updated);
  }, 'Update activity');
}

export function deleteActivity(id: string): void {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    const existing = db.getFirstSync('SELECT project_id FROM activity_log WHERE id = ? AND user_id = ?', [id, userId]) as {
      project_id?: string;
    } | null;
    db.runSync('DELETE FROM activity_log WHERE id = ? AND user_id = ?', [id, userId]);
    if (existing?.project_id) {
      touchProject(existing.project_id, Date.now(), userId);
    }
  }, 'Delete activity');
}

export function setActivityActor(actor: ActivityActor | null) {
  if (!actor?.userId?.trim()) {
    activityActor = null;
    return;
  }

  activityActor = {
    userId: actor.userId.trim(),
    name: actor.name?.trim() || null,
  };
}

export function getActivityActor(): ActivityActor | null {
  return activityActor;
}

export function getActivityByProject(projectId: string, limit = 20): ActivityLogEntry[] {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    assertProjectAccess(projectId, userId);
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit || 20)));
    const rows = db.getAllSync(
      `SELECT * FROM activity_log WHERE project_id = ? ORDER BY created_at DESC LIMIT ${safeLimit}`,
      [projectId]
    ) as Array<Record<string, unknown>>;
    return rows.map(mapActivityRow);
  }, 'Get activity by project');
}

export function getActivityCommentsByProject(projectId: string, limit = 500): ActivityComment[] {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    assertProjectAccess(projectId, userId);
    const safeLimit = Math.max(1, Math.min(2000, Math.floor(limit || 500)));
    const rows = db.getAllSync(
      `SELECT *
       FROM activity_comments
       WHERE project_id = ?
       ORDER BY created_at ASC
       LIMIT ${safeLimit}`,
      [projectId]
    ) as Array<Record<string, unknown>>;
    return rows.map(mapActivityCommentRow);
  }, 'Get activity comments by project');
}

export function createActivityComment(data: {
  activity_id: string;
  body: string;
  author_name_snapshot?: string | null;
}): ActivityComment {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    const activityId = data.activity_id.trim();
    if (!activityId) {
      throw new Error('Activity id is required');
    }

    const body = data.body.trim();
    if (!body) {
      throw new Error('Comment body is required');
    }

    const activityRow = db.getFirstSync(
      `SELECT id, project_id
       FROM activity_log
       WHERE id = ?
       LIMIT 1`,
      [activityId]
    ) as { id?: string; project_id?: string } | null;

    if (!activityRow?.id || !activityRow.project_id) {
      throw new Error('Activity not found');
    }

    assertProjectAccess(activityRow.project_id, userId);
    const now = Date.now();
    const authorName =
      (typeof data.author_name_snapshot === 'string' ? data.author_name_snapshot.trim() : '') ||
      getUserById(userId)?.name?.trim() ||
      activityActor?.name?.trim() ||
      null;
    const id = createId();

    db.runSync(
      `INSERT INTO activity_comments
        (id, user_id, project_id, activity_id, author_user_id, author_name_snapshot, body, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, activityRow.project_id, activityId, userId, authorName, body, now, now]
    );

    touchProject(activityRow.project_id, now, userId);
    return {
      id,
      project_id: activityRow.project_id,
      activity_id: activityId,
      author_user_id: userId,
      author_name_snapshot: authorName,
      body,
      created_at: now,
      updated_at: now,
    };
  }, 'Create activity comment');
}

export function getProjectNotifications(limit = 50): ProjectNotification[] {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    const safeLimit = Math.max(1, Math.min(500, Math.floor(limit || 50)));
    const rows = db.getAllSync(
      `SELECT *
       FROM project_notifications
       WHERE user_id = ?
       ORDER BY CASE WHEN read_at IS NULL THEN 0 ELSE 1 END ASC, created_at DESC
       LIMIT ${safeLimit}`,
      [userId]
    ) as Array<Record<string, unknown>>;
    return rows.map(mapProjectNotificationRow);
  }, 'Get project notifications');
}

export function getUnreadProjectNotificationCount(): number {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    const row = db.getFirstSync(
      `SELECT COUNT(*) as unread_count
       FROM project_notifications
       WHERE user_id = ?
         AND read_at IS NULL`,
      [userId]
    ) as { unread_count?: number } | null;
    return typeof row?.unread_count === 'number' ? row.unread_count : 0;
  }, 'Get unread project notification count');
}

export function markProjectNotificationRead(notificationId: string, readAt: number = Date.now()): void {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    const normalizedId = notificationId.trim();
    if (!normalizedId) return;
    db.runSync(
      `UPDATE project_notifications
       SET read_at = COALESCE(read_at, ?)
       WHERE id = ?
         AND user_id = ?`,
      [readAt, normalizedId, userId]
    );
  }, 'Mark project notification read');
}

export function markAllProjectNotificationsRead(readAt: number = Date.now()): void {
  return withErrorHandlingSync(() => {
    const userId = getScopedUserIdOrThrow();
    db.runSync(
      `UPDATE project_notifications
       SET read_at = ?
       WHERE user_id = ?
         AND read_at IS NULL`,
      [readAt, userId]
    );
  }, 'Mark all project notifications read');
}
