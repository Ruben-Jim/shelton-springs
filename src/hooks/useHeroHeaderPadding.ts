import { Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Original header height before edge-to-edge (includes internal top padding). */
export const HERO_BASE_HEIGHT = 200;

/** Shorter hero for tab pages other than Home, which have no welcome/address text below the title. */
export const HERO_COMPACT_BASE_HEIGHT = 160;

/** Extra room for the test-user read-only banner so it isn't clipped in the compact hero. */
export const HERO_READ_ONLY_BANNER_HEIGHT = 36;

/** Inner padding below the status bar inset (matches original paddingTop: 40). */
export const HERO_HEADER_EXTRA_PADDING = 40;

export const HERO_TAB_SAFE_AREA_EDGES = ['bottom', 'left', 'right'] as const;

export const HERO_TAB_SAFE_AREA_STYLE = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B1A12',
  },
}).root;

export const HERO_TAB_CONTAINER_STYLE = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
}).root;

export const HERO_HEADER_IMAGE = require('../../assets/hoa-4k.jpg');

/** Wide crop of the top of the same photo (sky, mountains, lake) for the short, very wide desktop hero. */
export const HERO_HEADER_IMAGE_DESKTOP = require('../../assets/hoa-desktop.jpg');

const HERO_DESKTOP_MIN_WIDTH = 1024;

/**
 * Hero photo for the current width. Desktop web gets the wide crop drawn with `cover` so it
 * is never distorted; everything else keeps the original photo and framing.
 */
export function getHeroImage(screenWidth: number) {
  const isDesktop = Platform.OS === 'web' && screenWidth >= HERO_DESKTOP_MIN_WIDTH;
  return isDesktop
    ? { source: HERO_HEADER_IMAGE_DESKTOP, resizeMode: 'cover' as const, isDesktop }
    : { source: HERO_HEADER_IMAGE, resizeMode: 'stretch' as const, isDesktop };
}

/** Top inset + legacy padding (status bar draws over the hero photo). */
export function useHeroHeaderPadding(extra = HERO_HEADER_EXTRA_PADDING): number {
  const insets = useSafeAreaInsets();
  return insets.top + extra;
}

/**
 * Shared hero size for tab roots. Home uses the full height (it shows the welcome
 * text); every other tab passes `compact` so all of them share one shorter height.
 * Do not branch on role, so switching tabs never changes the header size.
 */
export function useHeroHeaderLayout({ compact = false }: { compact?: boolean } = {}) {
  const insets = useSafeAreaInsets();
  const paddingTop = insets.top + HERO_HEADER_EXTRA_PADDING;
  const height = insets.top + (compact ? HERO_COMPACT_BASE_HEIGHT : HERO_BASE_HEIGHT);
  return { paddingTop, height, imageHeight: height };
}
