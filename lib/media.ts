import * as FileSystem from 'expo-file-system/legacy';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as DocumentPicker from 'expo-document-picker';

export interface VideoThumbnailOptions {
  time?: number;
  quality?: number;
  width?: number;
  height?: number;
}

export interface VideoThumbnailResult {
  uri: string;
  width: number;
  height: number;
  fileSize: number;
}

// Default thumbnail options
const DEFAULT_THUMBNAIL_OPTIONS: VideoThumbnailOptions = {
  time: 2000, // 2 seconds into video for better content
  quality: 0.9, // Higher quality
  width: 400, // Larger thumbnail
  height: 400,
};

/**
 * Check if a video file exists and is readable
 */
async function validateVideoFile(uri: string): Promise<boolean> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    return fileInfo.exists && !fileInfo.isDirectory && (fileInfo.size || 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Generate a high-quality video thumbnail with caching
 */
export async function makeVideoThumb(
  uri: string, 
  options: VideoThumbnailOptions = {}
): Promise<VideoThumbnailResult> {
  const opts = { ...DEFAULT_THUMBNAIL_OPTIONS, ...options };
  
  try {
    // First, validate that the video file exists and is readable
    const isValidFile = await validateVideoFile(uri);
    if (!isValidFile) {
      throw new Error(`Video file is not accessible or does not exist: ${uri}`);
    }

    // Generate thumbnail with specified options
    const { uri: thumbUri, width, height } = await VideoThumbnails.getThumbnailAsync(uri, {
      time: opts.time,
      quality: opts.quality,
    });

    // Get file size
    const fileInfo = await FileSystem.getInfoAsync(thumbUri);
    const fileSize = fileInfo.exists ? (fileInfo.size || 0) : 0;

    return {
      uri: thumbUri,
      width: width || opts.width || 300,
      height: height || opts.height || 300,
      fileSize,
    };
  } catch (error) {
    console.error('Error generating video thumbnail:', error);
    throw new Error(`Failed to generate video thumbnail: ${error}`);
  }
}

/**
 * Generate multiple thumbnails for a video (for better selection)
 */
export async function generateVideoThumbnails(
  uri: string,
  count: number = 3,
  options: VideoThumbnailOptions = {}
): Promise<VideoThumbnailResult[]> {
  const opts = { ...DEFAULT_THUMBNAIL_OPTIONS, ...options };
  const thumbnails: VideoThumbnailResult[] = [];
  
  try {
    // Get video duration first (if possible)
    const duration = 10000; // Default 10 seconds
    const interval = duration / (count + 1);
    
    for (let i = 1; i <= count; i++) {
      const time = interval * i;
      const thumbnail = await makeVideoThumb(uri, {
        ...opts,
        time: Math.min(time, duration - 1000), // Don't go too close to the end
      });
      thumbnails.push(thumbnail);
    }
    
    return thumbnails;
  } catch (error) {
    console.error('Error generating multiple video thumbnails:', error);
    // Return single thumbnail as fallback
    const singleThumb = await makeVideoThumb(uri, opts);
    return [singleThumb];
  }
}

/**
 * Generate a smart video thumbnail by trying multiple time points
 */
export async function generateSmartVideoThumbnail(
  uri: string,
  options: VideoThumbnailOptions = {}
): Promise<VideoThumbnailResult> {
  const opts = { ...DEFAULT_THUMBNAIL_OPTIONS, ...options };
  
  try {
    // First, validate that the video file exists and is readable
    const isValidFile = await validateVideoFile(uri);
    if (!isValidFile) {
      throw new Error(`Video file is not accessible or does not exist: ${uri}`);
    }

    // Try multiple time points to get the best thumbnail
    // For shorter videos (6 seconds), try earlier time points
    const timePoints = [100, 500, 1000, 1500, 2000, 3000]; // 0.1s, 0.5s, 1s, 1.5s, 2s, 3s
    let bestThumbnail: VideoThumbnailResult | null = null;
    let successCount = 0;
    
    for (const time of timePoints) {
      try {
        const thumbnail = await makeVideoThumb(uri, {
          ...opts,
          time,
        });
        
        successCount++;
        
        // Use the first successful thumbnail, or prefer larger file sizes (more content)
        if (!bestThumbnail || thumbnail.fileSize > bestThumbnail.fileSize) {
          bestThumbnail = thumbnail;
        }
        
        // If we got a good thumbnail (larger than 5KB), use it
        if (thumbnail.fileSize > 5120) {
          console.log(`Good thumbnail found at ${time}ms: ${thumbnail.fileSize} bytes`);
          return thumbnail;
        }
      } catch (error) {
        console.log(`Failed to generate thumbnail at ${time}ms:`, error);
        continue;
      }
    }
    
    // If we got at least one successful thumbnail, return the best one
    if (bestThumbnail && successCount > 0) {
      return bestThumbnail;
    }
    
    // If no thumbnails were successful, throw an error instead of retrying
    throw new Error(`Failed to generate any video thumbnails for: ${uri}`);
  } catch (error) {
    console.error('Error generating smart video thumbnail:', error);
    throw error; // Re-throw to let calling code handle the error
  }
}

/**
 * Check if a video thumbnail exists and is valid
 */
export async function checkVideoThumbnailExists(thumbUri: string): Promise<boolean> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(thumbUri);
    return fileInfo.exists && (fileInfo.size || 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Clean up video thumbnail files
 */
export async function cleanupVideoThumbnail(thumbUri: string): Promise<void> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(thumbUri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(thumbUri, { idempotent: true });
    }
  } catch (error) {
    console.error('Error cleaning up video thumbnail:', error);
  }
}

export async function copyDocToProject(srcUri: string, destUri: string) {
  await FileSystem.copyAsync({ from: srcUri, to: destUri });
}

export async function pickDocument() {
  const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return null;
  return res.assets[0];
}

export async function moveIntoProject(tmpUri: string, destUri: string) {
  try {
    await FileSystem.moveAsync({ from: tmpUri, to: destUri });
  } catch {
    await FileSystem.copyAsync({ from: tmpUri, to: destUri });
  }
}

