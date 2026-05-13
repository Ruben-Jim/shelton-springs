import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useEffect, useState, useMemo } from 'react';
import { Image as ExpoImage } from 'expo-image';
import { isDemoBuild } from '../config/isDemoBuild';

// Global cache to store URLs across all component instances
// This prevents multiple queries for the same storageId across different renders
// Convex's useQuery already deduplicates within the same render cycle
const urlCache = new Map<string, { url: string; timestamp: number }>();
const CACHE_DURATION = 55 * 60 * 1000; // 55 minutes (slightly less than Convex's 1 hour URL expiration)

function demoImageUrl(storageId: string): string {
  return `https://picsum.photos/seed/${encodeURIComponent(storageId).slice(0, 48)}/256/256`;
}

/**
 * Custom hook to get storage URL with intelligent caching
 * This reduces API calls by:
 * 1. Leveraging Convex's built-in query deduplication (same args = one query)
 * 2. Caching URLs in memory across component remounts and different components
 * 3. Reusing cached URLs until they're close to expiration
 *
 * This is especially important for components like ProfileImage that are rendered
 * many times (posts, comments, etc.) with the same storageId
 */
export const useStorageUrl = (storageId: string | null | undefined): string | undefined => {
  const isDemo = isDemoBuild();
  const [cachedUrl, setCachedUrl] = useState<string | undefined>(undefined);

  // Check cache FIRST synchronously - this is our primary check
  const cachedResult = useMemo(() => {
    if (!storageId) return { url: undefined, isValid: false };
    const cached = urlCache.get(storageId);
    const now = Date.now();
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      return { url: cached.url, isValid: true };
    }
    return { url: undefined, isValid: false };
  }, [storageId]);

  // Only call Convex if we DON'T have a valid cached URL
  // This prevents unnecessary API calls - cache is checked FIRST
  const shouldSkip = !storageId || cachedResult.isValid;

  // Use Convex query ONLY if cache is missing/expired
  // Convex's useQuery automatically deduplicates queries with the same args
  const urlFromQuery = useQuery(
    api.storage.getUrl,
    isDemo || shouldSkip ? 'skip' : { storageId: storageId as any }
  );

  useEffect(() => {
    if (!storageId) {
      setCachedUrl(undefined);
      return;
    }

    if (isDemo) {
      const u = demoImageUrl(storageId);
      setCachedUrl(u);
      ExpoImage.prefetch(u).catch(() => {});
      return;
    }

    // If we have a valid cached URL, use it immediately and skip Convex query
    if (cachedResult.isValid && cachedResult.url) {
      setCachedUrl(cachedResult.url);
      // Prefetch to expo-image cache for disk caching
      ExpoImage.prefetch(cachedResult.url).catch(() => {
        // Prefetch failures are non-fatal; ignore silently.
      });
      return; // Don't proceed with query logic - cache is valid
    }

    // Only update from query if we don't have cache
    if (urlFromQuery) {
      const now = Date.now();
      const cached = urlCache.get(storageId);

      // Update cache if URL changed or cache is missing/expired
      const shouldUpdateCache =
        !cached || cached.url !== urlFromQuery || (now - cached.timestamp) >= CACHE_DURATION;

      if (shouldUpdateCache) {
        urlCache.set(storageId, { url: urlFromQuery, timestamp: now });
        setCachedUrl(urlFromQuery);
        // Prefetch to expo-image cache for disk caching
        ExpoImage.prefetch(urlFromQuery).catch(() => {
          // Prefetch failures are non-fatal; ignore silently.
        });
      } else if (cached) {
        // Use existing cache
        setCachedUrl(cached.url);
      }
    }
  }, [storageId, urlFromQuery, cachedResult.isValid, cachedResult.url, isDemo]);

  // Return cached URL immediately if available (cache checked FIRST),
  // otherwise return from state or query result
  // Priority: cachedResult (sync check) > cachedUrl (state) > urlFromQuery (async)
  if (isDemo && storageId) {
    return demoImageUrl(storageId);
  }

  const resolvedUrl = cachedResult.url || cachedUrl || urlFromQuery;

  return resolvedUrl == null ? undefined : resolvedUrl;
};

/**
 * Batch version to get multiple URLs at once
 * This is more efficient for getting many URLs in a single component
 * Still benefits from caching and deduplication
 */
export const useStorageUrls = (storageIds: (string | null | undefined)[]): (string | undefined)[] => {
  const uniqueIds = Array.from(new Set(storageIds.filter(Boolean) as string[]));
  const urls = uniqueIds.map((id) => useStorageUrl(id));

  // Map back to original array order
  return storageIds.map((id) => {
    if (!id) return undefined;
    const index = uniqueIds.indexOf(id);
    return index >= 0 ? urls[index] : undefined;
  });
};

/**
 * Clear the URL cache (useful for testing or manual cache invalidation)
 */
export const clearStorageUrlCache = () => {
  urlCache.clear();
};
