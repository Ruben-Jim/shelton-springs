import { Platform } from 'react-native';
import { PROFILE_SETTINGS_THEME } from '../profile/profileSettingsTheme';

export const IOS_FORM_THEME = {
  ...PROFILE_SETTINGS_THEME,
  groupedBackground: Platform.OS === 'ios' ? '#F2F2F7' : PROFILE_SETTINGS_THEME.groupedBackground,
} as const;
