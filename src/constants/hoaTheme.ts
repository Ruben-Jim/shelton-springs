/** HOA tab accent (nav icon, subtab underline, primary actions). */
export const HOA_TAB_ACCENT = '#f97316';
/** Darker orange for text on light orange backgrounds (readable contrast). */
export const HOA_TAB_ACCENT_TEXT = '#c2410c';
/** Light orange background for selected states. */
export const HOA_TAB_ACCENT_SOFT = '#fff7ed';

/**
 * Section accents for the main tabs. Same colors the mobile menu shows (its rainbow list in
 * order), keyed by route so they don't shift when a tab is hidden.
 */
export const SECTION_ACCENTS = {
  Home: '#ef4444',
  Board: '#f97316',
  Community: '#eab308',
  Fees: '#22c55e',
  Admin: '#3b82f6',
} as const;

/** Desktop web: content, nav and subtab rows share this centered max width. */
export const DESKTOP_CONTENT_MAX_WIDTH = 1200;

/** Desktop web: caps a content block at DESKTOP_CONTENT_MAX_WIDTH, centered. */
export const DESKTOP_CONTENT_STYLE = {
  width: '100%',
  maxWidth: DESKTOP_CONTENT_MAX_WIDTH,
  alignSelf: 'center',
} as const;
