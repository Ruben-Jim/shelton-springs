export const BOARD_POSITION_PRESETS = [
  'President',
  'Vice President',
  'Treasurer',
  'Secretary',
  'Member at Large',
] as const;

export type BoardPositionPreset = (typeof BOARD_POSITION_PRESETS)[number];

export function isBoardPositionPreset(position: string): position is BoardPositionPreset {
  return (BOARD_POSITION_PRESETS as readonly string[]).includes(position);
}

export function getBoardRoleBadge(position: string | undefined | null): {
  roleIcon: string;
  roleColor: string;
} {
  const p = (position ?? '').toLowerCase();
  if (p.includes('vice')) {
    return { roleIcon: 'star-half', roleColor: '#8b5cf6' };
  }
  if (p.includes('president')) {
    return { roleIcon: 'star', roleColor: '#f59e0b' };
  }
  if (p.includes('treasurer')) {
    return { roleIcon: 'wallet', roleColor: '#10b981' };
  }
  if (p.includes('secretary')) {
    return { roleIcon: 'document-text', roleColor: '#3b82f6' };
  }
  return { roleIcon: 'people', roleColor: '#6b7280' };
}

/** True when the value is a new pick from camera/gallery (needs upload), not a Convex storage id. */
export function isLocalImageUri(source: string | null | undefined): boolean {
  if (!source) return false;
  if (
    source.startsWith('file://') ||
    source.startsWith('data:') ||
    source.startsWith('blob:')
  ) {
    return true;
  }
  // Local path heuristic (Convex storage ids are short ids without slashes)
  return source.includes('/') && !source.startsWith('http');
}
