import { Platform } from 'react-native';

/** Shelton Springs brand + iOS grouped-settings palette (Apple HIG). */
export const PROFILE_SETTINGS_THEME = {
  brand: '#0B1A12',
  accent: '#2563eb',
  accentGreen: '#059669',
  groupedBackground: Platform.OS === 'ios' ? '#F2F2F7' : '#f8fafc',
  card: '#FFFFFF',
  separator: Platform.OS === 'ios' ? 'rgba(60, 60, 67, 0.29)' : '#e5e7eb',
  textPrimary: '#1f2937',
  textSecondary: '#6b7280',
  textTertiary: '#9ca3af',
  destructive: '#dc2626',
  grabber: '#C6C6C8',
  sheetRadius: Platform.OS === 'ios' ? 13 : 24,
} as const;

export const PROFILE_SECTION_FOOTER =
  'Allow notifications on this device to receive community posts, polls, and important HOA updates.';
