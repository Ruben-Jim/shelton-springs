import { Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import enhancedUnifiedNotificationManager from '../services/EnhancedUnifiedNotificationManager';

export type NotificationAccessResult = {
  granted: boolean;
  token: string | null;
  needsSettings: boolean;
};

const AUTO_PROMPT_KEY = 'notification_auto_prompted';

/**
 * Ask the OS for notification permission from a user tap.
 * If the system dialog can still be shown, it is shown.
 * If the user already denied, needsSettings is true so the UI can send them to Settings.
 */
export async function promptForNotificationAccess(): Promise<NotificationAccessResult> {
  if (Platform.OS === 'web') {
    const granted = await enhancedUnifiedNotificationManager.requestPermissions();
    return { granted, token: null, needsSettings: !granted };
  }

  await enhancedUnifiedNotificationManager.initialize();
  const permissions = await Notifications.getPermissionsAsync();

  if (permissions.status === 'granted') {
    const granted = await enhancedUnifiedNotificationManager.requestPermissions();
    return {
      granted,
      token: enhancedUnifiedNotificationManager.getPushToken(),
      needsSettings: false,
    };
  }

  if (permissions.status === 'undetermined' || permissions.canAskAgain) {
    const granted = await enhancedUnifiedNotificationManager.requestPermissions();
    return {
      granted,
      token: enhancedUnifiedNotificationManager.getPushToken(),
      needsSettings: false,
    };
  }

  return { granted: false, token: null, needsSettings: true };
}

/**
 * Show the native Allow/Don't Allow dialog after sign-in if this device
 * has not already been auto-prompted. Does not open Settings.
 */
export async function askForNotificationPermissionIfNeeded(): Promise<NotificationAccessResult> {
  if (Platform.OS === 'web') {
    return { granted: false, token: null, needsSettings: false };
  }

  await enhancedUnifiedNotificationManager.initialize();
  const permissions = await Notifications.getPermissionsAsync();

  if (permissions.status === 'granted') {
    await enhancedUnifiedNotificationManager.requestPermissions();
    return {
      granted: true,
      token: enhancedUnifiedNotificationManager.getPushToken(),
      needsSettings: false,
    };
  }

  const alreadyAsked = await AsyncStorage.getItem(AUTO_PROMPT_KEY);
  if (alreadyAsked === '1') {
    return {
      granted: false,
      token: null,
      needsSettings: permissions.status === 'denied',
    };
  }

  await AsyncStorage.setItem(AUTO_PROMPT_KEY, '1');

  if (permissions.status === 'denied' && permissions.canAskAgain === false) {
    return { granted: false, token: null, needsSettings: true };
  }

  const granted = await enhancedUnifiedNotificationManager.requestPermissions();
  return {
    granted,
    token: enhancedUnifiedNotificationManager.getPushToken(),
    needsSettings: false,
  };
}

export async function openNotificationSettings(): Promise<void> {
  await Linking.openSettings();
}
