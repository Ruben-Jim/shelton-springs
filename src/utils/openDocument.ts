import { Platform, Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

/**
 * Open a document (PDF, image, Word file) without leaving the app.
 * - iOS: slides up an in-app Safari sheet (renders the file natively, Done to close).
 * - Android: opens a Chrome Custom Tab over the app; Chrome may hand PDFs to
 *   the device's PDF viewer instead of rendering them.
 * - Web: opens the file in a new browser tab.
 */
export async function openDocument(url: string): Promise<void> {
  if (Platform.OS === 'web') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  try {
    await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      dismissButtonStyle: 'done',
      controlsColor: '#2563eb',
      toolbarColor: '#ffffff',
      enableBarCollapsing: true,
    });
  } catch {
    // Fall back to the system handler if the in-app browser is unavailable
    await Linking.openURL(url);
  }
}
