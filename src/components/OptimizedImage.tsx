import React, { ReactNode, useMemo } from 'react';
import { View, ActivityIndicator, StyleSheet, ViewStyle, Platform } from 'react-native';
import { Image as ExpoImage, ImageProps as ExpoImageProps } from 'expo-image';
import { useStorageUrlState } from '../hooks/useStorageUrl';

type CachePolicy = NonNullable<ExpoImageProps['cachePolicy']>;

export interface OptimizedImageProps extends Omit<ExpoImageProps, 'source'> {
  source?: string | null;
  storageId?: string | null;
  fallback?: ReactNode;
  placeholderContent?: ReactNode;
  transitionDuration?: number;
  cachePolicy?: CachePolicy;
  containerStyle?: ViewStyle;
}

const DEFAULT_PLACEHOLDER_COLOR = 'rgba(229, 231, 235, 1)'; // Tailwind gray-200

const OptimizedImage = React.forwardRef<ExpoImage, OptimizedImageProps>(
  (
    {
      source,
      storageId,
      fallback,
      placeholderContent,
      transitionDuration = 200,
      cachePolicy = 'memory-disk', // Check memory cache first, then disk cache, then fetch from network
      containerStyle,
      style,
      contentFit = 'cover',
      priority,
      recyclingKey,
      allowDownscaling,
      onLoadStart,
      onLoadEnd,
      ...rest
    },
    ref
  ) => {
    const resolvedStorageId = useMemo(() => {
      if (storageId) return storageId;
      // Only treat as storageId if it doesn't look like a URI
      // URIs typically have protocols (http, https, file) or path separators
      if (source && !source.startsWith('http') && !source.startsWith('file://') && !source.includes('/') && !source.includes('://')) {
        return source;
      }
      return null;
    }, [storageId, source]);

    const flattenedImageStyle = useMemo(
      () => (style ? (StyleSheet.flatten(style) as ViewStyle) : undefined),
      [style]
    );

    // Handle direct URIs (http/https for remote, file:// or paths for local)
    // Local URIs from image picker might be file:// or just paths
    const isDirectUri = source && (
      source.startsWith('http') || 
      source.startsWith('https') || 
      source.startsWith('file://') ||
      source.startsWith('data:') ||
      (source.includes('/') && !source.includes('://') && source.length > 20) // Likely a local file path
    );
    const directUri = isDirectUri ? source : undefined;
    // null when the file was deleted: show the fallback (e.g. initials), not a spinner forever
    const storageUri = useStorageUrlState(resolvedStorageId);
    const resolvedUri = directUri ?? storageUri;

    const resolvedPlaceholder = useMemo(() => {
      if (placeholderContent) return placeholderContent;
      return (
        <View style={[styles.placeholder, flattenedImageStyle]}>
          <ActivityIndicator size="small" color="#9ca3af" />
        </View>
      );
    }, [placeholderContent, flattenedImageStyle]);

    if (!resolvedUri) {
      if (storageUri === undefined) {
        return <View style={[styles.placeholderContainer, containerStyle]}>{resolvedPlaceholder}</View>;
      }

      if (fallback) {
        return <>{fallback}</>;
      }

    return (
      <View style={[styles.placeholderContainer, containerStyle, flattenedImageStyle]}>
          {resolvedPlaceholder}
        </View>
      );
    }

    const resolvedPriority =
      priority ?? (Platform.OS === 'ios' || Platform.OS === 'android' ? 'high' : 'normal');

    const resolvedRecyclingKey = recyclingKey ?? resolvedStorageId ?? directUri ?? undefined;
    const resolvedAllowDownscaling = allowDownscaling ?? true;

    return (
      <View style={[
        styles.container,
        containerStyle,
        flattenedImageStyle,
        flattenedImageStyle?.borderRadius !== undefined && { borderRadius: flattenedImageStyle.borderRadius }
      ]}>
        <ExpoImage
          ref={ref}
          source={{ uri: resolvedUri }}
          contentFit={contentFit}
          transition={transitionDuration}
          cachePolicy={cachePolicy}
          priority={resolvedPriority}
          recyclingKey={resolvedRecyclingKey}
          allowDownscaling={resolvedAllowDownscaling}
          placeholder={{ uri: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'><rect width='10' height='10' fill='${encodeURIComponent(DEFAULT_PLACEHOLDER_COLOR)}'/></svg>` }}
          style={style}
          onLoadStart={onLoadStart}
          onLoadEnd={onLoadEnd}
          {...rest}
        />
      </View>
    );
  }
);

OptimizedImage.displayName = 'OptimizedImage';

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  placeholderContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: DEFAULT_PLACEHOLDER_COLOR,
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: DEFAULT_PLACEHOLDER_COLOR,
  },
});

export default OptimizedImage;


