import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';

export interface OptimizeImageOptions {
  maxDimension?: number;
  compress?: number;
  format?: ImageManipulator.SaveFormat;
}

const DEFAULT_OPTIONS: Required<OptimizeImageOptions> = {
  maxDimension: 1200,
  compress: 0.6,
  format: ImageManipulator.SaveFormat.JPEG,
};

export const optimizeImageForUpload = async (
  uri: string,
  options: OptimizeImageOptions = {}
): Promise<ImageManipulator.ImageResult> => {
  const { maxDimension, compress, format } = { ...DEFAULT_OPTIONS, ...options };

  try {
    // Always resize to maxDimension to ensure consistent image sizes
    // ImageManipulator will maintain aspect ratio when only width is specified
    const actions: ImageManipulator.Action[] = [
      {
      resize: {
          width: maxDimension,
      },
      },
    ];

    return await ImageManipulator.manipulateAsync(uri, actions, {
      compress,
      format,
    });
  } catch (error) {
    console.error('Error optimizing image:', error);
    // If manipulation fails, try without resizing
    return await ImageManipulator.manipulateAsync(uri, [], {
    compress,
    format,
  });
  }
};

export interface UploadReadyImage {
  blob: Blob;
  mimeType: string;
  optimizedUri: string;
}

// Web image compression using HTML5 Canvas API
async function compressImageForWeb(
  uri: string,
  maxDimension: number = 1200,
  quality: number = 0.6
): Promise<Blob> {
  // Type guard for browser environment
  if (typeof window === 'undefined' || !window.Image || !window.document) {
    throw new Error('Browser APIs not available');
  }
  
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      try {
        // Calculate new dimensions maintaining aspect ratio
        let width = img.width;
        let height = img.height;
        
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }
        
        // Create canvas and compress
        const canvas = window.document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          'image/jpeg',
          quality
        );
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    img.src = uri;
  });
}

export const getUploadReadyImage = async (
  uri: string,
  options?: OptimizeImageOptions
): Promise<UploadReadyImage> => {
  const { maxDimension = 1200, compress = 0.6 } = { ...DEFAULT_OPTIONS, ...options };
  
  // For web, handle image upload with compression
  if (Platform.OS === 'web') {
    try {
      // Compress the image before uploading
      const compressedBlob = await compressImageForWeb(uri, maxDimension, compress);
      
      return {
        blob: compressedBlob,
        mimeType: 'image/jpeg',
        optimizedUri: uri,
      };
    } catch (error) {
      console.error('Error compressing web image, falling back to original:', error);
      // Fallback: try to fetch the original blob if compression fails
      try {
        const response = await fetch(uri);
        const blob = await response.blob();
        const mimeType = blob.type || 'image/jpeg';
        return {
          blob,
          mimeType,
          optimizedUri: uri,
        };
      } catch (fetchError) {
        console.error('Error handling web image upload:', fetchError);
        throw fetchError;
      }
    }
  }
  
  // For iOS and other platforms, use ImageManipulator for optimization
  const optimized = await optimizeImageForUpload(uri, options);
  const response = await fetch(optimized.uri);
  const blob = await response.blob();

  const mimeType = blob.type || (options?.format === ImageManipulator.SaveFormat.PNG ? 'image/png' : 'image/jpeg');

  return {
    blob,
    mimeType,
    optimizedUri: optimized.uri,
  };
};


