import { Platform, TurboModuleRegistry, UIManager } from 'react-native';

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

/**
 * True when the iOS build includes react-native-webview. WKWebView renders PDF and Word files
 * natively; until the dev client is rebuilt with it, those pages open in the in-app browser.
 */
export const canUseWebViewDocs =
  Platform.OS === 'ios' && hasFabricComponent('RNCWebView', 'RNCWebViewModule');

/**
 * True when the Android build includes react-native-pdf (PDFium renderer). Until the dev client
 * is rebuilt with it, PDF pages open in a Chrome tab instead.
 */
export const canUseNativePdf = Platform.OS === 'android' && hasFabricComponent('RNPDFPdfView');

/**
 * New Architecture (Fabric) components aren't visible to the legacy config lookup; ask the
 * component registry, then the library's native module (if it has one) as a second signal.
 */
function hasFabricComponent(componentName: string, moduleName?: string): boolean {
  try {
    const ui = UIManager as typeof UIManager & { hasViewManagerConfig?: (n: string) => boolean };
    if (ui.hasViewManagerConfig?.(componentName)) return true;
    return moduleName ? TurboModuleRegistry.get(moduleName) != null : false;
  } catch {
    return false;
  }
}
