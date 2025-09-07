import * as SQLite from 'expo-sqlite';
import { ErrorHandler, withErrorHandlingSync, withErrorHandling } from './errorHandler';

export interface Project {
  id: string;
  name: string;
  client?: string;
  location?: string;
  created_at: number;
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

const db = SQLite.openDatabaseSync('buildvault.db');

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
        created_at INTEGER NOT NULL
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
    `);

    // Add folder_id column to media table if it doesn't exist
    try {
      db.execSync(`ALTER TABLE media ADD COLUMN folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL`);
    } catch (error) {
      // Column already exists, ignore error - this is expected
      console.log('folder_id column already exists or error adding it:', error);
    }
  }, 'Database migration', false); // Don't show alert for expected errors
}

export function getProjects(search?: string): Project[] {
  return withErrorHandlingSync(() => {
    const query = search
      ? `SELECT * FROM projects WHERE name LIKE ? OR client LIKE ? OR location LIKE ? ORDER BY created_at DESC`
      : `SELECT * FROM projects ORDER BY created_at DESC`;

    const params = search ? [`%${search}%`, `%${search}%`, `%${search}%`] : [];
    const result = db.getAllSync(query, params) as Project[];
    return result;
  }, 'Get projects');
}

export function createProject(data: Omit<Project, 'id' | 'created_at'>): Project {
  return withErrorHandlingSync(() => {
    const id = Date.now().toString();
    const created_at = Date.now();

    db.runSync(
      'INSERT INTO projects (id, name, client, location, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, data.name, data.client || null, data.location || null, created_at]
    );

    return { id, ...data, created_at };
  }, 'Create project');
}

export function deleteProject(id: string) {
  return withErrorHandlingSync(() => {
    db.runSync('DELETE FROM projects WHERE id = ?', [id]);
  }, 'Delete project');
}

export function getProjectById(id: string): Project | null {
  return withErrorHandlingSync(() => {
    const result = db.getFirstSync('SELECT * FROM projects WHERE id = ?', [id]) as Project | null;
    return result;
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
    const id = Date.now().toString();
    const created_at = Date.now();

    db.runSync(
      'INSERT INTO media (id, project_id, folder_id, type, uri, thumb_uri, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, data.project_id, data.folder_id || null, data.type, data.uri, data.thumb_uri || null, data.note || null, created_at]
    );

    return { id, ...data, created_at };
  }, 'Create media');
}

export function deleteMedia(id: string) {
  return withErrorHandlingSync(() => {
    db.runSync('DELETE FROM media WHERE id = ?', [id]);
  }, 'Delete media');
}

export function updateMediaNote(id: string, note: string | null) {
  return withErrorHandlingSync(() => {
    db.runSync('UPDATE media SET note = ? WHERE id = ?', [note, id]);
  }, 'Update media note');
}

export function getMediaById(id: string): MediaItem | null {
  return withErrorHandlingSync(() => {
    const result = db.getFirstSync('SELECT * FROM media WHERE id = ?', [id]) as MediaItem | null;
    return result;
  }, 'Get media by ID');
}

// User management functions
export function createUser(data: Omit<User, 'id' | 'created_at' | 'last_login_at'>): User {
  return withErrorHandlingSync(() => {
    const id = Date.now().toString();
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
    const id = Date.now().toString();
    const created_at = Date.now();

    db.runSync(
      'INSERT INTO folders (id, project_id, name, created_at) VALUES (?, ?, ?, ?)',
      [id, data.project_id, data.name, created_at]
    );

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
    db.runSync('UPDATE folders SET name = ? WHERE id = ?', [name, id]);
  }, 'Update folder name');
}

export function deleteFolder(id: string) {
  return withErrorHandlingSync(() => {
    // Move all media in this folder to the root level (folder_id = null)
    db.runSync('UPDATE media SET folder_id = NULL WHERE folder_id = ?', [id]);
    // Delete the folder
    db.runSync('DELETE FROM folders WHERE id = ?', [id]);
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
    db.runSync('UPDATE media SET folder_id = ? WHERE id = ?', [folderId, mediaId]);
  }, 'Move media to folder');
}
