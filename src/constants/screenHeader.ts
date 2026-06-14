/** Shared screen header sizing — desktop uses a taller hero band at the nav breakpoint (1024px). */

export const SCREEN_HEADER_HEIGHT = {
  desktop: 260,
  mobile: 240,
  mobileCompact: 215,
  mobileShort: 180,
  mobileShortCompact: 170,
} as const;

export function getScreenHeaderHeight(
  isDesktopView: boolean,
  variant: 'home' | 'standard' = 'home',
  isCompact = false,
): number {
  if (isDesktopView) {
    return SCREEN_HEADER_HEIGHT.desktop;
  }
  if (variant === 'standard') {
    return isCompact ? SCREEN_HEADER_HEIGHT.mobileShortCompact : SCREEN_HEADER_HEIGHT.mobileShort;
  }
  return isCompact ? SCREEN_HEADER_HEIGHT.mobileCompact : SCREEN_HEADER_HEIGHT.mobile;
}
