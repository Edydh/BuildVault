import * as SQLite from 'expo-sqlite';
import { withErrorHandlingSync } from './errorHandler';

export type ProjectStatus = 'active' | 'delayed' | 'completed' | 'neutral';

export interface Project {
  id: string;
  name: string;
  client?: string;
  location?: string;
  status: ProjectStatus;
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
  created_at: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  provider: 'apple' | 'google';
  providerId: string;
  avatar?: string | null;
  created_at: number;
  last_login_at: number;
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

const db = SQLite.openDatabaseSync('buildvault.db');
const STALE_ACTIVITY_MS = 7 * 24 * 60 * 60 * 1000;
let activityActor: ActivityActor | null = null;
const PROJECT_MEMBER_ROLES: ProjectMemberRole[] = ['owner', 'manager', 'worker', 'client'];
const PROJECT_MEMBER_STATUSES: ProjectMemberStatus[] = ['invited', 'active', 'removed'];

export interface ActivityActor {
  userId: string;
  name?: string | null;
}

function isProjectMemberRole(value: unknown): value is ProjectMemberRole {
  return typeof value === 'string' && PROJECT_MEMBER_ROLES.includes(value as ProjectMemberRole);
}

function isProjectMemberStatus(value: unknown): value is ProjectMemberStatus {
  return typeof value === 'string' && PROJECT_MEMBER_STATUSES.includes(value as ProjectMemberStatus);
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

function deriveStatusFromActivity(
  progress: number,
  endDate: number | null,
  lastActivityAt: number | null
): ProjectStatus {
  if (progress >= 100) return 'completed';
  if (endDate !== null && Date.now() > endDate) return 'delayed';
  if (!lastActivityAt) return 'neutral';
  if (Date.now() - lastActivityAt > STALE_ACTIVITY_MS) return 'delayed';
  return 'active';
}

function touchProject(projectId: string, at: number = Date.now()) {
  try {
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
    const resolvedActor = actor ?? activityActor;
    const actorUserId = resolvedActor?.userId?.trim() ? resolvedActor.userId.trim() : null;
    const actorNameSnapshot = resolvedActor?.name?.trim() ? resolvedActor.name.trim() : null;
    const id = createId();
    const metadataJson = metadata ? JSON.stringify(metadata) : null;
    db.runSync(
      'INSERT INTO activity_log (id, project_id, action_type, reference_id, actor_user_id, actor_name_snapshot, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, projectId, actionType, referenceId || null, actorUserId, actorNameSnapshot, metadataJson, createdAt]
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
  const progress = clampProgress(row.progress);
  const endDate = toNullableNumber(row.end_date);
  const lastActivityAt = toNullableNumber(row.last_activity_at);
  const status = deriveStatusFromActivity(progress, endDate, lastActivityAt);

  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    client: typeof row.client === 'string' ? row.client : undefined,
    location: typeof row.location === 'string' ? row.location : undefined,
    status,
    progress,
    start_date: toNullableNumber(row.start_date),
    end_date: endDate,
    budget: toNullableNumber(row.budget),
    last_activity_at: lastActivityAt,
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

function normalizeEmail(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
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
        email TEXT NOT NULL,
        name TEXT NOT NULL,
        provider TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        avatar TEXT,
        created_at INTEGER NOT NULL,
        last_login_at INTEGER NOT NULL
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
        name TEXT NOT NULL,
        client TEXT,
        location TEXT,
        status TEXT NOT NULL DEFAULT 'neutral',
        progress INTEGER NOT NULL DEFAULT 0,
        start_date INTEGER,
        end_date INTEGER,
        budget REAL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY NOT NULL,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS media (
        id TEXT PRIMARY KEY NOT NULL,
        project_id TEXT NOT NULL,
        type TEXT NOT NULL,
        uri TEXT NOT NULL,
        thumb_uri TEXT,
        note TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS activity_log (
        id TEXT PRIMARY KEY NOT NULL,
        project_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        reference_id TEXT,
        actor_user_id TEXT,
        actor_name_snapshot TEXT,
        metadata TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
      );
    `);

    const alterStatements = [
      `ALTER TABLE media ADD COLUMN folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL`,
      `ALTER TABLE projects ADD COLUMN status TEXT DEFAULT 'neutral'`,
      `ALTER TABLE projects ADD COLUMN progress INTEGER DEFAULT 0`,
      `ALTER TABLE projects ADD COLUMN start_date INTEGER`,
      `ALTER TABLE projects ADD COLUMN end_date INTEGER`,
      `ALTER TABLE projects ADD COLUMN budget REAL`,
      `ALTER TABLE projects ADD COLUMN updated_at INTEGER`,
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
      UPDATE projects SET progress = 0 WHERE progress IS NULL;
      UPDATE projects SET start_date = created_at WHERE start_date IS NULL;
      UPDATE projects SET updated_at = created_at WHERE updated_at IS NULL;
      UPDATE project_members SET role = 'worker' WHERE role IS NULL OR trim(role) = '';
      UPDATE project_members SET status = 'invited' WHERE status IS NULL OR trim(status) = '';
      UPDATE project_members SET updated_at = created_at WHERE updated_at IS NULL;
    `);

    // Create performance indexes (idempotent)
    try {
      db.execSync(`
        CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);
        CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at);
        CREATE INDEX IF NOT EXISTS idx_media_project_created_at ON media(project_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_media_project_type_created_at ON media(project_id, type, created_at);
        CREATE INDEX IF NOT EXISTS idx_media_project_folder_created_at ON media(project_id, folder_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_media_project_note_present ON media(project_id) WHERE note IS NOT NULL AND length(trim(note)) > 0;
        CREATE INDEX IF NOT EXISTS idx_activity_project_created_at ON activity_log(project_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
        CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
        CREATE INDEX IF NOT EXISTS idx_project_members_invited_email ON project_members(invited_email);
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
    const query = search
      ? `SELECT p.*, (
          SELECT MAX(a.created_at)
          FROM activity_log a
          WHERE a.project_id = p.id
            AND a.action_type NOT IN ('project_created', 'project_updated')
        ) AS last_activity_at
        FROM projects p
        WHERE p.name LIKE ? OR COALESCE(p.client, '') LIKE ? OR COALESCE(p.location, '') LIKE ?
        ORDER BY p.updated_at DESC, p.created_at DESC`
      : `SELECT p.*, (
          SELECT MAX(a.created_at)
          FROM activity_log a
          WHERE a.project_id = p.id
            AND a.action_type NOT IN ('project_created', 'project_updated')
        ) AS last_activity_at
        FROM projects p
        ORDER BY p.updated_at DESC, p.created_at DESC`;

    const params = search ? [`%${search}%`, `%${search}%`, `%${search}%`] : [];
    const result = db.getAllSync(query, params) as Array<Record<string, unknown>>;
    return result.map(mapProjectRow);
  }, 'Get projects');
}

export function createProject(data: {
  name: string;
  client?: string;
  location?: string;
  progress?: number;
  start_date?: number | null;
  end_date?: number | null;
  budget?: number | null;
}): Project {
  return withErrorHandlingSync(() => {
    const id = createId();
    const created_at = Date.now();
    const updated_at = created_at;
    const status: ProjectStatus = 'neutral';
    const progress = clampProgress(data.progress);
    const start_date = data.start_date ?? created_at;
    const end_date = data.end_date ?? null;
    const budget = data.budget ?? null;

    db.runSync(
      'INSERT INTO projects (id, name, client, location, status, progress, start_date, end_date, budget, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
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
      status,
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
  data: Partial<Omit<Project, 'id' | 'created_at' | 'updated_at' | 'status' | 'last_activity_at'>>
): void {
  return withErrorHandlingSync(() => {
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
    if (data.progress !== undefined) {
      updates.push('progress = ?');
      values.push(clampProgress(data.progress));
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
    const query = `UPDATE projects SET ${updates.join(', ')} WHERE id = ?`;
    db.runSync(query, values);

    logActivityInternal(id, 'project_updated', id, {
      fields: Object.keys(data),
    }, updatedAt);
  }, 'Update project');
}

export function deleteProject(id: string) {
  return withErrorHandlingSync(() => {
    db.runSync('DELETE FROM projects WHERE id = ?', [id]);
  }, 'Delete project');
}

export function getProjectById(id: string): Project | null {
  return withErrorHandlingSync(() => {
    const result = db.getFirstSync(
      `SELECT p.*, (
        SELECT MAX(a.created_at)
        FROM activity_log a
        WHERE a.project_id = p.id
          AND a.action_type NOT IN ('project_created', 'project_updated')
      ) AS last_activity_at
      FROM projects p
      WHERE p.id = ?`,
      [id]
    ) as Record<string, unknown> | null;
    return result ? mapProjectRow(result) : null;
  }, 'Get project by ID');
}

export function getProjectMembers(
  projectId: string,
  options?: { includeRemoved?: boolean }
): ProjectMember[] {
  return withErrorHandlingSync(() => {
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

export function upsertProjectMember(data: {
  projectId: string;
  userId: string;
  role?: ProjectMemberRole;
  status?: ProjectMemberStatus;
  invitedBy?: string | null;
}): ProjectMember {
  return withErrorHandlingSync(() => {
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

export function getMediaByProject(projectId: string, type?: MediaItem['type']): MediaItem[] {
  return withErrorHandlingSync(() => {
    const query = type
      ? `SELECT * FROM media WHERE project_id = ? AND type = ? ORDER BY created_at DESC`
      : `SELECT * FROM media WHERE project_id = ? ORDER BY created_at DESC`;

    const params = type ? [projectId, type] : [projectId];
    const result = db.getAllSync(query, params) as MediaItem[];
    return result;
  }, 'Get media by project');
}

export function createMedia(data: Omit<MediaItem, 'id' | 'created_at'>): MediaItem {
  return withErrorHandlingSync(() => {
    const id = createId();
    const created_at = Date.now();

    db.runSync(
      'INSERT INTO media (id, project_id, folder_id, type, uri, thumb_uri, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, data.project_id, data.folder_id || null, data.type, data.uri, data.thumb_uri || null, data.note || null, created_at]
    );

    touchProject(data.project_id, created_at);
    logActivityInternal(data.project_id, 'media_added', id, {
      type: data.type,
      folder_id: data.folder_id || null,
      has_note: !!data.note?.trim(),
    }, created_at);

    return { id, ...data, created_at };
  }, 'Create media');
}

export function deleteMedia(id: string) {
  return withErrorHandlingSync(() => {
    const media = db.getFirstSync('SELECT project_id, type, folder_id FROM media WHERE id = ?', [id]) as {
      project_id?: string;
      type?: MediaItem['type'];
      folder_id?: string | null;
    } | null;

    db.runSync('DELETE FROM media WHERE id = ?', [id]);

    if (media?.project_id) {
      touchProject(media.project_id);
      logActivityInternal(media.project_id, 'media_deleted', id, {
        type: media.type || null,
        folder_id: media.folder_id || null,
      });
    }
  }, 'Delete media');
}

export function updateMediaNote(id: string, note: string | null) {
  return withErrorHandlingSync(() => {
    const existing = db.getFirstSync('SELECT project_id, note FROM media WHERE id = ?', [id]) as {
      project_id?: string;
      note?: string | null;
    } | null;

    db.runSync('UPDATE media SET note = ? WHERE id = ?', [note, id]);

    if (existing?.project_id) {
      const previousHasNote = !!existing.note?.trim();
      const nextHasNote = !!note?.trim();
      const actionType = !previousHasNote && nextHasNote
        ? 'note_added'
        : previousHasNote && !nextHasNote
          ? 'note_removed'
          : 'note_updated';

      touchProject(existing.project_id);
      logActivityInternal(existing.project_id, actionType, id, { has_note: nextHasNote });
    }
  }, 'Update media note');
}

export function updateMediaThumbnail(id: string, thumbUri: string | null) {
  return withErrorHandlingSync(() => {
    const existing = db.getFirstSync('SELECT project_id FROM media WHERE id = ?', [id]) as { project_id?: string } | null;
    db.runSync('UPDATE media SET thumb_uri = ? WHERE id = ?', [thumbUri, id]);
    if (existing?.project_id) {
      touchProject(existing.project_id);
    }
  }, 'Update media thumbnail');
}

export function getMediaById(id: string): MediaItem | null {
  return withErrorHandlingSync(() => {
    const result = db.getFirstSync('SELECT * FROM media WHERE id = ?', [id]) as MediaItem | null;
    return result;
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
    const where: string[] = ['project_id = ?'];
    const params: Array<string | number> = [projectId];

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
      where.push('note IS NOT NULL AND length(trim(note)) > 0');
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
    return result;
  }, 'Get media filtered');
}

// User management functions
export function createUser(data: Omit<User, 'id' | 'created_at' | 'last_login_at'>): User {
  return withErrorHandlingSync(() => {
    const id = createId();
    const created_at = Date.now();
    const last_login_at = Date.now();

    db.runSync(
      'INSERT INTO users (id, email, name, provider, provider_id, avatar, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, data.email, data.name, data.provider, data.providerId, data.avatar || null, created_at, last_login_at]
    );

    return { id, ...data, created_at, last_login_at };
  }, 'Create user');
}

export function getUserByProviderId(providerId: string, provider: 'apple' | 'google'): User | null {
  return withErrorHandlingSync(() => {
    const result = db.getFirstSync('SELECT * FROM users WHERE provider_id = ? AND provider = ?', [providerId, provider]) as User | null;
    return result;
  }, 'Get user by provider ID');
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
    const result = db.getFirstSync('SELECT * FROM users WHERE id = ?', [id]) as User | null;
    return result;
  }, 'Get user by ID');
}

export function deleteUser(id: string) {
  return withErrorHandlingSync(() => {
    db.runSync('DELETE FROM users WHERE id = ?', [id]);
  }, 'Delete user');
}

// Folder management functions
export function createFolder(data: Omit<Folder, 'id' | 'created_at'>): Folder {
  return withErrorHandlingSync(() => {
    const id = createId();
    const created_at = Date.now();

    db.runSync(
      'INSERT INTO folders (id, project_id, name, created_at) VALUES (?, ?, ?, ?)',
      [id, data.project_id, data.name, created_at]
    );

    touchProject(data.project_id, created_at);
    logActivityInternal(data.project_id, 'folder_created', id, { name: data.name }, created_at);

    return { id, ...data, created_at };
  }, 'Create folder');
}

export function getFoldersByProject(projectId: string): Folder[] {
  return withErrorHandlingSync(() => {
    const result = db.getAllSync('SELECT * FROM folders WHERE project_id = ? ORDER BY created_at ASC', [projectId]) as Folder[];
    return result;
  }, 'Get folders by project');
}

export function getFolderById(id: string): Folder | null {
  return withErrorHandlingSync(() => {
    const result = db.getFirstSync('SELECT * FROM folders WHERE id = ?', [id]) as Folder | null;
    return result;
  }, 'Get folder by ID');
}

export function updateFolderName(id: string, name: string) {
  return withErrorHandlingSync(() => {
    const folder = db.getFirstSync('SELECT project_id, name FROM folders WHERE id = ?', [id]) as {
      project_id?: string;
      name?: string;
    } | null;

    db.runSync('UPDATE folders SET name = ? WHERE id = ?', [name, id]);

    if (folder?.project_id) {
      touchProject(folder.project_id);
      logActivityInternal(folder.project_id, 'folder_renamed', id, {
        from: folder.name || null,
        to: name,
      });
    }
  }, 'Update folder name');
}

export function deleteFolder(id: string) {
  return withErrorHandlingSync(() => {
    const folder = db.getFirstSync('SELECT project_id, name FROM folders WHERE id = ?', [id]) as {
      project_id?: string;
      name?: string;
    } | null;

    // Move all media in this folder to the root level (folder_id = null)
    db.runSync('UPDATE media SET folder_id = NULL WHERE folder_id = ?', [id]);
    // Delete the folder
    db.runSync('DELETE FROM folders WHERE id = ?', [id]);

    if (folder?.project_id) {
      touchProject(folder.project_id);
      logActivityInternal(folder.project_id, 'folder_deleted', id, {
        name: folder.name || null,
      });
    }
  }, 'Delete folder');
}

export function getMediaByFolder(projectId: string, folderId?: string | null): MediaItem[] {
  return withErrorHandlingSync(() => {
    const query = folderId
      ? 'SELECT * FROM media WHERE project_id = ? AND folder_id = ? ORDER BY created_at DESC'
      : 'SELECT * FROM media WHERE project_id = ? AND folder_id IS NULL ORDER BY created_at DESC';

    const params = folderId ? [projectId, folderId] : [projectId];
    const result = db.getAllSync(query, params) as MediaItem[];
    return result;
  }, 'Get media by folder');
}

export function moveMediaToFolder(mediaId: string, folderId: string | null) {
  return withErrorHandlingSync(() => {
    const media = db.getFirstSync('SELECT project_id, folder_id FROM media WHERE id = ?', [mediaId]) as {
      project_id?: string;
      folder_id?: string | null;
    } | null;

    db.runSync('UPDATE media SET folder_id = ? WHERE id = ?', [folderId, mediaId]);

    if (media?.project_id) {
      touchProject(media.project_id);
      logActivityInternal(media.project_id, 'media_moved', mediaId, {
        from_folder_id: media.folder_id || null,
        to_folder_id: folderId,
      });
    }
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
    const created = logActivityInternal(projectId, actionType, referenceId, metadata, Date.now(), actor);
    if (!created) {
      throw new Error('Unable to create activity');
    }
    touchProject(projectId, created.created_at);
    return created;
  }, 'Create activity');
}

export function updateActivity(
  id: string,
  data: {
    actionType?: string;
    metadata?: Record<string, unknown> | null;
  }
): ActivityLogEntry | null {
  return withErrorHandlingSync(() => {
    const existing = db.getFirstSync('SELECT * FROM activity_log WHERE id = ?', [id]) as Record<string, unknown> | null;
    if (!existing) {
      return null;
    }

    const updates: string[] = [];
    const values: Array<string | null> = [];

    if (data.actionType !== undefined) {
      updates.push('action_type = ?');
      values.push(data.actionType.trim());
    }

    if (data.metadata !== undefined) {
      updates.push('metadata = ?');
      values.push(data.metadata ? JSON.stringify(data.metadata) : null);
    }

    if (updates.length === 0) {
      return mapActivityRow(existing);
    }

    values.push(id);
    db.runSync(`UPDATE activity_log SET ${updates.join(', ')} WHERE id = ?`, values);
    const updated = db.getFirstSync('SELECT * FROM activity_log WHERE id = ?', [id]) as Record<string, unknown> | null;
    if (!updated) return null;

    const projectId = typeof existing.project_id === 'string' ? existing.project_id : '';
    if (projectId) {
      touchProject(projectId, Date.now());
    }
    return mapActivityRow(updated);
  }, 'Update activity');
}

export function deleteActivity(id: string): void {
  return withErrorHandlingSync(() => {
    const existing = db.getFirstSync('SELECT project_id FROM activity_log WHERE id = ?', [id]) as {
      project_id?: string;
    } | null;
    db.runSync('DELETE FROM activity_log WHERE id = ?', [id]);
    if (existing?.project_id) {
      touchProject(existing.project_id, Date.now());
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
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit || 20)));
    const rows = db.getAllSync(
      `SELECT * FROM activity_log WHERE project_id = ? ORDER BY created_at DESC LIMIT ${safeLimit}`,
      [projectId]
    ) as ActivityLogEntry[];
    return rows;
  }, 'Get activity by project');
}
