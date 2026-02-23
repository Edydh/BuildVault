import type { User as SupabaseUser } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';
import {
  ActivityLogEntry,
  Folder,
  MediaItem,
  Note,
  ProjectMember,
  ProjectMemberRole,
  ProjectMemberStatus,
  Project,
  ProjectPublicProfile,
  ProjectStatus,
  ProjectVisibility,
  createActivity,
  createFolder,
  createMedia,
  createProjectNote,
  deleteActivity,
  deleteFolder,
  deleteMedia,
  deleteProjectNote,
  deleteProject,
  getActivityByProject,
  getFoldersByProject,
  getMediaById,
  getProjectMembers,
  getProjectById,
  getProjectMemberById,
  getProjectPublicProfile,
  mergeProjectMembersSnapshotFromSupabase,
  mergeProjectContentSnapshotFromSupabase,
  mergeProjectNotesSnapshotFromSupabase,
  mergeProjectPublicProfileSnapshotFromSupabase,
  mergeProjectsAndActivitySnapshotFromSupabase,
  moveMediaToFolder,
  removeProjectMemberById,
  setProjectMemberRoleById,
  setProjectCompletionState,
  setProjectVisibility,
  upsertProjectMember,
  upsertProjectPublicProfile,
  updateActivity,
  updateFolderName,
  updateMediaNote,
  updateMediaThumbnail,
  updateProjectNote,
  updateProject,
} from './db';
import { supabase } from './supabase';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PROJECT_COLUMNS =
  'id, owner_user_id, organization_id, name, client, location, status, status_override, visibility, public_slug, public_published_at, public_updated_at, progress, start_date, end_date, budget, created_at, updated_at';

const ACTIVITY_COLUMNS =
  'id, project_id, action_type, reference_id, actor_user_id, actor_name_snapshot, metadata, created_at';
const FOLDER_COLUMNS = 'id, project_id, name, created_at';
const MEDIA_COLUMNS =
  'id, project_id, folder_id, uploaded_by_user_id, type, uri, thumb_uri, note, metadata, created_at';
const NOTE_COLUMNS =
  'id, project_id, media_id, author_user_id, title, content, created_at, updated_at';
const PROJECT_MEMBER_COLUMNS =
  'id, project_id, user_id, invited_email, role, status, invited_by, user_name_snapshot, user_email_snapshot, created_at, updated_at, accepted_at';
const PROJECT_PUBLIC_PROFILE_COLUMNS =
  'project_id, public_title, summary, city, region, category, hero_media_id, hero_comment, contact_email, contact_phone, website_url, highlights_json, created_at, updated_at';
const STORAGE_BUCKET = 'buildvault-media';
const PUBLIC_STORAGE_PATH_SEGMENT = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
const SIGNED_STORAGE_PATH_SEGMENT = `/storage/v1/object/sign/${STORAGE_BUCKET}/`;
const MAX_BASE64_UPLOAD_FALLBACK_BYTES = 8 * 1024 * 1024;
const STORAGE_UPLOAD_RETRY_QUEUE_KEY = '@buildvault/storage-upload-retry/v1';
const STORAGE_UPLOAD_RETRY_BASE_DELAY_MS = 15 * 1000;
const STORAGE_UPLOAD_RETRY_MAX_DELAY_MS = 30 * 60 * 1000;
const STORAGE_UPLOAD_RETRY_MAX_ATTEMPTS = 12;
const SUPABASE_STORAGE_URL =
  (Constants.expoConfig?.extra?.supabaseUrl as string | undefined) || process.env.SUPABASE_URL || '';
const SUPABASE_STORAGE_ANON_KEY =
  (Constants.expoConfig?.extra?.supabaseAnonKey as string | undefined) ||
  process.env.SUPABASE_ANON_KEY ||
  '';

type SupabaseProjectRow = {
  id: string;
  owner_user_id: string;
  organization_id: string | null;
  name: string;
  client: string | null;
  location: string | null;
  status: string | null;
  status_override: string | null;
  visibility: string | null;
  public_slug: string | null;
  public_published_at: string | null;
  public_updated_at: string | null;
  progress: number | null;
  start_date: string | null;
  end_date: string | null;
  budget: number | string | null;
  created_at: string;
  updated_at: string;
};

type SupabaseActivityRow = {
  id: string;
  project_id: string;
  action_type: string;
  reference_id: string | null;
  actor_user_id: string | null;
  actor_name_snapshot: string | null;
  metadata: unknown;
  created_at: string;
};

type SupabaseFolderRow = {
  id: string;
  project_id: string;
  name: string;
  created_at: string;
};

type SupabaseMediaRow = {
  id: string;
  project_id: string;
  folder_id: string | null;
  uploaded_by_user_id: string | null;
  type: MediaItem['type'];
  uri: string;
  thumb_uri: string | null;
  note: string | null;
  metadata: unknown;
  created_at: string;
};

type SupabaseNoteRow = {
  id: string;
  project_id: string;
  media_id: string | null;
  author_user_id: string | null;
  title: string | null;
  content: string;
  created_at: string;
  updated_at: string;
};

type SupabaseProjectMemberRow = {
  id: string;
  project_id: string;
  user_id: string | null;
  invited_email: string | null;
  role: string | null;
  status: string | null;
  invited_by: string | null;
  user_name_snapshot: string | null;
  user_email_snapshot: string | null;
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
};

type SupabaseProjectPublicProfileRow = {
  project_id: string;
  public_title: string | null;
  summary: string | null;
  city: string | null;
  region: string | null;
  category: string | null;
  hero_media_id: string | null;
  hero_comment: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website_url: string | null;
  highlights_json: unknown;
  created_at: string;
  updated_at: string;
};

type SupabaseProjectVisibilityRow = {
  id: string;
  organization_id: string | null;
  visibility: string | null;
  public_slug?: string | null;
  public_published_at?: string | null;
};

type SupabaseProjectMediaCaptionRow = {
  id: string;
  note: string | null;
};

type StorageUploadRetryEntry = {
  mediaId: string;
  projectId: string;
  mediaType: MediaItem['type'];
  attempts: number;
  nextRetryAt: number;
  lastError: string;
  updatedAt: number;
};

type StorageUploadRetryQueue = Record<string, StorageUploadRetryEntry>;

let storageUploadRetryQueueCache: StorageUploadRetryQueue | null = null;

type SupabasePublicMediaPostLookupRow = {
  id: string;
  media_id: string;
  caption: string | null;
  status: string | null;
};

type PublicProfileUpsertInput = Partial<
  Omit<ProjectPublicProfile, 'project_id' | 'created_at' | 'updated_at' | 'hero_media_id'> & {
    hero_media_id?: string | null;
    highlights?: string[] | null;
  }
>;

export interface ProjectVisibilityFeedSyncSummary {
  visibility: ProjectVisibility;
  totalMedia: number;
  inserted: number;
  republished: number;
  updatedPublished: number;
  unpublished: number;
  skippedRemoved: number;
}

export interface SetProjectVisibilityResult {
  project: Project;
  sync: ProjectVisibilityFeedSyncSummary;
}

function isUuid(value: string | null | undefined): boolean {
  if (!value) return false;
  return UUID_REGEX.test(value.trim());
}

function toMillis(value?: string | null): number {
  if (!value) return Date.now();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

function toNullableMillis(value?: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function toIsoMillis(value?: number | null): string | null {
  if (value === null || value === undefined) return null;
  return new Date(value).toISOString();
}

function normalizeMetadata(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function toMetadataPayload(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) return {};
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return {};
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return { value: parsed };
    } catch {
      return { text: trimmed };
    }
  }
  return { value };
}

function normalizeBudget(value: number | string | null): number | null {
  if (value === null || value === undefined) return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function isRemoteUri(uri: string | null | undefined): boolean {
  if (!uri) return false;
  return /^https?:\/\//i.test(uri.trim());
}

function toLocalFileUri(uri: string): string {
  return uri.startsWith('file://') ? uri : `file://${uri}`;
}

async function localFileExists(uri: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(toLocalFileUri(uri));
    return !!info.exists && !info.isDirectory;
  } catch {
    return false;
  }
}

function toSafeTimestamp(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return value > 0 ? value : fallback;
}

function normalizeStorageUploadRetryQueue(raw: unknown): StorageUploadRetryQueue {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }

  const now = Date.now();
  const normalized: StorageUploadRetryQueue = {};
  for (const [mediaId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const record = value as Partial<StorageUploadRetryEntry>;
    if (typeof mediaId !== 'string' || !mediaId.trim()) continue;
    const projectId = typeof record.projectId === 'string' ? record.projectId.trim() : '';
    if (!projectId) continue;
    const mediaType: MediaItem['type'] =
      record.mediaType === 'video' || record.mediaType === 'doc' ? record.mediaType : 'photo';
    const attempts =
      typeof record.attempts === 'number' && Number.isFinite(record.attempts) && record.attempts > 0
        ? Math.floor(record.attempts)
        : 1;

    normalized[mediaId] = {
      mediaId,
      projectId,
      mediaType,
      attempts,
      nextRetryAt: toSafeTimestamp(record.nextRetryAt, now),
      lastError: typeof record.lastError === 'string' ? record.lastError : 'upload_failed',
      updatedAt: toSafeTimestamp(record.updatedAt, now),
    };
  }

  return normalized;
}

async function getStorageUploadRetryQueue(): Promise<StorageUploadRetryQueue> {
  if (storageUploadRetryQueueCache) {
    return { ...storageUploadRetryQueueCache };
  }

  try {
    const raw = await AsyncStorage.getItem(STORAGE_UPLOAD_RETRY_QUEUE_KEY);
    if (!raw) {
      storageUploadRetryQueueCache = {};
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    const normalized = normalizeStorageUploadRetryQueue(parsed);
    storageUploadRetryQueueCache = normalized;
    return { ...normalized };
  } catch {
    storageUploadRetryQueueCache = {};
    return {};
  }
}

async function setStorageUploadRetryQueue(queue: StorageUploadRetryQueue): Promise<void> {
  storageUploadRetryQueueCache = { ...queue };
  await AsyncStorage.setItem(STORAGE_UPLOAD_RETRY_QUEUE_KEY, JSON.stringify(storageUploadRetryQueueCache));
}

function computeStorageUploadRetryDelayMs(attempts: number): number {
  const sanitizedAttempts = Math.max(1, Math.floor(attempts));
  const exponential = STORAGE_UPLOAD_RETRY_BASE_DELAY_MS * 2 ** Math.max(0, sanitizedAttempts - 1);
  return Math.min(STORAGE_UPLOAD_RETRY_MAX_DELAY_MS, exponential);
}

function shouldDeferStorageUploadRetry(entry: StorageUploadRetryEntry | undefined, now: number): boolean {
  return !!entry && entry.nextRetryAt > now;
}

function buildStorageUploadRetryEntry(params: {
  mediaId: string;
  projectId: string;
  mediaType: MediaItem['type'];
  previous: StorageUploadRetryEntry | undefined;
  errorMessage: string;
}): StorageUploadRetryEntry {
  const now = Date.now();
  const attempts = Math.min(
    STORAGE_UPLOAD_RETRY_MAX_ATTEMPTS,
    Math.max(1, (params.previous?.attempts || 0) + 1)
  );
  const delayMs = computeStorageUploadRetryDelayMs(attempts);

  return {
    mediaId: params.mediaId,
    projectId: params.projectId,
    mediaType: params.mediaType,
    attempts,
    nextRetryAt: now + delayMs,
    lastError: params.errorMessage.slice(0, 280),
    updatedAt: now,
  };
}

function getRetryQueueEntryDelaySeconds(entry: StorageUploadRetryEntry): number {
  return Math.max(0, Math.ceil((entry.nextRetryAt - Date.now()) / 1000));
}

function isStoragePayloadTooLargeError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('payload too large') ||
    normalized.includes('statuscode":"413') ||
    normalized.includes('statuscode:413') ||
    normalized.includes('http upload failed (413)') ||
    normalized.includes('exceeded the maximum allowed size')
  );
}

function getStoragePublicUrl(bucket: string, objectPath: string): string | null {
  const normalizedBucket = bucket.trim();
  const normalizedPath = objectPath.trim();
  if (!normalizedBucket || !normalizedPath) return null;
  const {
    data: { publicUrl },
  } = supabase.storage.from(normalizedBucket).getPublicUrl(normalizedPath);
  return isRemoteUri(publicUrl) ? publicUrl : null;
}

function stripUriParams(uri: string): string {
  return uri.split('#')[0].split('?')[0];
}

function fileExtensionFromUri(uri: string, fallback: string): string {
  const cleaned = stripUriParams(uri).toLowerCase();
  const match = cleaned.match(/\.([a-z0-9]+)$/i);
  if (!match) return fallback;
  return match[1];
}

function inferContentType(
  extension: string,
  mediaType: MediaItem['type'],
  fallback: string = 'application/octet-stream'
): string {
  const ext = extension.toLowerCase();
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    heic: 'image/heic',
    heif: 'image/heif',
    gif: 'image/gif',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    m4v: 'video/x-m4v',
    webm: 'video/webm',
    mkv: 'video/x-matroska',
    avi: 'video/x-msvideo',
    pdf: 'application/pdf',
    txt: 'text/plain',
    csv: 'text/csv',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  };
  if (map[ext]) return map[ext];
  if (mediaType === 'photo') return 'image/jpeg';
  if (mediaType === 'video') return 'video/mp4';
  if (mediaType === 'doc') return 'application/octet-stream';
  return fallback;
}

function decodeBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const atobFn = (globalThis as { atob?: (value: string) => string }).atob;
  if (!atobFn) {
    throw new Error('Base64 decoder is unavailable in this runtime');
  }
  const binary = atobFn(base64.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

async function readLocalFileAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const localUri = uri.startsWith('file://') ? uri : `file://${uri}`;
  const info = await FileSystem.getInfoAsync(localUri);
  if (!info.exists || info.isDirectory) {
    throw new Error(`Local file not found: ${uri}`);
  }

  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return decodeBase64ToArrayBuffer(base64);
}

function buildStorageObjectPath(params: {
  userId: string;
  projectId: string;
  mediaId: string;
  kind: 'media' | 'thumbs';
  extension: string;
}): string {
  const safeExtension = params.extension.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  return `users/${params.userId}/projects/${params.projectId}/${params.kind}/${params.mediaId}.${safeExtension}`;
}

function encodeStoragePath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

async function uploadLocalFileToStorageViaHttp(params: {
  localUri: string;
  objectPath: string;
  contentType: string;
}): Promise<void> {
  if (!SUPABASE_STORAGE_URL || !SUPABASE_STORAGE_ANON_KEY) {
    throw new Error('Supabase storage upload configuration is missing');
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) {
    mergeErrors(sessionError, 'Unable to resolve auth session for storage upload');
  }

  const localUri = toLocalFileUri(params.localUri);
  const uploadUrl = `${SUPABASE_STORAGE_URL.replace(/\/$/, '')}/storage/v1/object/${STORAGE_BUCKET}/${encodeStoragePath(
    params.objectPath
  )}`;
  const result = await FileSystem.uploadAsync(uploadUrl, localUri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_STORAGE_ANON_KEY,
      'x-upsert': 'true',
      'content-type': params.contentType,
      'cache-control': '31536000',
    },
  });

  if (result.status < 200 || result.status >= 300) {
    const responseBody = typeof result.body === 'string' ? result.body.slice(0, 300) : '';
    if (
      result.status === 413 ||
      (responseBody && isStoragePayloadTooLargeError(responseBody)) ||
      isStoragePayloadTooLargeError(`status=${result.status} ${responseBody}`)
    ) {
      throw new Error(
        `Storage payload too large (413)${
          responseBody ? `: ${responseBody}` : ': object exceeded maximum allowed size'
        }`
      );
    }
    throw new Error(`Storage HTTP upload failed (${result.status})${responseBody ? `: ${responseBody}` : ''}`);
  }
}

async function uploadLocalFileToStorage(params: {
  localUri: string;
  objectPath: string;
  mediaType: MediaItem['type'];
  extension: string;
}): Promise<{ objectPath: string; publicUrl: string }> {
  const localUri = toLocalFileUri(params.localUri);
  const info = await FileSystem.getInfoAsync(localUri);
  if (!info.exists || info.isDirectory) {
    throw new Error(`Local file not found: ${params.localUri}`);
  }
  const fileSizeBytes = typeof info.size === 'number' && Number.isFinite(info.size) ? info.size : null;

  const contentType = inferContentType(params.extension, params.mediaType);
  try {
    await uploadLocalFileToStorageViaHttp({
      localUri,
      objectPath: params.objectPath,
      contentType,
    });
  } catch (httpUploadError) {
    // Avoid risky base64 fallback for large/unknown files and all videos.
    const allowBase64Fallback =
      params.mediaType === 'photo' &&
      fileSizeBytes !== null &&
      fileSizeBytes > 0 &&
      fileSizeBytes <= MAX_BASE64_UPLOAD_FALLBACK_BYTES;
    if (!allowBase64Fallback) {
      throw httpUploadError;
    }

    const payload = await readLocalFileAsArrayBuffer(localUri);
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(params.objectPath, payload, {
        upsert: true,
        contentType,
        cacheControl: '31536000',
      });
    if (uploadError) {
      mergeErrors(uploadError, 'Unable to upload media file to storage');
    }
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(params.objectPath);

  if (!publicUrl || !isRemoteUri(publicUrl)) {
    throw new Error('Unable to generate media public URL');
  }

  return {
    objectPath: params.objectPath,
    publicUrl,
  };
}

function parseStorageObjectPathFromUrl(uri: string | null | undefined): string | null {
  if (!uri || !isRemoteUri(uri)) return null;
  try {
    const url = new URL(uri);
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.includes(PUBLIC_STORAGE_PATH_SEGMENT)) {
      return pathname.split(PUBLIC_STORAGE_PATH_SEGMENT)[1] || null;
    }
    if (pathname.includes(SIGNED_STORAGE_PATH_SEGMENT)) {
      return pathname.split(SIGNED_STORAGE_PATH_SEGMENT)[1] || null;
    }
    return null;
  } catch {
    return null;
  }
}

function withStorageMetadata(
  baseMetadata: Record<string, unknown>,
  patch: {
    bucket?: string;
    file_path?: string | null;
    thumb_path?: string | null;
    source_uri?: string | null;
    source_thumb_uri?: string | null;
    synced_at?: string | null;
    upload_pending?: boolean | null;
    upload_attempts?: number | null;
    upload_next_retry_at?: string | null;
    upload_last_error?: string | null;
    upload_last_error_at?: string | null;
    upload_blocked?: boolean | null;
    upload_block_reason?: string | null;
    upload_blocked_at?: string | null;
  }
): Record<string, unknown> {
  const existingStorage =
    baseMetadata.storage && typeof baseMetadata.storage === 'object' && !Array.isArray(baseMetadata.storage)
      ? (baseMetadata.storage as Record<string, unknown>)
      : {};

  return {
    ...baseMetadata,
    storage: {
      ...existingStorage,
      ...patch,
    },
  };
}

function extractStorageObjectPathsFromMedia(row: {
  uri?: string | null;
  thumb_uri?: string | null;
  metadata?: unknown;
}): string[] {
  const metadata = toMetadataPayload(row.metadata);
  const storage =
    metadata.storage && typeof metadata.storage === 'object' && !Array.isArray(metadata.storage)
      ? (metadata.storage as Record<string, unknown>)
      : {};

  const fromMetadata = [
    typeof storage.file_path === 'string' ? storage.file_path : null,
    typeof storage.thumb_path === 'string' ? storage.thumb_path : null,
  ];

  const fromUrls = [
    parseStorageObjectPathFromUrl(row.uri || null),
    parseStorageObjectPathFromUrl(row.thumb_uri || null),
  ];

  return Array.from(
    new Set(
      [...fromMetadata, ...fromUrls]
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value) => value.length > 0)
    )
  );
}

type SyncedStorageMedia = {
  uri: string;
  thumb_uri: string | null;
  metadata: Record<string, unknown>;
  uploaded: boolean;
};

async function uploadMediaAssetsToStorage(params: {
  authUserId: string;
  projectId: string;
  mediaId: string;
  mediaType: MediaItem['type'];
  uri: string;
  thumbUri: string | null;
  metadata: Record<string, unknown>;
}): Promise<SyncedStorageMedia> {
  const nextMetadata = { ...params.metadata };
  const trimmedUri = params.uri.trim();
  const trimmedThumb = params.thumbUri?.trim() || null;

  let nextUri = trimmedUri;
  let nextThumbUri = trimmedThumb;
  let uploaded = false;
  let filePath: string | null = null;
  let thumbPath: string | null = null;

  if (!isRemoteUri(trimmedUri)) {
    const mediaExtension = fileExtensionFromUri(
      trimmedUri,
      params.mediaType === 'photo' ? 'jpg' : params.mediaType === 'video' ? 'mp4' : 'bin'
    );
    const mediaObjectPath = buildStorageObjectPath({
      userId: params.authUserId,
      projectId: params.projectId,
      mediaId: params.mediaId,
      kind: 'media',
      extension: mediaExtension,
    });
    const uploadedMedia = await uploadLocalFileToStorage({
      localUri: trimmedUri,
      objectPath: mediaObjectPath,
      mediaType: params.mediaType,
      extension: mediaExtension,
    });
    nextUri = uploadedMedia.publicUrl;
    filePath = uploadedMedia.objectPath;
    uploaded = true;
  } else {
    filePath = parseStorageObjectPathFromUrl(trimmedUri);
  }

  if (trimmedThumb) {
    if (trimmedThumb === trimmedUri && nextUri) {
      nextThumbUri = nextUri;
      thumbPath = filePath;
    } else if (!isRemoteUri(trimmedThumb)) {
      const thumbExtension = fileExtensionFromUri(trimmedThumb, 'jpg');
      const thumbObjectPath = buildStorageObjectPath({
        userId: params.authUserId,
        projectId: params.projectId,
        mediaId: `${params.mediaId}-thumb`,
        kind: 'thumbs',
        extension: thumbExtension,
      });
      const uploadedThumb = await uploadLocalFileToStorage({
        localUri: trimmedThumb,
        objectPath: thumbObjectPath,
        mediaType: 'photo',
        extension: thumbExtension,
      });
      nextThumbUri = uploadedThumb.publicUrl;
      thumbPath = uploadedThumb.objectPath;
      uploaded = true;
    } else {
      thumbPath = parseStorageObjectPathFromUrl(trimmedThumb);
    }
  } else if (params.mediaType === 'photo') {
    nextThumbUri = nextUri;
    thumbPath = filePath;
  }

  const syncedMetadata = withStorageMetadata(nextMetadata, {
    bucket: STORAGE_BUCKET,
    file_path: filePath,
    thumb_path: thumbPath,
    source_uri: trimmedUri,
    source_thumb_uri: trimmedThumb,
    synced_at: new Date().toISOString(),
    upload_pending: false,
    upload_attempts: null,
    upload_next_retry_at: null,
    upload_last_error: null,
    upload_last_error_at: null,
    upload_blocked: false,
    upload_block_reason: null,
    upload_blocked_at: null,
  });

  return {
    uri: nextUri,
    thumb_uri: nextThumbUri,
    metadata: syncedMetadata,
    uploaded,
  };
}

async function backfillProjectMediaStorage(
  authUserId: string,
  projectId: string,
  mediaRows: SupabaseMediaRow[]
): Promise<SupabaseMediaRow[]> {
  if (mediaRows.length === 0) return mediaRows;

  const retryQueue = await getStorageUploadRetryQueue();
  let retryQueueDirty = false;
  const nextRows = [...mediaRows];
  for (let index = 0; index < nextRows.length; index += 1) {
    const row = nextRows[index];
    if (!row?.id || row.project_id !== projectId) {
      continue;
    }

    if (isRemoteUri(row.uri)) {
      if (retryQueue[row.id]) {
        delete retryQueue[row.id];
        retryQueueDirty = true;
      }
      continue;
    }

    // Backfill only rows created by the current user; cross-device local paths are not portable.
    if (!row.uploaded_by_user_id || row.uploaded_by_user_id !== authUserId) {
      continue;
    }

    const retryEntry = retryQueue[row.id];
    if (shouldDeferStorageUploadRetry(retryEntry, Date.now())) {
      continue;
    }

    const rowMetadata = toMetadataPayload(row.metadata);
    const rowStorageMeta =
      rowMetadata.storage && typeof rowMetadata.storage === 'object' && !Array.isArray(rowMetadata.storage)
        ? (rowMetadata.storage as Record<string, unknown>)
        : {};
    const blockedReason =
      typeof rowStorageMeta.upload_block_reason === 'string' ? rowStorageMeta.upload_block_reason : null;
    if (blockedReason === 'payload_too_large') {
      if (retryEntry) {
        delete retryQueue[row.id];
        retryQueueDirty = true;
      }
      continue;
    }

    if (!(await localFileExists(row.uri))) {
      if (retryEntry) {
        delete retryQueue[row.id];
        retryQueueDirty = true;
      }
      continue;
    }

    try {
      const synced = await uploadMediaAssetsToStorage({
        authUserId,
        projectId,
        mediaId: row.id,
        mediaType: row.type === 'video' || row.type === 'doc' ? row.type : 'photo',
        uri: row.uri,
        thumbUri: row.thumb_uri,
        metadata: toMetadataPayload(row.metadata),
      });

      if (!synced.uploaded) continue;

      const { data: updatedRowRaw, error: updateError } = await supabase
        .from('media')
        .update({
          uri: synced.uri,
          thumb_uri: synced.thumb_uri,
          metadata: synced.metadata,
        })
        .eq('id', row.id)
        .select(MEDIA_COLUMNS)
        .single();
      if (updateError || !updatedRowRaw) {
        mergeErrors(updateError, 'Unable to backfill media storage');
      }
      nextRows[index] = updatedRowRaw as SupabaseMediaRow;
      if (retryEntry) {
        delete retryQueue[row.id];
        retryQueueDirty = true;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? '');
      if (message.toLowerCase().includes('local file not found')) {
        if (retryEntry) {
          delete retryQueue[row.id];
          retryQueueDirty = true;
        }
        continue;
      }

      if (isStoragePayloadTooLargeError(message)) {
        const blockedMetadata = withStorageMetadata(toMetadataPayload(row.metadata), {
          upload_pending: false,
          upload_attempts: null,
          upload_next_retry_at: null,
          upload_last_error: message.slice(0, 280),
          upload_last_error_at: new Date().toISOString(),
          upload_blocked: true,
          upload_block_reason: 'payload_too_large',
          upload_blocked_at: new Date().toISOString(),
        });
        try {
          const { data: blockedRowRaw, error: blockedUpdateError } = await supabase
            .from('media')
            .update({ metadata: blockedMetadata })
            .eq('id', row.id)
            .select(MEDIA_COLUMNS)
            .single();
          if (!blockedUpdateError && blockedRowRaw) {
            nextRows[index] = blockedRowRaw as SupabaseMediaRow;
          }
        } catch {
          // Non-blocking: keep the local flow resilient.
        }

        if (retryEntry) {
          delete retryQueue[row.id];
          retryQueueDirty = true;
        }
        console.log('Media storage backfill blocked (payload too large):', row.id);
        continue;
      }

      const nextRetry = buildStorageUploadRetryEntry({
        mediaId: row.id,
        projectId,
        mediaType: row.type === 'video' || row.type === 'doc' ? row.type : 'photo',
        previous: retryEntry,
        errorMessage: message || 'storage_backfill_failed',
      });
      retryQueue[row.id] = nextRetry;
      retryQueueDirty = true;

      console.log(
        'Media storage backfill warning:',
        row.id,
        error,
        `(retry in ${getRetryQueueEntryDelaySeconds(nextRetry)}s, attempt ${nextRetry.attempts})`
      );
    }
  }

  if (retryQueueDirty) {
    await setStorageUploadRetryQueue(retryQueue);
  }

  return nextRows;
}

function normalizeProjectRow(row: SupabaseProjectRow) {
  const status: ProjectStatus =
    row.status === 'active' || row.status === 'delayed' || row.status === 'completed'
      ? row.status
      : 'neutral';
  const statusOverride: ProjectStatus | null =
    row.status_override === 'active' ||
    row.status_override === 'delayed' ||
    row.status_override === 'completed' ||
    row.status_override === 'neutral'
      ? row.status_override
      : null;
  const visibility: ProjectVisibility = row.visibility === 'public' ? 'public' : 'private';

  return {
    id: row.id,
    owner_user_id: row.owner_user_id,
    organization_id: row.organization_id,
    name: row.name,
    client: row.client,
    location: row.location,
    status,
    status_override: statusOverride,
    visibility,
    public_slug: row.public_slug,
    public_published_at: toNullableMillis(row.public_published_at),
    public_updated_at: toNullableMillis(row.public_updated_at),
    progress: row.progress ?? 0,
    start_date: toNullableMillis(row.start_date),
    end_date: toNullableMillis(row.end_date),
    budget: normalizeBudget(row.budget),
    created_at: toMillis(row.created_at),
    updated_at: toMillis(row.updated_at),
  };
}

function normalizeActivityRow(row: SupabaseActivityRow) {
  return {
    id: row.id,
    project_id: row.project_id,
    action_type: row.action_type,
    reference_id: row.reference_id,
    actor_user_id: row.actor_user_id,
    actor_name_snapshot: row.actor_name_snapshot,
    metadata: normalizeMetadata(row.metadata),
    created_at: toMillis(row.created_at),
  };
}

function normalizeFolderRow(row: SupabaseFolderRow) {
  return {
    id: row.id,
    project_id: row.project_id,
    name: row.name,
    created_at: toMillis(row.created_at),
  };
}

function normalizeMediaRow(row: SupabaseMediaRow) {
  const type: MediaItem['type'] = row.type === 'video' || row.type === 'doc' ? row.type : 'photo';
  const metadata = toMetadataPayload(row.metadata);
  const storage =
    metadata.storage && typeof metadata.storage === 'object' && !Array.isArray(metadata.storage)
      ? (metadata.storage as Record<string, unknown>)
      : {};
  const storageBucket =
    typeof storage.bucket === 'string' && storage.bucket.trim().length > 0
      ? storage.bucket.trim()
      : STORAGE_BUCKET;

  let resolvedUri = row.uri;
  if (!isRemoteUri(resolvedUri) && typeof storage.file_path === 'string') {
    const storageUri = getStoragePublicUrl(storageBucket, storage.file_path);
    if (storageUri) {
      resolvedUri = storageUri;
    }
  }
  if (
    !isRemoteUri(resolvedUri) &&
    (!storage.file_path || typeof storage.file_path !== 'string') &&
    typeof row.uploaded_by_user_id === 'string' &&
    row.uploaded_by_user_id.trim().length > 0
  ) {
    const guessedPath = buildStorageObjectPath({
      userId: row.uploaded_by_user_id.trim(),
      projectId: row.project_id,
      mediaId: row.id,
      kind: 'media',
      extension: fileExtensionFromUri(row.uri, type === 'photo' ? 'jpg' : type === 'video' ? 'mp4' : 'bin'),
    });
    const guessedUri = getStoragePublicUrl(storageBucket, guessedPath);
    if (guessedUri) {
      resolvedUri = guessedUri;
    }
  }

  let resolvedThumbUri = row.thumb_uri;
  if (resolvedThumbUri && !isRemoteUri(resolvedThumbUri) && typeof storage.thumb_path === 'string') {
    const storageThumbUri = getStoragePublicUrl(storageBucket, storage.thumb_path);
    if (storageThumbUri) {
      resolvedThumbUri = storageThumbUri;
    }
  }
  if (
    resolvedThumbUri &&
    !isRemoteUri(resolvedThumbUri) &&
    (!storage.thumb_path || typeof storage.thumb_path !== 'string') &&
    typeof row.uploaded_by_user_id === 'string' &&
    row.uploaded_by_user_id.trim().length > 0
  ) {
    const guessedThumbPath = buildStorageObjectPath({
      userId: row.uploaded_by_user_id.trim(),
      projectId: row.project_id,
      mediaId: `${row.id}-thumb`,
      kind: 'thumbs',
      extension: fileExtensionFromUri(row.thumb_uri || row.uri, 'jpg'),
    });
    const guessedThumbUri = getStoragePublicUrl(storageBucket, guessedThumbPath);
    if (guessedThumbUri) {
      resolvedThumbUri = guessedThumbUri;
    }
  }

  if (type === 'photo' && (!resolvedThumbUri || resolvedThumbUri.trim().length === 0)) {
    resolvedThumbUri = resolvedUri;
  }

  return {
    id: row.id,
    project_id: row.project_id,
    folder_id: row.folder_id,
    type,
    uri: resolvedUri,
    thumb_uri: resolvedThumbUri,
    note: row.note,
    metadata: normalizeMetadata(metadata),
    created_at: toMillis(row.created_at),
  };
}

function normalizeNoteRow(row: SupabaseNoteRow) {
  return {
    id: row.id,
    project_id: row.project_id,
    media_id: row.media_id,
    author_user_id: row.author_user_id,
    title: row.title,
    content: row.content,
    created_at: toMillis(row.created_at),
    updated_at: toMillis(row.updated_at),
  };
}

function normalizeProjectMemberRole(value: string | null | undefined): ProjectMemberRole {
  if (value === 'owner' || value === 'manager' || value === 'worker' || value === 'client') {
    return value;
  }
  return 'worker';
}

function normalizeProjectMemberStatus(value: string | null | undefined): ProjectMemberStatus {
  if (value === 'active' || value === 'invited' || value === 'removed') {
    return value;
  }
  return 'invited';
}

function normalizeProjectMemberRow(row: SupabaseProjectMemberRow) {
  const status = normalizeProjectMemberStatus(row.status);
  const acceptedAt = row.accepted_at ? toMillis(row.accepted_at) : status === 'active' ? toMillis(row.updated_at) : null;
  return {
    id: row.id,
    project_id: row.project_id,
    user_id: row.user_id,
    invited_email: row.invited_email,
    role: normalizeProjectMemberRole(row.role),
    status,
    invited_by: row.invited_by,
    user_name_snapshot: row.user_name_snapshot,
    user_email_snapshot: row.user_email_snapshot,
    created_at: toMillis(row.created_at),
    updated_at: toMillis(row.updated_at),
    accepted_at: acceptedAt,
  };
}

function normalizeProjectPublicProfileRow(row: SupabaseProjectPublicProfileRow) {
  return {
    project_id: row.project_id,
    public_title: row.public_title,
    summary: row.summary,
    city: row.city,
    region: row.region,
    category: row.category,
    hero_media_id: row.hero_media_id,
    hero_comment: row.hero_comment,
    contact_email: row.contact_email,
    contact_phone: row.contact_phone,
    website_url: row.website_url,
    highlights_json: normalizeMetadata(row.highlights_json),
    created_at: toMillis(row.created_at),
    updated_at: toMillis(row.updated_at),
  };
}

function chunkArray<T>(source: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < source.length; index += size) {
    chunks.push(source.slice(index, index + size));
  }
  return chunks;
}

function mergeErrors(error: { message?: string } | null | undefined, fallback: string): never {
  throw new Error(typeof error?.message === 'string' && error.message.trim().length > 0 ? error.message : fallback);
}

function isRecoverableAuthSessionError(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized.includes('auth session missing') ||
    normalized.includes('invalid refresh token') ||
    normalized.includes('refresh token not found')
  );
}

async function requireAuthUser(actionLabel: string): Promise<SupabaseUser> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error(error?.message || `Must be signed in to ${actionLabel}`);
  }
  return data.user;
}

async function requireAuthUserForSyncOrNull(actionLabel: string): Promise<SupabaseUser | null> {
  try {
    return await requireAuthUser(actionLabel);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? '');
    if (isRecoverableAuthSessionError(message)) {
      console.log(`Supabase ${actionLabel} skipped: ${message}`);
      return null;
    }
    throw error;
  }
}

function getActorName(authUser: SupabaseUser): string | null {
  const metadataName =
    typeof authUser.user_metadata?.full_name === 'string'
      ? authUser.user_metadata.full_name
      : typeof authUser.user_metadata?.name === 'string'
        ? authUser.user_metadata.name
        : null;
  const fallback = authUser.email?.split('@')[0] || null;
  const resolved = (metadataName || fallback || '').trim();
  return resolved.length > 0 ? resolved : null;
}

async function syncProjectPublicProfileSnapshotFromSupabase(projectId: string): Promise<void> {
  const normalizedProjectId = projectId.trim();
  if (!normalizedProjectId) return;

  const { data: profileRowRaw, error } = await supabase
    .from('project_public_profiles')
    .select(PROJECT_PUBLIC_PROFILE_COLUMNS)
    .eq('project_id', normalizedProjectId)
    .maybeSingle();

  if (error) {
    console.log('Public profile sync warning:', error.message);
    return;
  }

  if (!profileRowRaw) {
    mergeProjectPublicProfileSnapshotFromSupabase(normalizedProjectId, null);
    return;
  }

  mergeProjectPublicProfileSnapshotFromSupabase(
    normalizedProjectId,
    normalizeProjectPublicProfileRow(profileRowRaw as SupabaseProjectPublicProfileRow)
  );
}

async function syncProjectMembersSnapshotFromSupabase(
  projectId: string,
  currentAuthUserId: string
): Promise<void> {
  const { data: memberRowsRaw, error: membersError } = await supabase
    .from('project_members')
    .select(PROJECT_MEMBER_COLUMNS)
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  if (membersError) {
    mergeErrors(membersError, 'Failed to load project members');
  }

  mergeProjectMembersSnapshotFromSupabase(
    {
      currentAuthUserId,
      projectId,
      members: ((memberRowsRaw || []) as SupabaseProjectMemberRow[]).map(normalizeProjectMemberRow),
    },
    { pruneMissing: true }
  );
}

async function syncPublicMediaPostsForProjectVisibility(params: {
  authUserId: string;
  projectId: string;
  organizationId: string | null;
  visibility: ProjectVisibility;
}): Promise<ProjectVisibilityFeedSyncSummary> {
  const summary: ProjectVisibilityFeedSyncSummary = {
    visibility: params.visibility,
    totalMedia: 0,
    inserted: 0,
    republished: 0,
    updatedPublished: 0,
    unpublished: 0,
    skippedRemoved: 0,
  };
  const nowIso = new Date().toISOString();

  if (params.visibility === 'private') {
    const { data: activeRowsRaw, error: activeLookupError } = await supabase
      .from('public_media_posts')
      .select('id')
      .eq('project_id', params.projectId)
      .neq('status', 'removed')
      .neq('status', 'unpublished');
    if (activeLookupError) {
      console.log('Public media visibility sync warning (private lookup):', activeLookupError.message);
      return summary;
    }
    const activeRows = (activeRowsRaw || []) as Array<{ id?: string }>;
    summary.totalMedia = activeRows.length;
    if (activeRows.length === 0) {
      return summary;
    }

    const { error } = await supabase
      .from('public_media_posts')
      .update({ status: 'unpublished' })
      .eq('project_id', params.projectId)
      .neq('status', 'removed')
      .neq('status', 'unpublished');
    if (error) {
      console.log('Public media visibility sync warning (unpublish):', error.message);
      return summary;
    }
    summary.unpublished = activeRows.length;
    return summary;
  }

  const { data: mediaRowsRaw, error: mediaError } = await supabase
    .from('media')
    .select('id, note')
    .eq('project_id', params.projectId);
  if (mediaError) {
    console.log('Public media visibility sync warning (media lookup):', mediaError.message);
    return summary;
  }

  const mediaRows = (mediaRowsRaw || []) as SupabaseProjectMediaCaptionRow[];
  summary.totalMedia = mediaRows.length;
  if (mediaRows.length === 0) return summary;

  const { data: postRowsRaw, error: postError } = await supabase
    .from('public_media_posts')
    .select('id, media_id, caption, status')
    .eq('project_id', params.projectId);
  if (postError) {
    console.log('Public media visibility sync warning (post lookup):', postError.message);
    return summary;
  }

  const postsByMediaId = new Map<string, SupabasePublicMediaPostLookupRow>();
  for (const row of (postRowsRaw || []) as SupabasePublicMediaPostLookupRow[]) {
    if (!row?.media_id) continue;
    if (postsByMediaId.has(row.media_id)) continue;
    postsByMediaId.set(row.media_id, row);
  }

  const rowsToInsert: Array<Record<string, unknown>> = [];
  const rowsToUpdate: Array<{
    id: string;
    caption: string | null;
    wasPublished: boolean;
  }> = [];

  for (const mediaRow of mediaRows) {
    const mediaId = mediaRow.id?.trim();
    if (!mediaId) continue;
    const derivedCaption = mediaRow.note?.trim() || null;
    const existingPost = postsByMediaId.get(mediaId);

    if (existingPost?.status === 'removed') {
      summary.skippedRemoved += 1;
      continue;
    }

    if (existingPost?.id) {
      rowsToUpdate.push({
        id: existingPost.id,
        caption: existingPost.caption?.trim() || derivedCaption,
        wasPublished: existingPost.status === 'published',
      });
      continue;
    }

    rowsToInsert.push({
      project_id: params.projectId,
      media_id: mediaId,
      organization_id: params.organizationId,
      caption: derivedCaption,
      published_by_user_id: params.authUserId,
      status: 'published',
      published_at: nowIso,
    });
  }

  for (const row of rowsToUpdate) {
    const { error } = await supabase
      .from('public_media_posts')
      .update({
        organization_id: params.organizationId,
        caption: row.caption,
        published_by_user_id: params.authUserId,
        status: 'published',
        published_at: nowIso,
      })
      .eq('id', row.id);
    if (error) {
      console.log('Public media visibility sync warning (update):', error.message);
      continue;
    }
    if (row.wasPublished) {
      summary.updatedPublished += 1;
    } else {
      summary.republished += 1;
    }
  }

  for (const chunk of chunkArray(rowsToInsert, 200)) {
    const { error } = await supabase.from('public_media_posts').insert(chunk);
    if (error) {
      console.log('Public media visibility sync warning (insert):', error.message);
      continue;
    }
    summary.inserted += chunk.length;
  }

  return summary;
}

async function maybePublishMediaPostForPublicProject(params: {
  authUserId: string;
  projectId: string;
  mediaId: string;
  caption?: string | null;
}): Promise<void> {
  try {
    const { data: projectRowRaw, error: projectLookupError } = await supabase
      .from('projects')
      .select('id, organization_id, visibility')
      .eq('id', params.projectId)
      .maybeSingle();
    if (projectLookupError) {
      console.log('Public media auto-publish warning (project lookup):', projectLookupError.message);
      return;
    }

    const projectRow = projectRowRaw as SupabaseProjectVisibilityRow | null;
    const localProject = getProjectById(params.projectId);
    const remoteIsPublic = projectRow?.visibility === 'public';
    const localIsPublic = localProject?.visibility === 'public';
    if (!remoteIsPublic && !localIsPublic) {
      return;
    }

    const organizationId = projectRow?.organization_id ?? localProject?.organization_id ?? null;
    const trimmedCaption = typeof params.caption === 'string' ? params.caption.trim() : '';

    const { data: existingPostRow, error: existingPostError } = await supabase
      .from('public_media_posts')
      .select('id, status')
      .eq('media_id', params.mediaId)
      .maybeSingle();
    if (existingPostError) {
      console.log('Public media auto-publish warning (existing post lookup):', existingPostError.message);
      return;
    }

    if (existingPostRow?.id) {
      const { error: updateError } = await supabase
        .from('public_media_posts')
        .update({
          organization_id: organizationId,
          caption: trimmedCaption || null,
          published_by_user_id: params.authUserId,
          status: 'published',
          published_at: new Date().toISOString(),
        })
        .eq('id', existingPostRow.id);
      if (updateError) {
        console.log('Public media auto-publish warning (update):', updateError.message);
      }
      return;
    }

    const { error: insertError } = await supabase.from('public_media_posts').insert({
      project_id: params.projectId,
      media_id: params.mediaId,
      organization_id: organizationId,
      caption: trimmedCaption || null,
      published_by_user_id: params.authUserId,
      status: 'published',
      published_at: new Date().toISOString(),
    });
    if (insertError) {
      console.log('Public media auto-publish warning (insert):', insertError.message);
    }
  } catch (error) {
    console.log('Public media auto-publish warning:', error);
  }
}

export async function syncProjectsAndActivityFromSupabase(): Promise<void> {
  const authUser = await requireAuthUserForSyncOrNull('sync projects and activity');
  if (!authUser) return;

  const { data: ownedProjectRowsRaw, error: ownedProjectsError } = await supabase
    .from('projects')
    .select(PROJECT_COLUMNS)
    .eq('owner_user_id', authUser.id)
    .order('updated_at', { ascending: false });

  if (ownedProjectsError) {
    mergeErrors(ownedProjectsError, 'Failed to load owned projects');
  }

  const { data: assignedProjectMembershipRowsRaw, error: assignedMembershipError } = await supabase
    .from('project_members')
    .select('project_id')
    .eq('user_id', authUser.id)
    .eq('status', 'active');

  if (assignedMembershipError) {
    mergeErrors(assignedMembershipError, 'Failed to load assigned project memberships');
  }

  const assignedProjectIds = Array.from(
    new Set(
      ((assignedProjectMembershipRowsRaw || []) as Array<{ project_id?: string | null }>)
        .map((row) => (typeof row.project_id === 'string' ? row.project_id.trim() : ''))
        .filter((value) => value.length > 0)
    )
  );

  const assignedProjectRows: SupabaseProjectRow[] = [];
  if (assignedProjectIds.length > 0) {
    const idChunks = chunkArray(assignedProjectIds, 100);
    for (const chunk of idChunks) {
      const { data: assignedRowsRaw, error: assignedProjectsError } = await supabase
        .from('projects')
        .select(PROJECT_COLUMNS)
        .in('id', chunk);

      if (assignedProjectsError) {
        mergeErrors(assignedProjectsError, 'Failed to load assigned projects');
      }
      assignedProjectRows.push(...((assignedRowsRaw || []) as SupabaseProjectRow[]));
    }
  }

  const mergedProjectsById = new Map<string, SupabaseProjectRow>();
  for (const row of ((ownedProjectRowsRaw || []) as SupabaseProjectRow[])) {
    if (typeof row.id === 'string' && row.id.trim().length > 0) {
      mergedProjectsById.set(row.id, row);
    }
  }
  for (const row of assignedProjectRows) {
    if (typeof row.id === 'string' && row.id.trim().length > 0) {
      mergedProjectsById.set(row.id, row);
    }
  }

  const projectRows = Array.from(mergedProjectsById.values()).sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
  const projectIds = projectRows.map((project) => project.id).filter(Boolean);

  if (projectIds.length > 0) {
    const memberRows: SupabaseProjectMemberRow[] = [];
    const chunks = chunkArray(projectIds, 100);
    for (const chunk of chunks) {
      const { data: rowsRaw, error } = await supabase
        .from('project_members')
        .select(PROJECT_MEMBER_COLUMNS)
        .in('project_id', chunk)
        .order('created_at', { ascending: true });
      if (error) {
        mergeErrors(error, 'Failed to load project members');
      }
      memberRows.push(...((rowsRaw || []) as SupabaseProjectMemberRow[]));
    }

    const membersByProjectId = new Map<string, SupabaseProjectMemberRow[]>();
    for (const row of memberRows) {
      const projectId = typeof row.project_id === 'string' ? row.project_id.trim() : '';
      if (!projectId) continue;
      const bucket = membersByProjectId.get(projectId);
      if (bucket) {
        bucket.push(row);
      } else {
        membersByProjectId.set(projectId, [row]);
      }
    }

    for (const projectId of projectIds) {
      const projectMemberRows = membersByProjectId.get(projectId) || [];
      mergeProjectMembersSnapshotFromSupabase(
        {
          currentAuthUserId: authUser.id,
          projectId,
          members: projectMemberRows.map(normalizeProjectMemberRow),
        },
        { pruneMissing: true }
      );
    }
  }

  const activityRows: SupabaseActivityRow[] = [];
  if (projectIds.length > 0) {
    const chunks = chunkArray(projectIds, 100);
    for (const chunk of chunks) {
      const { data: rowsRaw, error } = await supabase
        .from('activity_log')
        .select(ACTIVITY_COLUMNS)
        .in('project_id', chunk)
        .order('created_at', { ascending: false })
        .limit(5000);
      if (error) {
        mergeErrors(error, 'Failed to load project activity');
      }
      activityRows.push(...((rowsRaw || []) as SupabaseActivityRow[]));
    }
  }

  mergeProjectsAndActivitySnapshotFromSupabase({
    currentAuthUserId: authUser.id,
    projects: projectRows.map(normalizeProjectRow),
    activities: activityRows.map(normalizeActivityRow),
  });
}

export async function syncProjectContentFromSupabase(projectId: string): Promise<void> {
  if (!isUuid(projectId)) return;

  const authUser = await requireAuthUserForSyncOrNull('sync project content');
  if (!authUser) return;

  const { data: folderRowsRaw, error: foldersError } = await supabase
    .from('folders')
    .select(FOLDER_COLUMNS)
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  if (foldersError) {
    mergeErrors(foldersError, 'Failed to load project folders');
  }

  const { data: mediaRowsRaw, error: mediaError } = await supabase
    .from('media')
    .select(MEDIA_COLUMNS)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (mediaError) {
    mergeErrors(mediaError, 'Failed to load project media');
  }

  const { data: noteRowsRaw, error: notesError } = await supabase
    .from('notes')
    .select(NOTE_COLUMNS)
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false });
  if (notesError) {
    mergeErrors(notesError, 'Failed to load project notes');
  }

  await syncProjectMembersSnapshotFromSupabase(projectId, authUser.id);

  let mediaRows = (mediaRowsRaw || []) as SupabaseMediaRow[];
  mediaRows = await backfillProjectMediaStorage(authUser.id, projectId, mediaRows);

  mergeProjectContentSnapshotFromSupabase(
    {
      projectId,
      folders: ((folderRowsRaw || []) as SupabaseFolderRow[]).map(normalizeFolderRow),
      media: mediaRows.map(normalizeMediaRow),
    },
    { pruneMissing: true }
  );

  mergeProjectNotesSnapshotFromSupabase(
    {
      currentAuthUserId: authUser.id,
      projectId,
      notes: ((noteRowsRaw || []) as SupabaseNoteRow[]).map(normalizeNoteRow),
    },
    { pruneMissing: true }
  );
}

export async function syncProjectMembersFromSupabase(projectId: string): Promise<void> {
  if (!isUuid(projectId)) return;

  const authUser = await requireAuthUserForSyncOrNull('sync project members');
  if (!authUser) return;
  await syncProjectMembersSnapshotFromSupabase(projectId, authUser.id);
}

export async function syncProjectNotesFromSupabase(projectId: string): Promise<void> {
  if (!isUuid(projectId)) return;

  const authUser = await requireAuthUserForSyncOrNull('sync project notes');
  if (!authUser) return;
  const { data: noteRowsRaw, error: notesError } = await supabase
    .from('notes')
    .select(NOTE_COLUMNS)
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false });
  if (notesError) {
    mergeErrors(notesError, 'Failed to load project notes');
  }

  mergeProjectNotesSnapshotFromSupabase(
    {
      currentAuthUserId: authUser.id,
      projectId,
      notes: ((noteRowsRaw || []) as SupabaseNoteRow[]).map(normalizeNoteRow),
    },
    { pruneMissing: true }
  );
}

export async function createProjectNoteInSupabase(data: {
  project_id: string;
  content: string;
  title?: string | null;
  media_id?: string | null;
}): Promise<Note> {
  const content = data.content.trim();
  if (!content) {
    throw new Error('Note content is required');
  }

  const title = typeof data.title === 'string' ? data.title.trim() : '';
  const mediaId =
    typeof data.media_id === 'string' && data.media_id.trim().length > 0 ? data.media_id.trim() : null;

  if (!isUuid(data.project_id)) {
    return createProjectNote({
      project_id: data.project_id,
      content,
      title: title || null,
      media_id: mediaId,
    });
  }

  const authUser = await requireAuthUser('create project note');
  let linkedMediaId: string | null = null;

  if (mediaId) {
    if (!isUuid(mediaId)) {
      throw new Error('Invalid linked media id');
    }
    const { data: mediaLookupRow, error: mediaLookupError } = await supabase
      .from('media')
      .select('id, project_id')
      .eq('id', mediaId)
      .maybeSingle();
    if (mediaLookupError) {
      mergeErrors(mediaLookupError, 'Unable to load linked media');
    }
    if (!mediaLookupRow?.id || mediaLookupRow.project_id !== data.project_id) {
      throw new Error('Linked media not found');
    }
    linkedMediaId = mediaLookupRow.id;
  }

  const { data: createdNoteRow, error: createError } = await supabase
    .from('notes')
    .insert({
      project_id: data.project_id,
      media_id: linkedMediaId,
      author_user_id: authUser.id,
      title: title || null,
      content,
    })
    .select(NOTE_COLUMNS)
    .single();
  if (createError || !createdNoteRow) {
    mergeErrors(createError, 'Unable to create note');
  }

  if (linkedMediaId) {
    const { data: updatedMediaRow, error: mediaUpdateError } = await supabase
      .from('media')
      .update({ note: content })
      .eq('id', linkedMediaId)
      .select(MEDIA_COLUMNS)
      .maybeSingle();
    if (mediaUpdateError) {
      mergeErrors(mediaUpdateError, 'Unable to update linked media note');
    }
    if (updatedMediaRow) {
      mergeProjectContentSnapshotFromSupabase({
        projectId: data.project_id,
        folders: [],
        media: [normalizeMediaRow(updatedMediaRow as SupabaseMediaRow)],
      });
    }
  }

  const actorName = getActorName(authUser);
  const { error: activityError } = await supabase.from('activity_log').insert({
    project_id: data.project_id,
    action_type: 'note_added',
    reference_id: linkedMediaId || createdNoteRow.id,
    actor_user_id: authUser.id,
    actor_name_snapshot: actorName,
    metadata: {
      has_note: true,
      note_scope: linkedMediaId ? 'media' : 'project',
      media_id: linkedMediaId,
      title: title || null,
    },
  });
  if (activityError) {
    console.log('Project-note activity sync warning:', activityError.message);
  }

  mergeProjectNotesSnapshotFromSupabase({
    currentAuthUserId: authUser.id,
    projectId: data.project_id,
    notes: [normalizeNoteRow(createdNoteRow as SupabaseNoteRow)],
  });

  return normalizeNoteRow(createdNoteRow as SupabaseNoteRow);
}

export async function updateProjectNoteInSupabase(
  noteId: string,
  data: {
    content: string;
    title?: string | null;
  }
): Promise<Note | null> {
  const content = data.content.trim();
  if (!content) {
    throw new Error('Note content is required');
  }

  const title = typeof data.title === 'string' ? data.title.trim() : '';

  if (!isUuid(noteId)) {
    return updateProjectNote(noteId, {
      content,
      title: title || null,
    });
  }

  const authUser = await requireAuthUser('update project note');
  const { data: existingNoteRow, error: lookupError } = await supabase
    .from('notes')
    .select('id, project_id, media_id')
    .eq('id', noteId)
    .maybeSingle();
  if (lookupError) {
    mergeErrors(lookupError, 'Unable to load note');
  }
  if (!existingNoteRow?.id || !existingNoteRow.project_id) {
    return null;
  }

  const linkedMediaId =
    typeof existingNoteRow.media_id === 'string' && existingNoteRow.media_id.trim().length > 0
      ? existingNoteRow.media_id
      : null;

  const { data: updatedNoteRow, error: updateError } = await supabase
    .from('notes')
    .update({
      title: title || null,
      content,
      author_user_id: authUser.id,
    })
    .eq('id', noteId)
    .select(NOTE_COLUMNS)
    .single();
  if (updateError || !updatedNoteRow) {
    mergeErrors(updateError, 'Unable to update note');
  }

  if (linkedMediaId) {
    const { data: updatedMediaRow, error: mediaUpdateError } = await supabase
      .from('media')
      .update({ note: content })
      .eq('id', linkedMediaId)
      .select(MEDIA_COLUMNS)
      .maybeSingle();
    if (mediaUpdateError) {
      mergeErrors(mediaUpdateError, 'Unable to update linked media note');
    }
    if (updatedMediaRow) {
      mergeProjectContentSnapshotFromSupabase({
        projectId: existingNoteRow.project_id,
        folders: [],
        media: [normalizeMediaRow(updatedMediaRow as SupabaseMediaRow)],
      });
    }
  }

  const actorName = getActorName(authUser);
  const { error: activityError } = await supabase.from('activity_log').insert({
    project_id: existingNoteRow.project_id,
    action_type: 'note_updated',
    reference_id: linkedMediaId || noteId,
    actor_user_id: authUser.id,
    actor_name_snapshot: actorName,
    metadata: {
      has_note: true,
      note_scope: linkedMediaId ? 'media' : 'project',
      media_id: linkedMediaId,
      title: title || null,
    },
  });
  if (activityError) {
    console.log('Project-note update activity sync warning:', activityError.message);
  }

  mergeProjectNotesSnapshotFromSupabase({
    currentAuthUserId: authUser.id,
    projectId: existingNoteRow.project_id,
    notes: [normalizeNoteRow(updatedNoteRow as SupabaseNoteRow)],
  });

  return normalizeNoteRow(updatedNoteRow as SupabaseNoteRow);
}

export async function deleteProjectNoteInSupabase(noteId: string): Promise<void> {
  if (!isUuid(noteId)) {
    deleteProjectNote(noteId);
    return;
  }

  const authUser = await requireAuthUser('delete project note');
  const { data: existingNoteRow, error: lookupError } = await supabase
    .from('notes')
    .select('id, project_id, media_id')
    .eq('id', noteId)
    .maybeSingle();
  if (lookupError) {
    mergeErrors(lookupError, 'Unable to load note');
  }
  if (!existingNoteRow?.id || !existingNoteRow.project_id) {
    return;
  }

  const linkedMediaId =
    typeof existingNoteRow.media_id === 'string' && existingNoteRow.media_id.trim().length > 0
      ? existingNoteRow.media_id
      : null;

  const { error: deleteError } = await supabase.from('notes').delete().eq('id', noteId);
  if (deleteError) {
    mergeErrors(deleteError, 'Unable to delete note');
  }

  if (linkedMediaId) {
    const { data: latestNoteRow, error: latestNoteError } = await supabase
      .from('notes')
      .select('content')
      .eq('project_id', existingNoteRow.project_id)
      .eq('media_id', linkedMediaId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestNoteError) {
      mergeErrors(latestNoteError, 'Unable to load remaining linked note');
    }

    const nextContent =
      typeof latestNoteRow?.content === 'string' && latestNoteRow.content.trim().length > 0
        ? latestNoteRow.content.trim()
        : null;

    const { data: updatedMediaRow, error: mediaUpdateError } = await supabase
      .from('media')
      .update({ note: nextContent })
      .eq('id', linkedMediaId)
      .select(MEDIA_COLUMNS)
      .maybeSingle();
    if (mediaUpdateError) {
      mergeErrors(mediaUpdateError, 'Unable to update linked media note');
    }
    if (updatedMediaRow) {
      mergeProjectContentSnapshotFromSupabase({
        projectId: existingNoteRow.project_id,
        folders: [],
        media: [normalizeMediaRow(updatedMediaRow as SupabaseMediaRow)],
      });
    }
  }

  const actorName = getActorName(authUser);
  const { error: activityError } = await supabase.from('activity_log').insert({
    project_id: existingNoteRow.project_id,
    action_type: 'note_removed',
    reference_id: linkedMediaId || noteId,
    actor_user_id: authUser.id,
    actor_name_snapshot: actorName,
    metadata: {
      has_note: false,
      note_scope: linkedMediaId ? 'media' : 'project',
      media_id: linkedMediaId,
    },
  });
  if (activityError) {
    console.log('Project-note remove activity sync warning:', activityError.message);
  }

  await syncProjectNotesFromSupabase(existingNoteRow.project_id);
}

export async function createProjectInSupabase(data: {
  name: string;
  client?: string;
  location?: string;
  organization_id?: string | null;
  start_date?: number | null;
  end_date?: number | null;
  budget?: number | null;
}): Promise<Project> {
  const authUser = await requireAuthUser('create project');
  const now = Date.now();
  const startDate = data.start_date ?? now;

  const payload = {
    p_name: data.name.trim(),
    p_client: data.client?.trim() || null,
    p_location: data.location?.trim() || null,
    p_organization_id: data.organization_id ?? null,
    p_start_date: toIsoMillis(startDate),
    p_end_date: toIsoMillis(data.end_date ?? null),
    p_budget: data.budget ?? null,
  };

  const { data: rpcResult, error } = await supabase.rpc('create_project', payload);
  const createdRow = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;

  if (error || !createdRow) {
    mergeErrors(error, 'Unable to create project');
  }

  const actorName = getActorName(authUser);
  const { error: activityError } = await supabase.from('activity_log').insert({
    project_id: createdRow.id,
    action_type: 'project_created',
    reference_id: createdRow.id,
    actor_user_id: authUser.id,
    actor_name_snapshot: actorName,
    metadata: { name: payload.p_name, progress: 0 },
  });
  if (activityError) {
    console.log('Project-created activity sync warning:', activityError.message);
  }

  await syncProjectsAndActivityFromSupabase();
  const localProject = getProjectById(createdRow.id);
  if (!localProject) {
    throw new Error('Project was created remotely but not available locally yet');
  }
  return localProject;
}

export async function updateProjectInSupabase(
  projectId: string,
  data: Partial<Omit<Project, 'id' | 'created_at' | 'updated_at' | 'status' | 'status_override' | 'last_activity_at' | 'progress'>>
): Promise<void> {
  if (!isUuid(projectId)) {
    updateProject(projectId, data);
    return;
  }

  const authUser = await requireAuthUser('update project');
  const updates: Record<string, unknown> = {};

  if (data.name !== undefined) updates.name = data.name.trim();
  if (data.client !== undefined) updates.client = data.client?.trim() || null;
  if (data.location !== undefined) updates.location = data.location?.trim() || null;
  if (data.organization_id !== undefined) updates.organization_id = data.organization_id ?? null;
  if (data.start_date !== undefined) updates.start_date = toIsoMillis(data.start_date ?? null);
  if (data.end_date !== undefined) updates.end_date = toIsoMillis(data.end_date ?? null);
  if (data.budget !== undefined) updates.budget = data.budget ?? null;

  if (Object.keys(updates).length === 0) return;

  const { error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', projectId)
    .eq('owner_user_id', authUser.id);

  if (error) {
    mergeErrors(error, 'Unable to update project');
  }

  const actorName = getActorName(authUser);
  const { error: activityError } = await supabase.from('activity_log').insert({
    project_id: projectId,
    action_type: 'project_updated',
    reference_id: projectId,
    actor_user_id: authUser.id,
    actor_name_snapshot: actorName,
    metadata: { fields: Object.keys(updates) },
  });
  if (activityError) {
    console.log('Project-updated activity sync warning:', activityError.message);
  }

  await syncProjectsAndActivityFromSupabase();
}

export async function upsertProjectPublicProfileInSupabase(
  projectId: string,
  data: PublicProfileUpsertInput
): Promise<ProjectPublicProfile | null> {
  if (!isUuid(projectId)) {
    return upsertProjectPublicProfile(projectId, data);
  }

  const authUser = await requireAuthUser('update project public profile');
  const updates: Record<string, unknown> = {};
  const changedFields: string[] = [];

  if (data.public_title !== undefined) {
    updates.public_title = data.public_title?.trim() || null;
    changedFields.push('public_title');
  }
  if (data.summary !== undefined) {
    updates.summary = data.summary?.trim() || null;
    changedFields.push('summary');
  }
  if (data.city !== undefined) {
    updates.city = data.city?.trim() || null;
    changedFields.push('city');
  }
  if (data.region !== undefined) {
    updates.region = data.region?.trim() || null;
    changedFields.push('region');
  }
  if (data.category !== undefined) {
    updates.category = data.category?.trim() || null;
    changedFields.push('category');
  }
  if (data.hero_media_id !== undefined) {
    updates.hero_media_id = data.hero_media_id || null;
    changedFields.push('hero_media_id');
  }
  if (data.hero_comment !== undefined) {
    updates.hero_comment = data.hero_comment?.trim() || null;
    changedFields.push('hero_comment');
  }
  if (data.contact_email !== undefined) {
    updates.contact_email = data.contact_email?.trim() || null;
    changedFields.push('contact_email');
  }
  if (data.contact_phone !== undefined) {
    updates.contact_phone = data.contact_phone?.trim() || null;
    changedFields.push('contact_phone');
  }
  if (data.website_url !== undefined) {
    updates.website_url = data.website_url?.trim() || null;
    changedFields.push('website_url');
  }
  if (data.highlights !== undefined) {
    const normalizedHighlights = Array.isArray(data.highlights)
      ? data.highlights.map((value) => value.trim()).filter((value) => value.length > 0).slice(0, 8)
      : [];
    updates.highlights_json = normalizedHighlights;
    changedFields.push('highlights_json');
  }

  if (Object.keys(updates).length === 0) {
    return getProjectPublicProfile(projectId);
  }

  const { data: existingProfile, error: lookupError } = await supabase
    .from('project_public_profiles')
    .select('project_id')
    .eq('project_id', projectId)
    .maybeSingle();
  if (lookupError) {
    mergeErrors(lookupError, 'Unable to load project public profile');
  }

  if (existingProfile?.project_id) {
    const { error: updateError } = await supabase
      .from('project_public_profiles')
      .update(updates)
      .eq('project_id', projectId);
    if (updateError) {
      mergeErrors(updateError, 'Unable to update project public profile');
    }
  } else {
    const { error: insertError } = await supabase.from('project_public_profiles').insert({
      project_id: projectId,
      ...updates,
    });
    if (insertError) {
      mergeErrors(insertError, 'Unable to create project public profile');
    }
  }

  const actorName = getActorName(authUser);
  const { error: activityError } = await supabase.from('activity_log').insert({
    project_id: projectId,
    action_type: 'project_public_profile_updated',
    reference_id: projectId,
    actor_user_id: authUser.id,
    actor_name_snapshot: actorName,
    metadata: { fields: changedFields },
  });
  if (activityError) {
    console.log('Public profile activity sync warning:', activityError.message);
  }

  await syncProjectPublicProfileSnapshotFromSupabase(projectId);
  await syncProjectsAndActivityFromSupabase();
  return getProjectPublicProfile(projectId);
}

export async function setProjectVisibilityInSupabase(
  projectId: string,
  visibility: ProjectVisibility,
  options?: { slug?: string | null }
): Promise<SetProjectVisibilityResult> {
  if (!isUuid(projectId)) {
    return {
      project: setProjectVisibility(projectId, visibility, options),
      sync: {
        visibility,
        totalMedia: 0,
        inserted: 0,
        republished: 0,
        updatedPublished: 0,
        unpublished: 0,
        skippedRemoved: 0,
      },
    };
  }

  const authUser = await requireAuthUser('set project visibility');
  const nowIso = new Date().toISOString();
  const { data: existingProjectRaw, error: lookupError } = await supabase
    .from('projects')
    .select('id, organization_id, visibility, public_slug, public_published_at')
    .eq('id', projectId)
    .maybeSingle();
  if (lookupError) {
    mergeErrors(lookupError, 'Unable to load project visibility');
  }
  if (!existingProjectRaw?.id) {
    throw new Error('Project not found');
  }

  const existingProject = existingProjectRaw as SupabaseProjectVisibilityRow;
  const currentVisibility: ProjectVisibility = existingProject.visibility === 'public' ? 'public' : 'private';
  const providedSlug = typeof options?.slug === 'string' ? options.slug.trim().toLowerCase() : '';
  const retainedSlug =
    typeof existingProject.public_slug === 'string' ? existingProject.public_slug.trim().toLowerCase() : '';
  const nextSlug = providedSlug || retainedSlug;

  const updates: Record<string, unknown> = {
    visibility,
    public_updated_at: nowIso,
  };

  if (visibility === 'public') {
    if (!nextSlug) {
      throw new Error('Public slug is required to publish this project');
    }
    updates.public_slug = nextSlug;
    updates.public_published_at = existingProject.public_published_at || nowIso;
  }

  const { error: updateError } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', projectId);
  if (updateError) {
    mergeErrors(updateError, 'Unable to update project visibility');
  }

  if (currentVisibility !== visibility) {
    const actorName = getActorName(authUser);
    const actionType = visibility === 'public' ? 'project_published' : 'project_unpublished';
    const metadata = visibility === 'public' ? { public_slug: nextSlug || null } : null;
    const { error: activityError } = await supabase.from('activity_log').insert({
      project_id: projectId,
      action_type: actionType,
      reference_id: projectId,
      actor_user_id: authUser.id,
      actor_name_snapshot: actorName,
      metadata,
    });
    if (activityError) {
      console.log('Project visibility activity sync warning:', activityError.message);
    }
  }

  const sync = await syncPublicMediaPostsForProjectVisibility({
    authUserId: authUser.id,
    projectId,
    organizationId: existingProject.organization_id ?? null,
    visibility,
  });

  await syncProjectsAndActivityFromSupabase();
  await syncProjectPublicProfileSnapshotFromSupabase(projectId);

  const localProject = getProjectById(projectId);
  if (!localProject) {
    throw new Error('Project visibility updated remotely but not available locally yet');
  }
  return {
    project: localProject,
    sync,
  };
}

export async function deleteProjectInSupabase(projectId: string): Promise<void> {
  if (!isUuid(projectId)) {
    deleteProject(projectId);
    return;
  }

  const authUser = await requireAuthUser('delete project');
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('owner_user_id', authUser.id);

  if (error) {
    mergeErrors(error, 'Unable to delete project');
  }

  try {
    deleteProject(projectId);
  } catch (localError) {
    console.log('Local project cleanup warning:', localError);
  }
}

export async function setProjectCompletionStateInSupabase(
  projectId: string,
  completed: boolean
): Promise<Project | null> {
  if (!isUuid(projectId)) {
    return setProjectCompletionState(projectId, completed);
  }

  const authUser = await requireAuthUser('update project completion state');
  const statusOverride = completed ? 'completed' : null;
  const actionType = completed ? 'project_marked_completed' : 'project_reopened';

  const { error } = await supabase
    .from('projects')
    .update({ status_override: statusOverride })
    .eq('id', projectId)
    .eq('owner_user_id', authUser.id);

  if (error) {
    mergeErrors(error, 'Unable to update project completion state');
  }

  const actorName = getActorName(authUser);
  const { error: activityError } = await supabase.from('activity_log').insert({
    project_id: projectId,
    action_type: actionType,
    reference_id: projectId,
    actor_user_id: authUser.id,
    actor_name_snapshot: actorName,
    metadata: null,
  });
  if (activityError) {
    console.log('Project completion activity sync warning:', activityError.message);
  }

  await syncProjectsAndActivityFromSupabase();
  return getProjectById(projectId);
}

export async function addProjectMemberFromOrganizationInSupabase(data: {
  projectId: string;
  organizationMemberUserId: string;
  role?: Exclude<ProjectMemberRole, 'owner'>;
  invitedBy?: string | null;
  invitedEmail?: string | null;
  userNameSnapshot?: string | null;
  userEmailSnapshot?: string | null;
}): Promise<ProjectMember> {
  const projectId = data.projectId.trim();
  const organizationMemberUserId = data.organizationMemberUserId.trim();
  if (!projectId || !organizationMemberUserId) {
    throw new Error('Project id and member user id are required');
  }

  const role: ProjectMemberRole =
    data.role === 'manager' || data.role === 'client' || data.role === 'worker' ? data.role : 'worker';
  const invitedBy = typeof data.invitedBy === 'string' ? data.invitedBy.trim() || null : null;
  const invitedEmail =
    typeof data.invitedEmail === 'string' ? data.invitedEmail.trim().toLowerCase() || null : null;
  const userNameSnapshot =
    typeof data.userNameSnapshot === 'string' ? data.userNameSnapshot.trim() || null : null;
  const userEmailSnapshot =
    typeof data.userEmailSnapshot === 'string'
      ? data.userEmailSnapshot.trim().toLowerCase() || null
      : invitedEmail;

  if (!isUuid(projectId) || !isUuid(organizationMemberUserId)) {
    return upsertProjectMember({
      projectId,
      userId: organizationMemberUserId,
      role,
      status: 'active',
      invitedBy,
    });
  }

  const authUser = await requireAuthUser('add project member');
  const invitedByAuthUserId = isUuid(invitedBy) ? invitedBy : authUser.id;

  const { data: projectLookupRow, error: projectLookupError } = await supabase
    .from('projects')
    .select('id, organization_id')
    .eq('id', projectId)
    .maybeSingle();
  if (projectLookupError) {
    mergeErrors(projectLookupError, 'Unable to load project');
  }
  if (!projectLookupRow?.id) {
    throw new Error('Project not found');
  }

  const organizationId =
    typeof projectLookupRow.organization_id === 'string' ? projectLookupRow.organization_id.trim() : '';
  if (organizationId) {
    const { data: organizationMemberLookup, error: organizationMemberLookupError } = await supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', organizationMemberUserId)
      .eq('status', 'active')
      .maybeSingle();
    if (organizationMemberLookupError) {
      mergeErrors(organizationMemberLookupError, 'Unable to validate organization member');
    }
    if (!organizationMemberLookup?.id) {
      throw new Error('Selected teammate is not active in this organization');
    }
  }

  const { data: existingMemberRowsRaw, error: existingMemberError } = await supabase
    .from('project_members')
    .select(PROJECT_MEMBER_COLUMNS)
    .eq('project_id', projectId)
    .eq('user_id', organizationMemberUserId)
    .order('created_at', { ascending: true })
    .limit(1);
  if (existingMemberError) {
    mergeErrors(existingMemberError, 'Unable to load project member');
  }

  const nowIso = new Date().toISOString();
  const existingMemberRow = (existingMemberRowsRaw?.[0] ?? null) as SupabaseProjectMemberRow | null;
  let persistedMemberRow: SupabaseProjectMemberRow | null = null;

  if (existingMemberRow?.id) {
    const { data: updatedRowRaw, error: updateError } = await supabase
      .from('project_members')
      .update({
        role,
        status: 'active',
        invited_by: invitedByAuthUserId,
        invited_email: invitedEmail ?? existingMemberRow.invited_email ?? null,
        user_name_snapshot: userNameSnapshot ?? existingMemberRow.user_name_snapshot ?? null,
        user_email_snapshot:
          userEmailSnapshot ?? existingMemberRow.user_email_snapshot ?? existingMemberRow.invited_email ?? null,
        accepted_at: existingMemberRow.accepted_at || nowIso,
      })
      .eq('id', existingMemberRow.id)
      .select(PROJECT_MEMBER_COLUMNS)
      .single();
    if (updateError || !updatedRowRaw) {
      mergeErrors(updateError, 'Unable to update project member');
    }
    persistedMemberRow = updatedRowRaw as SupabaseProjectMemberRow;
  } else {
    const { data: insertedRowRaw, error: insertError } = await supabase
      .from('project_members')
      .insert({
        project_id: projectId,
        user_id: organizationMemberUserId,
        invited_email: invitedEmail,
        role,
        status: 'active',
        invited_by: invitedByAuthUserId,
        user_name_snapshot: userNameSnapshot,
        user_email_snapshot: userEmailSnapshot,
        accepted_at: nowIso,
      })
      .select(PROJECT_MEMBER_COLUMNS)
      .single();
    if (insertError || !insertedRowRaw) {
      mergeErrors(insertError, 'Unable to add project member');
    }
    persistedMemberRow = insertedRowRaw as SupabaseProjectMemberRow;
  }

  await syncProjectMembersSnapshotFromSupabase(projectId, authUser.id);
  const localMembers = getProjectMembers(projectId, { includeRemoved: true });
  const localMember =
    localMembers.find((member) => member.id === persistedMemberRow.id) ||
    localMembers.find((member) => member.user_id === organizationMemberUserId && member.status !== 'removed');
  if (!localMember) {
    throw new Error('Project member was added remotely but not available locally yet');
  }
  return localMember;
}

export async function setProjectMemberRoleInSupabase(data: {
  projectId: string;
  memberId: string;
  role: ProjectMemberRole;
}): Promise<ProjectMember | null> {
  const projectId = data.projectId.trim();
  const memberId = data.memberId.trim();
  if (!projectId || !memberId) {
    throw new Error('Project id and member id are required');
  }

  const role =
    data.role === 'owner' || data.role === 'manager' || data.role === 'worker' || data.role === 'client'
      ? data.role
      : 'worker';

  if (!isUuid(projectId) || !isUuid(memberId)) {
    return setProjectMemberRoleById(projectId, memberId, role);
  }

  const authUser = await requireAuthUser('update project member role');
  const { error } = await supabase
    .from('project_members')
    .update({ role })
    .eq('project_id', projectId)
    .eq('id', memberId);

  if (error) {
    mergeErrors(error, 'Unable to update project member role');
  }

  await syncProjectMembersSnapshotFromSupabase(projectId, authUser.id);
  return getProjectMemberById(projectId, memberId);
}

export async function removeProjectMemberInSupabase(data: {
  projectId: string;
  memberId: string;
}): Promise<void> {
  const projectId = data.projectId.trim();
  const memberId = data.memberId.trim();
  if (!projectId || !memberId) {
    throw new Error('Project id and member id are required');
  }

  if (!isUuid(projectId) || !isUuid(memberId)) {
    removeProjectMemberById(projectId, memberId);
    return;
  }

  const authUser = await requireAuthUser('remove project member');
  const { error } = await supabase
    .from('project_members')
    .update({ status: 'removed' })
    .eq('project_id', projectId)
    .eq('id', memberId);

  if (error) {
    mergeErrors(error, 'Unable to remove project member');
  }

  await syncProjectMembersSnapshotFromSupabase(projectId, authUser.id);
}

export async function createActivityInSupabase(
  projectId: string,
  actionType: string,
  referenceId?: string | null,
  metadata?: Record<string, unknown> | null
): Promise<ActivityLogEntry> {
  if (!isUuid(projectId)) {
    return createActivity(projectId, actionType, referenceId, metadata);
  }

  const authUser = await requireAuthUser('create activity');
  const actorName = getActorName(authUser);
  const resolvedReference = typeof referenceId === 'string' && referenceId.trim().length > 0 ? referenceId.trim() : null;

  const { data: createdRow, error } = await supabase
    .from('activity_log')
    .insert({
      project_id: projectId,
      action_type: actionType,
      reference_id: resolvedReference,
      actor_user_id: authUser.id,
      actor_name_snapshot: actorName,
      metadata: metadata ?? null,
    })
    .select(ACTIVITY_COLUMNS)
    .single();

  if (error || !createdRow) {
    mergeErrors(error, 'Unable to create activity');
  }

  mergeProjectsAndActivitySnapshotFromSupabase({
    currentAuthUserId: authUser.id,
    projects: [],
    activities: [normalizeActivityRow(createdRow as SupabaseActivityRow)],
  });

  const localEntry = getActivityByProject(projectId, 100).find((entry) => entry.id === createdRow.id);
  if (!localEntry) {
    throw new Error('Activity was created remotely but not available locally yet');
  }
  return localEntry;
}

export async function updateActivityInSupabase(
  activityId: string,
  data: {
    actionType?: string;
    referenceId?: string | null;
    metadata?: Record<string, unknown> | null;
  }
): Promise<ActivityLogEntry | null> {
  if (!isUuid(activityId)) {
    return updateActivity(activityId, data);
  }

  const authUser = await requireAuthUser('update activity');
  const updates: Record<string, unknown> = {};

  if (data.actionType !== undefined) {
    updates.action_type = data.actionType.trim();
  }
  if (data.referenceId !== undefined) {
    const value = typeof data.referenceId === 'string' ? data.referenceId.trim() : '';
    updates.reference_id = value.length > 0 ? value : null;
  }
  if (data.metadata !== undefined) {
    updates.metadata = data.metadata ?? null;
  }

  if (Object.keys(updates).length === 0) {
    return null;
  }

  const { data: updatedRow, error } = await supabase
    .from('activity_log')
    .update(updates)
    .eq('id', activityId)
    .select(ACTIVITY_COLUMNS)
    .maybeSingle();

  if (error) {
    mergeErrors(error, 'Unable to update activity');
  }
  if (!updatedRow) return null;

  mergeProjectsAndActivitySnapshotFromSupabase({
    currentAuthUserId: authUser.id,
    projects: [],
    activities: [normalizeActivityRow(updatedRow as SupabaseActivityRow)],
  });

  return getActivityByProject(updatedRow.project_id, 100).find((entry) => entry.id === updatedRow.id) ?? null;
}

export async function deleteActivityInSupabase(activityId: string): Promise<void> {
  if (!isUuid(activityId)) {
    deleteActivity(activityId);
    return;
  }

  await requireAuthUser('delete activity');
  const { error } = await supabase
    .from('activity_log')
    .delete()
    .eq('id', activityId);

  if (error) {
    mergeErrors(error, 'Unable to delete activity');
  }

  try {
    deleteActivity(activityId);
  } catch (localError) {
    console.log('Local activity cleanup warning:', localError);
  }
}

export async function createFolderInSupabase(projectId: string, name: string): Promise<Folder> {
  if (!isUuid(projectId)) {
    return createFolder({ project_id: projectId, name });
  }

  const authUser = await requireAuthUser('create folder');
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error('Folder name is required');
  }

  const { data: createdRow, error } = await supabase
    .from('folders')
    .insert({
      project_id: projectId,
      name: trimmedName,
      created_by_user_id: authUser.id,
    })
    .select(FOLDER_COLUMNS)
    .single();
  if (error || !createdRow) {
    mergeErrors(error, 'Unable to create folder');
  }

  const actorName = getActorName(authUser);
  const { error: activityError } = await supabase.from('activity_log').insert({
    project_id: projectId,
    action_type: 'folder_created',
    reference_id: createdRow.id,
    actor_user_id: authUser.id,
    actor_name_snapshot: actorName,
    metadata: { name: trimmedName },
  });
  if (activityError) {
    console.log('Folder-created activity sync warning:', activityError.message);
  }

  mergeProjectContentSnapshotFromSupabase({
    projectId,
    folders: [normalizeFolderRow(createdRow as SupabaseFolderRow)],
    media: [],
  });

  const localFolder = getFoldersByProject(projectId).find((folder) => folder.id === createdRow.id);
  if (!localFolder) {
    throw new Error('Folder was created remotely but not available locally yet');
  }
  return localFolder;
}

export async function updateFolderNameInSupabase(folderId: string, name: string): Promise<void> {
  if (!isUuid(folderId)) {
    updateFolderName(folderId, name);
    return;
  }

  const authUser = await requireAuthUser('rename folder');
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error('Folder name is required');
  }

  const { data: existingRow, error: lookupError } = await supabase
    .from('folders')
    .select('id, project_id, name')
    .eq('id', folderId)
    .maybeSingle();
  if (lookupError) {
    mergeErrors(lookupError, 'Unable to load folder details');
  }
  if (!existingRow?.project_id) {
    throw new Error('Folder not found');
  }

  const { data: updatedRow, error } = await supabase
    .from('folders')
    .update({ name: trimmedName })
    .eq('id', folderId)
    .select(FOLDER_COLUMNS)
    .single();
  if (error || !updatedRow) {
    mergeErrors(error, 'Unable to rename folder');
  }

  const actorName = getActorName(authUser);
  const { error: activityError } = await supabase.from('activity_log').insert({
    project_id: existingRow.project_id,
    action_type: 'folder_renamed',
    reference_id: folderId,
    actor_user_id: authUser.id,
    actor_name_snapshot: actorName,
    metadata: { from: existingRow.name || null, to: trimmedName },
  });
  if (activityError) {
    console.log('Folder-renamed activity sync warning:', activityError.message);
  }

  mergeProjectContentSnapshotFromSupabase({
    projectId: existingRow.project_id,
    folders: [normalizeFolderRow(updatedRow as SupabaseFolderRow)],
    media: [],
  });
}

export async function deleteFolderInSupabase(folderId: string): Promise<void> {
  if (!isUuid(folderId)) {
    deleteFolder(folderId);
    return;
  }

  const authUser = await requireAuthUser('delete folder');
  const { data: existingRow, error: lookupError } = await supabase
    .from('folders')
    .select('id, project_id, name')
    .eq('id', folderId)
    .maybeSingle();
  if (lookupError) {
    mergeErrors(lookupError, 'Unable to load folder details');
  }
  if (!existingRow?.project_id) {
    return;
  }

  const { error } = await supabase.from('folders').delete().eq('id', folderId);
  if (error) {
    mergeErrors(error, 'Unable to delete folder');
  }

  const actorName = getActorName(authUser);
  const { error: activityError } = await supabase.from('activity_log').insert({
    project_id: existingRow.project_id,
    action_type: 'folder_deleted',
    reference_id: folderId,
    actor_user_id: authUser.id,
    actor_name_snapshot: actorName,
    metadata: { name: existingRow.name || null },
  });
  if (activityError) {
    console.log('Folder-deleted activity sync warning:', activityError.message);
  }

  await syncProjectContentFromSupabase(existingRow.project_id);
}

export async function createMediaInSupabase(
  data: Omit<MediaItem, 'id' | 'created_at' | 'metadata'> & {
    metadata?: Record<string, unknown> | string | null;
  }
): Promise<MediaItem> {
  const normalizedMetadata = normalizeMetadata(data.metadata);
  if (!isUuid(data.project_id)) {
    return createMedia({ ...data, metadata: normalizedMetadata });
  }

  const authUser = await requireAuthUser('create media');
  const resolvedFolderId =
    typeof data.folder_id === 'string' && data.folder_id.trim().length > 0 ? data.folder_id.trim() : null;
  const metadataPayload = toMetadataPayload(data.metadata);
  const documentKind =
    typeof metadataPayload.document_kind === 'string'
      ? metadataPayload.document_kind.trim().toLowerCase() || null
      : null;
  const captureKind =
    typeof metadataPayload.capture_kind === 'string'
      ? metadataPayload.capture_kind.trim().toLowerCase() || null
      : null;

  const { data: createdRowRaw, error } = await supabase
    .from('media')
    .insert({
      project_id: data.project_id,
      folder_id: resolvedFolderId,
      uploaded_by_user_id: authUser.id,
      type: data.type,
      uri: data.uri,
      thumb_uri: data.thumb_uri || null,
      note: data.note || null,
      metadata: metadataPayload,
    })
    .select(MEDIA_COLUMNS)
    .single();
  if (error || !createdRowRaw) {
    mergeErrors(error, 'Unable to create media');
  }

  let createdRow = createdRowRaw as SupabaseMediaRow;
  let storageSynced = false;
  const retryQueue = await getStorageUploadRetryQueue();
  let retryQueueDirty = false;
  try {
    const syncedStorage = await uploadMediaAssetsToStorage({
      authUserId: authUser.id,
      projectId: data.project_id,
      mediaId: createdRow.id,
      mediaType: data.type,
      uri: createdRow.uri,
      thumbUri: createdRow.thumb_uri,
      metadata: toMetadataPayload(createdRow.metadata),
    });

    if (syncedStorage.uploaded) {
      const { data: updatedStorageRow, error: updateStorageError } = await supabase
        .from('media')
        .update({
          uri: syncedStorage.uri,
          thumb_uri: syncedStorage.thumb_uri,
          metadata: syncedStorage.metadata,
        })
        .eq('id', createdRow.id)
        .select(MEDIA_COLUMNS)
        .single();
      if (updateStorageError || !updatedStorageRow) {
        mergeErrors(updateStorageError, 'Unable to persist media storage URLs');
      }
      createdRow = updatedStorageRow as SupabaseMediaRow;
      storageSynced = true;
    }

    if (retryQueue[createdRow.id]) {
      delete retryQueue[createdRow.id];
      retryQueueDirty = true;
    }
  } catch (storageError) {
    const message = storageError instanceof Error ? storageError.message : String(storageError ?? '');
    if (isStoragePayloadTooLargeError(message)) {
      if (retryQueue[createdRow.id]) {
        delete retryQueue[createdRow.id];
        retryQueueDirty = true;
      }

      const blockedMetadata = withStorageMetadata(toMetadataPayload(createdRow.metadata), {
        upload_pending: false,
        upload_attempts: null,
        upload_next_retry_at: null,
        upload_last_error: message.slice(0, 280),
        upload_last_error_at: new Date().toISOString(),
        upload_blocked: true,
        upload_block_reason: 'payload_too_large',
        upload_blocked_at: new Date().toISOString(),
      });
      try {
        const { data: blockedRowRaw, error: blockedUpdateError } = await supabase
          .from('media')
          .update({ metadata: blockedMetadata })
          .eq('id', createdRow.id)
          .select(MEDIA_COLUMNS)
          .single();
        if (!blockedUpdateError && blockedRowRaw) {
          createdRow = blockedRowRaw as SupabaseMediaRow;
        }
      } catch {
        // Non-blocking; user still keeps local media.
      }

      console.log('Media storage upload blocked (payload too large):', storageError);
    } else {
      const retryEntry = buildStorageUploadRetryEntry({
        mediaId: createdRow.id,
        projectId: data.project_id,
        mediaType: data.type,
        previous: retryQueue[createdRow.id],
        errorMessage: message || 'storage_upload_failed',
      });
      retryQueue[createdRow.id] = retryEntry;
      retryQueueDirty = true;

      const pendingMetadata = withStorageMetadata(toMetadataPayload(createdRow.metadata), {
        upload_pending: true,
        upload_attempts: retryEntry.attempts,
        upload_next_retry_at: new Date(retryEntry.nextRetryAt).toISOString(),
        upload_last_error: retryEntry.lastError,
        upload_last_error_at: new Date(retryEntry.updatedAt).toISOString(),
        upload_blocked: false,
        upload_block_reason: null,
        upload_blocked_at: null,
      });
      try {
        const { data: queuedRowRaw, error: queueUpdateError } = await supabase
          .from('media')
          .update({ metadata: pendingMetadata })
          .eq('id', createdRow.id)
          .select(MEDIA_COLUMNS)
          .single();
        if (!queueUpdateError && queuedRowRaw) {
          createdRow = queuedRowRaw as SupabaseMediaRow;
        }
      } catch {
        // Keep local flow resilient; queue still persists on device.
      }

      console.log(
        'Media storage upload warning:',
        storageError,
        `(queued retry in ${getRetryQueueEntryDelaySeconds(retryEntry)}s, attempt ${retryEntry.attempts})`
      );
    }
  }
  if (retryQueueDirty) {
    await setStorageUploadRetryQueue(retryQueue);
  }

  const actorName = getActorName(authUser);
  const { error: activityError } = await supabase.from('activity_log').insert({
    project_id: data.project_id,
    action_type: 'media_added',
    reference_id: createdRow.id,
    actor_user_id: authUser.id,
    actor_name_snapshot: actorName,
    metadata: {
      type: data.type,
      folder_id: resolvedFolderId,
      has_note: !!data.note?.trim(),
      storage_synced: storageSynced,
      document_kind: documentKind,
      capture_kind: captureKind,
    },
  });
  if (activityError) {
    console.log('Media-added activity sync warning:', activityError.message);
  }

  await maybePublishMediaPostForPublicProject({
    authUserId: authUser.id,
    projectId: data.project_id,
    mediaId: createdRow.id,
    caption: data.note || null,
  });

  mergeProjectContentSnapshotFromSupabase({
    projectId: data.project_id,
    folders: [],
    media: [normalizeMediaRow(createdRow as SupabaseMediaRow)],
  });

  const localMedia = getMediaById(createdRow.id);
  if (!localMedia) {
    throw new Error('Media was created remotely but not available locally yet');
  }
  return localMedia;
}

export async function updateMediaNoteInSupabase(mediaId: string, note: string | null): Promise<void> {
  if (!isUuid(mediaId)) {
    updateMediaNote(mediaId, note);
    return;
  }

  const authUser = await requireAuthUser('update media note');
  const { data: existingRow, error: lookupError } = await supabase
    .from('media')
    .select('id, project_id, note')
    .eq('id', mediaId)
    .maybeSingle();
  if (lookupError) {
    mergeErrors(lookupError, 'Unable to load media details');
  }
  if (!existingRow?.project_id) {
    throw new Error('Media not found');
  }

  const trimmedNote = typeof note === 'string' ? note.trim() : '';

  const { data: existingNoteRow, error: noteLookupError } = await supabase
    .from('notes')
    .select(NOTE_COLUMNS)
    .eq('project_id', existingRow.project_id)
    .eq('media_id', mediaId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (noteLookupError) {
    mergeErrors(noteLookupError, 'Unable to load existing note');
  }

  let latestNoteRow: SupabaseNoteRow | null = existingNoteRow as SupabaseNoteRow | null;

  if (trimmedNote.length > 0) {
    if (latestNoteRow?.id) {
      const { data: updatedNoteRow, error: updateNoteError } = await supabase
        .from('notes')
        .update({
          content: trimmedNote,
          author_user_id: authUser.id,
        })
        .eq('id', latestNoteRow.id)
        .select(NOTE_COLUMNS)
        .single();
      if (updateNoteError || !updatedNoteRow) {
        mergeErrors(updateNoteError, 'Unable to update note');
      }
      latestNoteRow = updatedNoteRow as SupabaseNoteRow;
    } else {
      const { data: createdNoteRow, error: createNoteError } = await supabase
        .from('notes')
        .insert({
          project_id: existingRow.project_id,
          media_id: mediaId,
          author_user_id: authUser.id,
          title: null,
          content: trimmedNote,
        })
        .select(NOTE_COLUMNS)
        .single();
      if (createNoteError || !createdNoteRow) {
        mergeErrors(createNoteError, 'Unable to create note');
      }
      latestNoteRow = createdNoteRow as SupabaseNoteRow;
    }
  } else {
    if (latestNoteRow?.id) {
      const { error: deleteNoteError } = await supabase.from('notes').delete().eq('id', latestNoteRow.id);
      if (deleteNoteError) {
        mergeErrors(deleteNoteError, 'Unable to delete note');
      }
    }
    latestNoteRow = null;
  }

  const { data: updatedRow, error } = await supabase
    .from('media')
    .update({ note: trimmedNote || null })
    .eq('id', mediaId)
    .select(MEDIA_COLUMNS)
    .single();
  if (error || !updatedRow) {
    mergeErrors(error, 'Unable to update media note');
  }

  const previousHasNote =
    (typeof (existingNoteRow as SupabaseNoteRow | null)?.content === 'string' &&
      (existingNoteRow as SupabaseNoteRow).content.trim().length > 0) ||
    (typeof existingRow.note === 'string' && existingRow.note.trim().length > 0);
  const nextHasNote = trimmedNote.length > 0;
  const actionType = !previousHasNote && nextHasNote
    ? 'note_added'
    : previousHasNote && !nextHasNote
      ? 'note_removed'
      : 'note_updated';

  const actorName = getActorName(authUser);
  const { error: activityError } = await supabase.from('activity_log').insert({
    project_id: existingRow.project_id,
    action_type: actionType,
    reference_id: mediaId,
    actor_user_id: authUser.id,
    actor_name_snapshot: actorName,
    metadata: { has_note: nextHasNote, note_scope: 'media', media_id: mediaId },
  });
  if (activityError) {
    console.log('Media-note activity sync warning:', activityError.message);
  }

  mergeProjectContentSnapshotFromSupabase({
    projectId: existingRow.project_id,
    folders: [],
    media: [normalizeMediaRow(updatedRow as SupabaseMediaRow)],
  });

  if (latestNoteRow) {
    mergeProjectNotesSnapshotFromSupabase({
      currentAuthUserId: authUser.id,
      projectId: existingRow.project_id,
      notes: [normalizeNoteRow(latestNoteRow)],
    });
  } else {
    await syncProjectNotesFromSupabase(existingRow.project_id);
  }
}

export async function moveMediaToFolderInSupabase(mediaId: string, folderId: string | null): Promise<void> {
  if (!isUuid(mediaId)) {
    moveMediaToFolder(mediaId, folderId);
    return;
  }

  const authUser = await requireAuthUser('move media');
  const { data: existingRow, error: lookupError } = await supabase
    .from('media')
    .select('id, project_id, folder_id')
    .eq('id', mediaId)
    .maybeSingle();
  if (lookupError) {
    mergeErrors(lookupError, 'Unable to load media details');
  }
  if (!existingRow?.project_id) {
    throw new Error('Media not found');
  }

  const resolvedFolderId =
    typeof folderId === 'string' && folderId.trim().length > 0 ? folderId.trim() : null;

  const { data: updatedRow, error } = await supabase
    .from('media')
    .update({ folder_id: resolvedFolderId })
    .eq('id', mediaId)
    .select(MEDIA_COLUMNS)
    .single();
  if (error || !updatedRow) {
    mergeErrors(error, 'Unable to move media');
  }

  const actorName = getActorName(authUser);
  const { error: activityError } = await supabase.from('activity_log').insert({
    project_id: existingRow.project_id,
    action_type: 'media_moved',
    reference_id: mediaId,
    actor_user_id: authUser.id,
    actor_name_snapshot: actorName,
    metadata: {
      from_folder_id: existingRow.folder_id || null,
      to_folder_id: resolvedFolderId,
    },
  });
  if (activityError) {
    console.log('Media-moved activity sync warning:', activityError.message);
  }

  mergeProjectContentSnapshotFromSupabase({
    projectId: existingRow.project_id,
    folders: [],
    media: [normalizeMediaRow(updatedRow as SupabaseMediaRow)],
  });
}

export async function updateMediaThumbnailInSupabase(mediaId: string, thumbUri: string | null): Promise<void> {
  if (!isUuid(mediaId)) {
    updateMediaThumbnail(mediaId, thumbUri);
    return;
  }

  const authUser = await requireAuthUser('update media thumbnail');
  const { data: existingRowRaw, error: lookupError } = await supabase
    .from('media')
    .select(MEDIA_COLUMNS)
    .eq('id', mediaId)
    .maybeSingle();
  if (lookupError) {
    mergeErrors(lookupError, 'Unable to load media thumbnail details');
  }
  if (!existingRowRaw) return;

  const existingRow = existingRowRaw as SupabaseMediaRow;
  let nextThumbUri = thumbUri || null;
  let nextMetadata = toMetadataPayload(existingRow.metadata);

  if (nextThumbUri && !isRemoteUri(nextThumbUri)) {
    try {
      const extension = fileExtensionFromUri(nextThumbUri, 'jpg');
      const objectPath = buildStorageObjectPath({
        userId: authUser.id,
        projectId: existingRow.project_id,
        mediaId: `${existingRow.id}-thumb-${Date.now()}`,
        kind: 'thumbs',
        extension,
      });
      const uploadedThumb = await uploadLocalFileToStorage({
        localUri: nextThumbUri,
        objectPath,
        mediaType: 'photo',
        extension,
      });
      nextThumbUri = uploadedThumb.publicUrl;
      nextMetadata = withStorageMetadata(nextMetadata, {
        bucket: STORAGE_BUCKET,
        thumb_path: uploadedThumb.objectPath,
        source_thumb_uri: thumbUri || null,
        synced_at: new Date().toISOString(),
      });
    } catch (storageError) {
      console.log('Thumbnail storage upload warning:', storageError);
    }
  } else if (nextThumbUri) {
    nextMetadata = withStorageMetadata(nextMetadata, {
      bucket: STORAGE_BUCKET,
      thumb_path: parseStorageObjectPathFromUrl(nextThumbUri),
      synced_at: new Date().toISOString(),
    });
  }

  const { data: updatedRow, error } = await supabase
    .from('media')
    .update({
      thumb_uri: nextThumbUri,
      metadata: nextMetadata,
    })
    .eq('id', mediaId)
    .select(MEDIA_COLUMNS)
    .maybeSingle();
  if (error) {
    mergeErrors(error, 'Unable to update media thumbnail');
  }
  if (!updatedRow) return;

  mergeProjectContentSnapshotFromSupabase({
    projectId: updatedRow.project_id,
    folders: [],
    media: [normalizeMediaRow(updatedRow as SupabaseMediaRow)],
  });
}

export async function deleteMediaInSupabase(mediaId: string): Promise<void> {
  if (!isUuid(mediaId)) {
    deleteMedia(mediaId);
    return;
  }

  const authUser = await requireAuthUser('delete media');
  const { data: existingRow, error: lookupError } = await supabase
    .from('media')
    .select('id, project_id, type, folder_id, uri, thumb_uri, metadata')
    .eq('id', mediaId)
    .maybeSingle();
  if (lookupError) {
    mergeErrors(lookupError, 'Unable to load media details');
  }
  if (!existingRow?.project_id) {
    return;
  }

  const { error: deleteNotesError } = await supabase.from('notes').delete().eq('media_id', mediaId);
  if (deleteNotesError) {
    mergeErrors(deleteNotesError, 'Unable to delete media notes');
  }

  const storageObjectPaths = extractStorageObjectPathsFromMedia(existingRow as SupabaseMediaRow);
  if (storageObjectPaths.length > 0) {
    const { error: storageDeleteError } = await supabase.storage.from(STORAGE_BUCKET).remove(storageObjectPaths);
    if (storageDeleteError) {
      console.log('Storage delete warning:', storageDeleteError.message);
    }
  }

  const { error } = await supabase.from('media').delete().eq('id', mediaId);
  if (error) {
    mergeErrors(error, 'Unable to delete media');
  }

  const retryQueue = await getStorageUploadRetryQueue();
  if (retryQueue[mediaId]) {
    delete retryQueue[mediaId];
    await setStorageUploadRetryQueue(retryQueue);
  }

  const actorName = getActorName(authUser);
  const { error: activityError } = await supabase.from('activity_log').insert({
    project_id: existingRow.project_id,
    action_type: 'media_deleted',
    reference_id: mediaId,
    actor_user_id: authUser.id,
    actor_name_snapshot: actorName,
    metadata: {
      type: existingRow.type || null,
      folder_id: existingRow.folder_id || null,
    },
  });
  if (activityError) {
    console.log('Media-deleted activity sync warning:', activityError.message);
  }

  await syncProjectContentFromSupabase(existingRow.project_id);
}
