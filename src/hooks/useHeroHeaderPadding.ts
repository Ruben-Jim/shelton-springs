import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Original header height before edge-to-edge (includes internal top padding). */
export const HERO_BASE_HEIGHT = 200;

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

/** Top inset + legacy padding (status bar draws over the hero photo). */
export function useHeroHeaderPadding(extra = HERO_HEADER_EXTRA_PADDING): number {
  const insets = useSafeAreaInsets();
  return insets.top + extra;
}

/**
 * Shared hero size for every tab root (Home, Community, Board, Docs, Fees,
 * Covenants, Admin). Always the same height — do not branch on role.
 */
export function useHeroHeaderLayout() {
  const insets = useSafeAreaInsets();
  const paddingTop = insets.top + HERO_HEADER_EXTRA_PADDING;
  const height = insets.top + HERO_BASE_HEIGHT;
  return { paddingTop, height, imageHeight: height };
}
