import * as FileSystem from './fileSystemCompat';

const REMOTE_URI_REGEX = /^https?:\/\//i;

function stripUriParams(uri: string): string {
  return uri.split('#')[0].split('?')[0];
}

function getExtensionFromUri(uri: string, fallback: string): string {
  const cleaned = stripUriParams(uri).toLowerCase();
  const match = cleaned.match(/\.([a-z0-9]+)$/i);
  if (!match) return fallback;
  return match[1];
}

export function isRemoteMediaUri(uri: string | null | undefined): boolean {
  if (!uri) return false;
  return REMOTE_URI_REGEX.test(uri.trim());
}

export async function localFileExists(uri: string): Promise<boolean> {
  const normalizedUri = uri.startsWith('file://') ? uri : `file://${uri}`;
  const info = await FileSystem.getInfoAsync(normalizedUri);
  return !!info.exists && !info.isDirectory;
}

export async function ensureShareableLocalUri(
  uri: string,
  fallbackExtension: string = 'bin'
): Promise<string> {
  if (isRemoteMediaUri(uri)) {
    const cacheRoot = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}buildvault-share/`;
    const cacheInfo = await FileSystem.getInfoAsync(cacheRoot);
    if (!cacheInfo.exists) {
      await FileSystem.makeDirectoryAsync(cacheRoot, { intermediates: true });
    }

    const extension = getExtensionFromUri(uri, fallbackExtension);
    const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${extension}`;
    const destination = `${cacheRoot}${filename}`;
    const result = await FileSystem.downloadAsync(uri, destination);
    return result.uri;
  }

  const normalizedUri = uri.startsWith('file://') ? uri : `file://${uri}`;
  const exists = await localFileExists(normalizedUri);
  if (!exists) {
    throw new Error('Media file not found locally');
  }
  return normalizedUri;
}

export async function deleteLocalFileIfPresent(uri: string | null | undefined): Promise<void> {
  if (!uri || isRemoteMediaUri(uri)) return;
  const normalizedUri = uri.startsWith('file://') ? uri : `file://${uri}`;
  const info = await FileSystem.getInfoAsync(normalizedUri);
  if (info.exists) {
    await FileSystem.deleteAsync(normalizedUri, { idempotent: true });
  }
}

