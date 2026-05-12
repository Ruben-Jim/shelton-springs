import Constants from 'expo-constants';

/** Public community site (web app + marketing). */
export const WEBSITE_URL = 'https://sheltonsprings.homes';

/** Google Play listing; package matches app.json android.package. */
export const ANDROID_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.rubenjim.sheltonsprings';

function readExtraString(key: string): string | undefined {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const v = extra?.[key];
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  if (!t || t.includes('${')) return undefined;
  return t;
}

function readNumericAppStoreId(): string | undefined {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const v = extra?.iosAppStoreId;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'string') {
    const t = v.trim();
    if (/^\d+$/.test(t)) return t;
  }
  return undefined;
}

/**
 * iOS App Store URL: full URL from env/extra, else short link from extra.iosAppStoreId
 * (Apple ASC numeric id, same as EAS submit.ios.ascAppId).
 */
export function getIosAppStoreUrl(): string | undefined {
  const fromConstants = readExtraString('iosAppStoreUrl');
  const fromEnv =
    typeof process.env.EXPO_PUBLIC_IOS_APP_STORE_URL === 'string'
      ? process.env.EXPO_PUBLIC_IOS_APP_STORE_URL.trim()
      : undefined;
  const raw = fromConstants || fromEnv;
  if (raw && raw.startsWith('http')) return raw;
  const id = readNumericAppStoreId();
  if (id) return `https://apps.apple.com/app/id${id}`;
  return undefined;
}
