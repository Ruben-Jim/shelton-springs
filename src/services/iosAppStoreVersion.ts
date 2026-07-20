import Constants from 'expo-constants';
import { getIosAppStoreUrl } from '../constants/publicLinks';
import { isVersionNewer } from '../utils/compareVersions';

const ITUNES_LOOKUP_URL = 'https://itunes.apple.com/lookup';

type ItunesLookupResult = {
  version: string;
  trackViewUrl?: string;
};

function getInstalledVersion(): string | undefined {
  const version = Constants.expoConfig?.version;
  return typeof version === 'string' && version.trim() ? version.trim() : undefined;
}

function getBundleIdentifier(): string | undefined {
  const bundleId = Constants.expoConfig?.ios?.bundleIdentifier;
  return typeof bundleId === 'string' && bundleId.trim() ? bundleId.trim() : undefined;
}

export async function fetchIosAppStoreVersion(): Promise<ItunesLookupResult | null> {
  const bundleId = getBundleIdentifier();
  if (!bundleId) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(
      `${ITUNES_LOOKUP_URL}?bundleId=${encodeURIComponent(bundleId)}`,
      { signal: controller.signal }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const result = data?.results?.[0];
    if (!result || typeof result.version !== 'string') return null;

    return {
      version: result.version.trim(),
      trackViewUrl:
        typeof result.trackViewUrl === 'string' ? result.trackViewUrl : undefined,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export type IosUpdateCheckResult = {
  updateAvailable: boolean;
  installedVersion: string;
  storeVersion?: string;
  storeUrl?: string;
};

export async function checkIosAppUpdate(): Promise<IosUpdateCheckResult | null> {
  const installedVersion = getInstalledVersion();
  if (!installedVersion) return null;

  const storeInfo = await fetchIosAppStoreVersion();
  if (!storeInfo?.version) {
    return {
      updateAvailable: false,
      installedVersion,
    };
  }

  const storeUrl = storeInfo.trackViewUrl ?? getIosAppStoreUrl();

  return {
    updateAvailable: isVersionNewer(storeInfo.version, installedVersion),
    installedVersion,
    storeVersion: storeInfo.version,
    storeUrl,
  };
}
