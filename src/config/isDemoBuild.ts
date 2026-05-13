import Constants from 'expo-constants';

function getExpoExtra(): Record<string, unknown> | undefined {
  const fromExpoConfig = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  if (fromExpoConfig && typeof fromExpoConfig === 'object') {
    return fromExpoConfig;
  }

  const manifest = Constants.manifest as Record<string, unknown> | null | undefined;
  const fromManifest = manifest?.extra as Record<string, unknown> | undefined;
  if (fromManifest && typeof fromManifest === 'object') {
    return fromManifest;
  }

  const m2 = Constants.manifest2 as Record<string, unknown> | null | undefined;
  const expoClient = (m2?.extra as Record<string, unknown> | undefined)?.expoClient as
    | Record<string, unknown>
    | undefined;
  const fromM2 = expoClient?.extra as Record<string, unknown> | undefined;
  if (fromM2 && typeof fromM2 === 'object') {
    return fromM2;
  }

  return undefined;
}

/**
 * True when this build is the Play Store / synthetic-data demo branch
 * (`expo.extra.demoMode` in app.json). No Convex-backed reads or writes should run.
 */
export function isDemoBuild(): boolean {
  return getExpoExtra()?.demoMode === true;
}

export function demoBannerLabel(): string | undefined {
  const v = getExpoExtra()?.demoLabel;
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}
