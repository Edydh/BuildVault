import * as SQLite from 'expo-sqlite';

export interface Project {
  id: string;
  name: string;
  client?: string;
  location?: string;
  created_at: number;
}

export interface MediaItem {
  id: string;
  project_id: string;
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

const db = SQLite.openDatabaseSync('buildvault.db');

export async function migrate() {
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
      created_at INTEGER NOT NULL
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
  `);
}

export function getProjects(search?: string): Project[] {
  const query = search
    ? `SELECT * FROM projects WHERE name LIKE ? OR client LIKE ? OR location LIKE ? ORDER BY created_at DESC`
    : `SELECT * FROM projects ORDER BY created_at DESC`;

  const params = search ? [`%${search}%`, `%${search}%`, `%${search}%`] : [];
  const result = db.getAllSync(query, params) as Project[];
  return result;
}

export function createProject(data: Omit<Project, 'id' | 'created_at'>): Project {
  const id = Date.now().toString();
  const created_at = Date.now();

  db.runSync(
    'INSERT INTO projects (id, name, client, location, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, data.name, data.client || null, data.location || null, created_at]
  );

  return { id, ...data, created_at };
}

export function deleteProject(id: string) {
  db.runSync('DELETE FROM projects WHERE id = ?', [id]);
}

export function getProjectById(id: string): Project | null {
  const result = db.getFirstSync('SELECT * FROM projects WHERE id = ?', [id]) as Project | null;
  return result;
}

export function getMediaByProject(projectId: string, type?: MediaItem['type']): MediaItem[] {
  const query = type
    ? `SELECT * FROM media WHERE project_id = ? AND type = ? ORDER BY created_at DESC`
    : `SELECT * FROM media WHERE project_id = ? ORDER BY created_at DESC`;

  const params = type ? [projectId, type] : [projectId];
  const result = db.getAllSync(query, params) as MediaItem[];
  return result;
}

export function createMedia(data: Omit<MediaItem, 'id' | 'created_at'>): MediaItem {
  const id = Date.now().toString();
  const created_at = Date.now();

  db.runSync(
    'INSERT INTO media (id, project_id, type, uri, thumb_uri, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, data.project_id, data.type, data.uri, data.thumb_uri || null, data.note || null, created_at]
  );

  return { id, ...data, created_at };
}

export function deleteMedia(id: string) {
  db.runSync('DELETE FROM media WHERE id = ?', [id]);
}

export function updateMediaNote(id: string, note: string | null) {
  db.runSync('UPDATE media SET note = ? WHERE id = ?', [note, id]);
}

export function getMediaById(id: string): MediaItem | null {
  const result = db.getFirstSync('SELECT * FROM media WHERE id = ?', [id]) as MediaItem | null;
  return result;
}

// User management functions
export function createUser(data: Omit<User, 'id' | 'created_at' | 'last_login_at'>): User {
  const id = Date.now().toString();
  const created_at = Date.now();
  const last_login_at = Date.now();

  db.runSync(
    'INSERT INTO users (id, email, name, provider, provider_id, avatar, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, data.email, data.name, data.provider, data.providerId, data.avatar || null, created_at, last_login_at]
  );

  return { id, ...data, created_at, last_login_at };
}

export function getUserByProviderId(providerId: string, provider: 'apple' | 'google'): User | null {
  const result = db.getFirstSync('SELECT * FROM users WHERE provider_id = ? AND provider = ?', [providerId, provider]) as User | null;
  return result;
}

export function updateUserLastLogin(id: string) {
  const last_login_at = Date.now();
  db.runSync('UPDATE users SET last_login_at = ? WHERE id = ?', [last_login_at, id]);
}

export function getUserById(id: string): User | null {
  const result = db.getFirstSync('SELECT * FROM users WHERE id = ?', [id]) as User | null;
  return result;
}

export function deleteUser(id: string) {
  db.runSync('DELETE FROM users WHERE id = ?', [id]);
}
