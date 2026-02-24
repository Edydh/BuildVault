import { withErrorHandlingSync } from './errorHandler';

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

type DbState = {
  projects: Project[];
  folders: Folder[];
  media: MediaItem[];
  users: User[];
};

const STORAGE_KEY = 'buildvault.db.web.v1';
const DEFAULT_STATE: DbState = {
  projects: [],
  folders: [],
  media: [],
  users: [],
};

let state: DbState | null = null;
let activeUserScopeId: string | null = null;

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function loadState(): DbState {
  if (state) return state;

  const storage = getStorage();
  if (!storage) {
    state = { ...DEFAULT_STATE };
    return state;
  }

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      state = { ...DEFAULT_STATE };
      return state;
    }

    const parsed = JSON.parse(raw) as Partial<DbState>;
    state = {
      projects: Array.isArray(parsed.projects) ? (parsed.projects as Project[]) : [],
      folders: Array.isArray(parsed.folders) ? (parsed.folders as Folder[]) : [],
      media: Array.isArray(parsed.media) ? (parsed.media as MediaItem[]) : [],
      users: Array.isArray(parsed.users) ? (parsed.users as User[]) : [],
    };
    return state;
  } catch {
    state = { ...DEFAULT_STATE };
    return state;
  }
}

function persistState() {
  const storage = getStorage();
  if (!storage || !state) return;

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore persistence errors (quota/private mode)
  }
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function compareByCreatedAtDesc<T extends { created_at: number }>(a: T, b: T): number {
  return b.created_at - a.created_at;
}

function compareByCreatedAtAsc<T extends { created_at: number }>(a: T, b: T): number {
  return a.created_at - b.created_at;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').toLowerCase();
}

function normalizeScopedUserId(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function setActiveUserScope(userId: string | null): void {
  activeUserScopeId = normalizeScopedUserId(userId);
}

export function getActiveUserScope(): string | null {
  return activeUserScopeId;
}

export function clearActiveUserScope(): void {
  activeUserScopeId = null;
}

export function migrate() {
  return withErrorHandlingSync(() => {
    loadState();
    persistState();
  }, 'Database migration', false);
}

export function getProjects(search?: string): Project[] {
  return withErrorHandlingSync(() => {
    const current = loadState();
    const query = normalizeText(search);

    const filtered = query
      ? current.projects.filter((project) => {
          return (
            normalizeText(project.name).includes(query) ||
            normalizeText(project.client).includes(query) ||
            normalizeText(project.location).includes(query)
          );
        })
      : current.projects;

    return [...filtered].sort(compareByCreatedAtDesc);
  }, 'Get projects');
}

export function createProject(data: Omit<Project, 'id' | 'created_at'>): Project {
  return withErrorHandlingSync(() => {
    const current = loadState();
    const project: Project = {
      id: makeId(),
      name: data.name,
      client: data.client,
      location: data.location,
      created_at: Date.now(),
    };

    current.projects.push(project);
    persistState();
    return project;
  }, 'Create project');
}

export function updateProject(id: string, data: Partial<Omit<Project, 'id' | 'created_at'>>): void {
  return withErrorHandlingSync(() => {
    const current = loadState();
    const project = current.projects.find((item) => item.id === id);
    if (!project) return;

    if (data.name !== undefined) project.name = data.name;
    if (data.client !== undefined) project.client = data.client;
    if (data.location !== undefined) project.location = data.location;

    persistState();
  }, 'Update project');
}

export function deleteProject(id: string) {
  return withErrorHandlingSync(() => {
    const current = loadState();

    current.projects = current.projects.filter((project) => project.id !== id);
    current.folders = current.folders.filter((folder) => folder.project_id !== id);
    current.media = current.media.filter((item) => item.project_id !== id);

    persistState();
  }, 'Delete project');
}

export function getProjectById(id: string): Project | null {
  return withErrorHandlingSync(() => {
    const current = loadState();
    return current.projects.find((project) => project.id === id) ?? null;
  }, 'Get project by ID');
}

export function getMediaByProject(projectId: string, type?: MediaItem['type']): MediaItem[] {
  return withErrorHandlingSync(() => {
    const current = loadState();
    const filtered = current.media.filter((item) => {
      if (item.project_id !== projectId) return false;
      if (!type) return true;
      return item.type === type;
    });

    return [...filtered].sort(compareByCreatedAtDesc);
  }, 'Get media by project');
}

export function createMedia(data: Omit<MediaItem, 'id' | 'created_at'>): MediaItem {
  return withErrorHandlingSync(() => {
    const current = loadState();
    const media: MediaItem = {
      id: makeId(),
      project_id: data.project_id,
      folder_id: data.folder_id ?? null,
      type: data.type,
      uri: data.uri,
      thumb_uri: data.thumb_uri ?? null,
      note: data.note ?? null,
      created_at: Date.now(),
    };

    current.media.push(media);
    persistState();
    return media;
  }, 'Create media');
}

export function deleteMedia(id: string) {
  return withErrorHandlingSync(() => {
    const current = loadState();
    current.media = current.media.filter((item) => item.id !== id);
    persistState();
  }, 'Delete media');
}

export function updateMediaNote(id: string, note: string | null) {
  return withErrorHandlingSync(() => {
    const current = loadState();
    const media = current.media.find((item) => item.id === id);
    if (!media) return;

    media.note = note;
    persistState();
  }, 'Update media note');
}

export function updateMediaThumbnail(id: string, thumbUri: string | null) {
  return withErrorHandlingSync(() => {
    const current = loadState();
    const media = current.media.find((item) => item.id === id);
    if (!media) return;

    media.thumb_uri = thumbUri;
    persistState();
  }, 'Update media thumbnail');
}

export function getMediaById(id: string): MediaItem | null {
  return withErrorHandlingSync(() => {
    const current = loadState();
    return current.media.find((item) => item.id === id) ?? null;
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
    const current = loadState();
    let filtered = current.media.filter((item) => item.project_id === projectId);

    if (opts.folderId === null) {
      filtered = filtered.filter((item) => item.folder_id == null);
    } else if (typeof opts.folderId === 'string') {
      filtered = filtered.filter((item) => item.folder_id === opts.folderId);
    }

    if (opts.types && opts.types.length > 0 && opts.types.length < 3) {
      filtered = filtered.filter((item) => opts.types?.includes(item.type));
    }

    if (opts.hasNoteOnly) {
      filtered = filtered.filter((item) => !!item.note && item.note.trim().length > 0);
    }

    if (opts.dateFrom) {
      filtered = filtered.filter((item) => item.created_at >= opts.dateFrom!);
    }

    if (opts.dateTo) {
      filtered = filtered.filter((item) => item.created_at <= opts.dateTo!);
    }

    const sortBy = opts.sortBy || 'date_desc';
    const sorted = [...filtered];

    switch (sortBy) {
      case 'date_asc':
        sorted.sort(compareByCreatedAtAsc);
        break;
      case 'name_asc':
        sorted.sort((a, b) => {
          const av = normalizeText(a.note || a.uri);
          const bv = normalizeText(b.note || b.uri);
          const nameCmp = av.localeCompare(bv);
          if (nameCmp !== 0) return nameCmp;
          return compareByCreatedAtDesc(a, b);
        });
        break;
      case 'type_asc':
        sorted.sort((a, b) => {
          const typeCmp = a.type.localeCompare(b.type);
          if (typeCmp !== 0) return typeCmp;
          return compareByCreatedAtDesc(a, b);
        });
        break;
      case 'date_desc':
      default:
        sorted.sort(compareByCreatedAtDesc);
        break;
    }

    return sorted;
  }, 'Get media filtered');
}

export function createUser(data: Omit<User, 'id' | 'created_at' | 'last_login_at'>): User {
  return withErrorHandlingSync(() => {
    const current = loadState();
    const now = Date.now();

    const user: User = {
      id: makeId(),
      email: data.email,
      name: data.name,
      provider: data.provider,
      providerId: data.providerId,
      avatar: data.avatar ?? null,
      created_at: now,
      last_login_at: now,
    };

    current.users.push(user);
    persistState();
    return user;
  }, 'Create user');
}

export function getUserByProviderId(providerId: string, provider: 'apple' | 'google'): User | null {
  return withErrorHandlingSync(() => {
    const current = loadState();
    return current.users.find((user) => user.providerId === providerId && user.provider === provider) ?? null;
  }, 'Get user by provider ID');
}

export function updateUserLastLogin(id: string) {
  return withErrorHandlingSync(() => {
    const current = loadState();
    const user = current.users.find((item) => item.id === id);
    if (!user) return;

    user.last_login_at = Date.now();
    persistState();
  }, 'Update user last login');
}

export function getUserById(id: string): User | null {
  return withErrorHandlingSync(() => {
    const current = loadState();
    return current.users.find((user) => user.id === id) ?? null;
  }, 'Get user by ID');
}

export function deleteUser(id: string) {
  return withErrorHandlingSync(() => {
    const current = loadState();
    current.users = current.users.filter((user) => user.id !== id);
    persistState();
  }, 'Delete user');
}

export function createFolder(data: Omit<Folder, 'id' | 'created_at'>): Folder {
  return withErrorHandlingSync(() => {
    const current = loadState();

    const folder: Folder = {
      id: makeId(),
      project_id: data.project_id,
      name: data.name,
      created_at: Date.now(),
    };

    current.folders.push(folder);
    persistState();
    return folder;
  }, 'Create folder');
}

export function getFoldersByProject(projectId: string): Folder[] {
  return withErrorHandlingSync(() => {
    const current = loadState();
    return current.folders
      .filter((folder) => folder.project_id === projectId)
      .sort(compareByCreatedAtAsc);
  }, 'Get folders by project');
}

export function getFolderById(id: string): Folder | null {
  return withErrorHandlingSync(() => {
    const current = loadState();
    return current.folders.find((folder) => folder.id === id) ?? null;
  }, 'Get folder by ID');
}

export function updateFolderName(id: string, name: string) {
  return withErrorHandlingSync(() => {
    const current = loadState();
    const folder = current.folders.find((item) => item.id === id);
    if (!folder) return;

    folder.name = name;
    persistState();
  }, 'Update folder name');
}

export function deleteFolder(id: string) {
  return withErrorHandlingSync(() => {
    const current = loadState();

    current.media = current.media.map((item) => {
      if (item.folder_id !== id) return item;
      return { ...item, folder_id: null };
    });

    current.folders = current.folders.filter((folder) => folder.id !== id);
    persistState();
  }, 'Delete folder');
}

export function getMediaByFolder(projectId: string, folderId?: string | null): MediaItem[] {
  return withErrorHandlingSync(() => {
    const current = loadState();

    const filtered = current.media.filter((item) => {
      if (item.project_id !== projectId) return false;
      if (folderId) return item.folder_id === folderId;
      return item.folder_id == null;
    });

    return filtered.sort(compareByCreatedAtDesc);
  }, 'Get media by folder');
}

export function moveMediaToFolder(mediaId: string, folderId: string | null) {
  return withErrorHandlingSync(() => {
    const current = loadState();
    const media = current.media.find((item) => item.id === mediaId);
    if (!media) return;

    media.folder_id = folderId;
    persistState();
  }, 'Move media to folder');
}
