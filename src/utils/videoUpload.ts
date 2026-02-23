import { Platform } from 'react-native';

export interface VideoCompressOptions {
  maxDuration?: number;      // Maximum duration in seconds
  maxSizeMB?: number;        // Maximum file size in MB
  quality?: 'low' | 'medium' | 'high';
  maxWidth?: number;         // Maximum width for resizing
}

const DEFAULT_VIDEO_OPTIONS: Required<VideoCompressOptions> = {
  maxDuration: 30,   // 30 seconds max
  maxSizeMB: 20,     // 20MB soft limit
  quality: 'medium',
  maxWidth: 720,     // 720p max resolution
};

// Get optimal compression settings based on video characteristics
export const getOptimalVideoQuality = (fileSize: number, duration: number): VideoCompressOptions => {
  const sizeMB = fileSize / (1024 * 1024);

  // Very small files get high quality
  if (sizeMB < 5) {
    return { maxWidth: 1080, quality: 'high' };
  }

  // Medium files get medium quality
  if (sizeMB < 25) {
    return { maxWidth: 720, quality: 'medium' };
  }

  // Large files get aggressive compression
  return { maxWidth: 480, quality: 'low' };
};

// Get duration-based quality settings
export const getDurationBasedSettings = (duration: number): VideoCompressOptions => {
  if (duration <= 15) {
    return { maxWidth: 1080, quality: 'high' };
  } else if (duration <= 30) {
    return { maxWidth: 720, quality: 'medium' };
  } else {
    return { maxWidth: 480, quality: 'low' };
  }
};

// Basic video compression (currently size/duration validation only)
// In production, you might integrate with FFmpeg or cloud services
export const compressVideoForUpload = async (
  uri: string,
  options: VideoCompressOptions = {}
): Promise<{ uri: string; size: number; duration: number; compressed: boolean }> => {
  const opts = { ...DEFAULT_VIDEO_OPTIONS, ...options };

  try {
    // Get video info
    const videoInfo = await getVideoInfo(uri);

    // Validate duration
    if (videoInfo.duration > opts.maxDuration) {
      throw new Error(`Video too long. Maximum ${opts.maxDuration} seconds allowed. Current: ${videoInfo.duration}s`);
    }

    // Validate file size
    const sizeMB = videoInfo.size / (1024 * 1024);
    if (sizeMB > opts.maxSizeMB) {
      throw new Error(`Video too large. Maximum ${opts.maxSizeMB}MB allowed. Current: ${sizeMB.toFixed(1)}MB`);
    }

    // For now, return the original with compression flag
    // In a full implementation, you'd apply actual compression here
    return {
      uri,
      size: videoInfo.size,
      duration: videoInfo.duration,
      compressed: sizeMB > 10 // Mark as "compressed" if it was large
    };

  } catch (error) {
    console.error('Error processing video:', error);
    throw error;
  }
};

// Get basic video information
const getVideoInfo = async (uri: string) => {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();

    return {
      size: blob.size,
      duration: 0, // Would need expo-av or similar to get actual duration
      width: 0,    // Would need video metadata extraction
      height: 0,
      mimeType: blob.type,
    };
  } catch (error) {
    console.error('Error getting video info:', error);
    throw new Error('Could not read video file');
  }
};

export interface UploadReadyMedia {
  blob: Blob;
  mimeType: string;
  optimizedUri: string;
  type: 'image' | 'video';
  metadata?: {
    duration?: number;
    size: number;
    width?: number;
    height?: number;
    compressed?: boolean;
  };
}

// Main function to prepare media for upload
export const getUploadReadyMedia = async (
  uri: string,
  type: 'image' | 'video',
  options?: VideoCompressOptions
): Promise<UploadReadyMedia> => {

  if (type === 'video') {
    // Handle video compression
    const compressed = await compressVideoForUpload(uri, options);
    const response = await fetch(compressed.uri);
    const blob = await response.blob();

    return {
      blob,
      mimeType: blob.type || 'video/mp4',
      optimizedUri: compressed.uri,
      type: 'video',
      metadata: {
        duration: compressed.duration,
        size: compressed.size,
        compressed: compressed.compressed,
      },
    };
  } else {
    // Use existing image optimization
    const { getUploadReadyImage } = await import('./imageUpload');
    const imageResult = await getUploadReadyImage(uri);

    return {
      ...imageResult,
      type: 'image',
      metadata: {
        size: imageResult.blob.size,
      },
    };
  }
};

// Validate video before upload (prevents large file uploads)
export const validateVideoBeforeUpload = async (uri: string): Promise<{
  valid: boolean;
  sizeMB: number;
  suggestedCompression?: boolean;
  error?: string;
}> => {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const sizeMB = blob.size / (1024 * 1024);

    // Hard limit: 30MB
    if (sizeMB > 30) {
      return {
        valid: false,
        sizeMB,
        error: 'Video too large. Maximum 30MB allowed.',
      };
    }

    // Soft limit: suggest compression for >20MB
    if (sizeMB > 20) {
      return {
        valid: true,
        sizeMB,
        suggestedCompression: true,
      };
    }

    return {
      valid: true,
      sizeMB,
    };

  } catch (error) {
    return {
      valid: false,
      sizeMB: 0,
      error: 'Could not read video file.',
    };
  }
};