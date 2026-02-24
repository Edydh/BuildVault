import * as FileSystem from './fileSystemCompat';
import { VideoThumbnailResult, generateSmartVideoThumbnail } from './media';
import { getActiveUserScope } from './db';

const ROOT_DIR = FileSystem.documentDirectory + 'buildvault/';
const GUEST_SCOPE_DIR = 'guest';

function getScopedUserDirectoryName(): string {
  const scopedUserId = getActiveUserScope();
  return scopedUserId ? encodeURIComponent(scopedUserId) : GUEST_SCOPE_DIR;
}

function getScopedRootDir(): string {
  return ROOT_DIR + getScopedUserDirectoryName() + '/';
}

function getLegacyProjectDir(projectId: string): string {
  return ROOT_DIR + projectId + '/';
}

export async function ensureRootDir() {
  const dirInfo = await FileSystem.getInfoAsync(ROOT_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(ROOT_DIR, { intermediates: true });
  }

  const scopedRoot = getScopedRootDir();
  const scopedDirInfo = await FileSystem.getInfoAsync(scopedRoot);
  if (!scopedDirInfo.exists) {
    await FileSystem.makeDirectoryAsync(scopedRoot, { intermediates: true });
  }
}

export async function ensureProjectDir(projectId: string) {
  await ensureRootDir();
  const projectDir = getScopedRootDir() + projectId + '/';
  const dirInfo = await FileSystem.getInfoAsync(projectDir);
  if (!dirInfo.exists) {
    const legacyDir = getLegacyProjectDir(projectId);
    const legacyInfo = await FileSystem.getInfoAsync(legacyDir);
    if (legacyInfo.exists) {
      try {
        await FileSystem.moveAsync({ from: legacyDir, to: projectDir });
        return projectDir;
      } catch (error) {
        console.log('Legacy project directory move failed, creating fresh scoped directory:', error);
      }
    }

    await FileSystem.makeDirectoryAsync(projectDir, { intermediates: true });
  }
  return projectDir;
}

export async function deleteProjectDir(projectId: string) {
  const projectDir = getScopedRootDir() + projectId + '/';
  const dirInfo = await FileSystem.getInfoAsync(projectDir);
  if (dirInfo.exists) {
    await FileSystem.deleteAsync(projectDir, { idempotent: true });
  }

  const legacyDir = getLegacyProjectDir(projectId);
  const legacyInfo = await FileSystem.getInfoAsync(legacyDir);
  if (legacyInfo.exists) {
    await FileSystem.deleteAsync(legacyDir, { idempotent: true });
  }
}

export async function clearAllProjectDirs() {
  const scopedRoot = getScopedRootDir();
  const dirInfo = await FileSystem.getInfoAsync(scopedRoot);
  if (dirInfo.exists) {
    await FileSystem.deleteAsync(scopedRoot, { idempotent: true });
  }
}

export async function getProjectMediaDir(projectId: string) {
  const projectDir = await ensureProjectDir(projectId);
  const mediaDir = projectDir + 'media/';
  const dirInfo = await FileSystem.getInfoAsync(mediaDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(mediaDir, { intermediates: true });
  }
  return mediaDir;
}

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

export function getMediaType(filename: string): 'photo' | 'video' | 'doc' {
  const ext = getFileExtension(filename);
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'photo';
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'video';
  return 'doc';
}

export async function saveMediaToProject(
  projectId: string,
  uri: string,
  type: 'photo' | 'video' | 'doc',
  _note?: string
): Promise<{ fileUri: string; thumbUri?: string }> {
  const mediaDir = await getProjectMediaDir(projectId);

  // Generate unique filename
  const timestamp = Date.now();
  let extension: string;
  let filename: string;
  
  if (type === 'doc') {
    // For documents, preserve original extension
    const originalExtension = getFileExtension(uri) || 'bin';
    filename = `doc_${timestamp}.${originalExtension}`;
  } else {
    extension = type === 'photo' ? 'jpg' : 'mp4';
    filename = `${type}_${timestamp}.${extension}`;
  }
  
  const fileUri = mediaDir + filename;

  // Copy file to project directory
  await FileSystem.copyAsync({
    from: uri,
    to: fileUri,
  });

  // Generate thumbnails for photos and videos
  let thumbUri: string | undefined;
  
  if (type === 'photo') {
    // For photos, we'll use the same file as thumbnail for now
    // In the future, we could generate a smaller thumbnail here
    thumbUri = fileUri;
  } else if (type === 'video') {
    try {
      // Generate a smart video thumbnail that tries multiple time points
      console.log('Generating smart video thumbnail for:', fileUri);
      const thumbnailResult: VideoThumbnailResult = await generateSmartVideoThumbnail(fileUri, {
        quality: 0.9, // Higher quality
        width: 400, // Larger thumbnail
        height: 400,
      });
      
      // Move thumbnail to project directory
      const thumbFilename = `thumb_${timestamp}.jpg`;
      const thumbFileUri = mediaDir + thumbFilename;
      
      await FileSystem.moveAsync({
        from: thumbnailResult.uri,
        to: thumbFileUri,
      });
      
      thumbUri = thumbFileUri;
      console.log('Video thumbnail generated successfully:', thumbUri);
      console.log('Thumbnail details:', {
        fileSize: thumbnailResult.fileSize,
        width: thumbnailResult.width,
        height: thumbnailResult.height,
        originalUri: thumbnailResult.uri
      });
    } catch (error) {
      console.error('Error generating video thumbnail:', error);
      // Fallback to using the video file itself
      thumbUri = fileUri;
    }
  }

  return { fileUri, thumbUri };
}
