import { Platform, UIManager } from 'react-native';

function hasNativeViewManager(name: string): boolean {
  if (Platform.OS === 'web') return false;
  try {
    return UIManager.getViewManagerConfig?.(name) != null;
  } catch {
    return false;
  }
}

/** True when the current dev/production build includes expo-blur native code. */
export const canUseBlurView =
  Platform.OS === 'ios' && hasNativeViewManager('ExpoBlurView');

/** True when the current dev/production build includes expo-symbols native code. */
export const canUseSymbolView =
  Platform.OS === 'ios' && hasNativeViewManager('SymbolModule');
