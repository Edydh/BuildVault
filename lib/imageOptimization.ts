import * as FileSystem from './fileSystemCompat';
import * as ImageManipulator from 'expo-image-manipulator';

export interface ImageVariants {
  original: string;
  full: string;
  preview: string;
  thumbnail: string;
}

export interface CompressionOptions {
  thumbnail: {
    width: number;
    height: number;
    quality: number;
  };
  preview: {
    width: number;
    height: number;
    quality: number;
  };
  full: {
    width: number;
    height: number;
    quality: number;
  };
}

// Default compression settings
export const DEFAULT_COMPRESSION: CompressionOptions = {
  thumbnail: { width: 150, height: 150, quality: 0.7 },
  preview: { width: 400, height: 400, quality: 0.8 },
  full: { width: 1200, height: 1200, quality: 0.9 },
};

// Sharing quality options
export const SHARING_QUALITIES = {
  thumbnail: { width: 150, height: 150, quality: 0.7, label: 'Thumbnail (150px)' },
  preview: { width: 400, height: 400, quality: 0.8, label: 'Preview (400px)' },
  full: { width: 1200, height: 1200, quality: 0.9, label: 'Full (1200px)' },
  original: { width: 0, height: 0, quality: 1, label: 'Original (No compression)' },
} as const;

export type SharingQuality = keyof typeof SHARING_QUALITIES;

/**
 * Generate compressed image variants for a given image URI
 */
export async function generateImageVariants(
  originalUri: string,
  projectId: string,
  mediaId: string,
  options: CompressionOptions = DEFAULT_COMPRESSION
): Promise<ImageVariants> {
  try {
    const normalizedOriginalUri = originalUri.startsWith('file://') ? originalUri : `file://${originalUri}`;
    const isRemote = /^https?:\/\//i.test(originalUri.trim());
    if (!isRemote) {
      const sourceInfo = await FileSystem.getInfoAsync(normalizedOriginalUri);
      if (!sourceInfo.exists || sourceInfo.isDirectory) {
        return {
          original: originalUri,
          full: originalUri,
          preview: originalUri,
          thumbnail: originalUri,
        };
      }
    } else {
      // Remote media is already optimized by storage/CDN; skip local variant generation.
      return {
        original: originalUri,
        full: originalUri,
        preview: originalUri,
        thumbnail: originalUri,
      };
    }

    // Create project media directory if it doesn't exist
    const projectDir = `${FileSystem.documentDirectory}projects/${projectId}/media/`;
    await FileSystem.makeDirectoryAsync(projectDir, { intermediates: true });

    // Create variants directory
    const variantsDir = `${projectDir}${mediaId}/`;
    await FileSystem.makeDirectoryAsync(variantsDir, { intermediates: true });

    const variants: ImageVariants = {
      original: originalUri,
      full: `${variantsDir}full.jpg`,
      preview: `${variantsDir}preview.jpg`,
      thumbnail: `${variantsDir}thumbnail.jpg`,
    };

    // Generate thumbnail
    await ImageManipulator.manipulateAsync(
      normalizedOriginalUri,
      [
        {
          resize: {
            width: options.thumbnail.width,
            height: options.thumbnail.height,
          },
        },
      ],
      {
        compress: options.thumbnail.quality,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: false,
      }
    ).then(result => FileSystem.copyAsync({ from: result.uri, to: variants.thumbnail }));

    // Generate preview
    await ImageManipulator.manipulateAsync(
      normalizedOriginalUri,
      [
        {
          resize: {
            width: options.preview.width,
            height: options.preview.height,
          },
        },
      ],
      {
        compress: options.preview.quality,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: false,
      }
    ).then(result => FileSystem.copyAsync({ from: result.uri, to: variants.preview }));

    // Generate full quality (for sharing)
    await ImageManipulator.manipulateAsync(
      normalizedOriginalUri,
      [
        {
          resize: {
            width: options.full.width,
            height: options.full.height,
          },
        },
      ],
      {
        compress: options.full.quality,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: false,
      }
    ).then(result => FileSystem.copyAsync({ from: result.uri, to: variants.full }));

    return variants;
  } catch (error) {
    console.error('Error generating image variants:', error);
    // Return original URI for all variants if compression fails
    return {
      original: originalUri,
      full: originalUri,
      preview: originalUri,
      thumbnail: originalUri,
    };
  }
}

/**
 * Get the appropriate image URI based on loading state
 */
export function getImageUriForState(
  variants: ImageVariants,
  loadingState: 'thumbnail' | 'preview' | 'full' | 'original'
): string {
  switch (loadingState) {
    case 'thumbnail':
      return variants.thumbnail;
    case 'preview':
      return variants.preview;
    case 'full':
      return variants.full;
    case 'original':
    default:
      return variants.original;
  }
}

/**
 * Get sharing URI based on quality selection
 */
export function getSharingUri(
  variants: ImageVariants,
  quality: SharingQuality
): string {
  switch (quality) {
    case 'thumbnail':
      return variants.thumbnail;
    case 'preview':
      return variants.preview;
    case 'full':
      return variants.full;
    case 'original':
    default:
      return variants.original;
  }
}

/**
 * Check if image variants exist for a media item
 */
export async function checkImageVariantsExist(mediaId: string, projectId: string): Promise<boolean> {
  try {
    const variantsDir = `${FileSystem.documentDirectory}projects/${projectId}/media/${mediaId}/`;
    const thumbnailExists = await FileSystem.getInfoAsync(`${variantsDir}thumbnail.jpg`);
    const previewExists = await FileSystem.getInfoAsync(`${variantsDir}preview.jpg`);
    const fullExists = await FileSystem.getInfoAsync(`${variantsDir}full.jpg`);
    
    return thumbnailExists.exists && previewExists.exists && fullExists.exists;
  } catch {
    return false;
  }
}

/**
 * Get image variants for existing media item
 */
export async function getImageVariants(mediaId: string, projectId: string, originalUri: string): Promise<ImageVariants> {
  const variantsDir = `${FileSystem.documentDirectory}projects/${projectId}/media/${mediaId}/`;
  
  return {
    original: originalUri,
    full: `${variantsDir}full.jpg`,
    preview: `${variantsDir}preview.jpg`,
    thumbnail: `${variantsDir}thumbnail.jpg`,
  };
}

/**
 * Clean up image variants when media is deleted
 */
export async function cleanupImageVariants(mediaId: string, projectId: string): Promise<void> {
  try {
    const variantsDir = `${FileSystem.documentDirectory}projects/${projectId}/media/${mediaId}/`;
    const dirInfo = await FileSystem.getInfoAsync(variantsDir);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(variantsDir, { idempotent: true });
    }
  } catch (error) {
    console.error('Error cleaning up image variants:', error);
  }
}

/**
 * Get file size in MB
 */
export async function getFileSizeMB(uri: string): Promise<number> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (fileInfo.exists) {
      return (fileInfo.size || 0) / (1024 * 1024);
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Get compression ratio
 */
export async function getCompressionRatio(originalUri: string, compressedUri: string): Promise<number> {
  try {
    const originalSize = await getFileSizeMB(originalUri);
    const compressedSize = await getFileSizeMB(compressedUri);
    return originalSize > 0 ? compressedSize / originalSize : 1;
  } catch {
    return 1;
  }
}
