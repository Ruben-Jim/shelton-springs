import { Platform } from 'react-native';

/** Fire-and-forget haptic feedback; no-ops when expo-haptics isn't in the native build. */
export async function triggerLightImpact(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    const Haptics = require('expo-haptics') as typeof import('expo-haptics');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // expo-haptics not linked in this dev client build
  }
}
