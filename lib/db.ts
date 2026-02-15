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

export interface ActivityLogEntry {
  id: string;
  project_id: string;
  action_type: string;
  reference_id?: string | null;
  metadata?: string | null;
  created_at: number;
}

const db = SQLite.openDatabaseSync('buildvault.db');
const STALE_ACTIVITY_MS = 7 * 24 * 60 * 60 * 1000;

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
  createdAt: number = Date.now()
): ActivityLogEntry | null {
  try {
    const id = createId();
    const metadataJson = metadata ? JSON.stringify(metadata) : null;
    db.runSync(
      'INSERT INTO activity_log (id, project_id, action_type, reference_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, projectId, actionType, referenceId || null, metadataJson, createdAt]
    );
    return {
      id,
      project_id: projectId,
      action_type: actionType,
      reference_id: referenceId || null,
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
  metadata?: Record<string, unknown> | null
): ActivityLogEntry {
  return withErrorHandlingSync(() => {
    const created = logActivityInternal(projectId, actionType, referenceId, metadata);
    if (!created) {
      throw new Error('Unable to create activity');
    }
    touchProject(projectId, created.created_at);
    return created;
  }, 'Create activity');
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
