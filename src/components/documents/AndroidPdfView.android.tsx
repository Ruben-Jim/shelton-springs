import React from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

const ACCENT = '#2563eb';

/**
 * Android inline PDF via react-native-pdf (PDFium): fast scroll and pinch zoom. Kept in an
 * .android file so the website and iOS bundles never include the native PDF package.
 */
export default function AndroidPdfView({ url, onError }: { url: string; onError: () => void }) {
  // Required on first render, not at app start, like before the platform split
  const Pdf = require('react-native-pdf').default as typeof import('react-native-pdf').default;
  return (
    <Pdf
      source={{ uri: url, cache: true }}
      style={styles.pdf}
      trustAllCerts={false}
      renderActivityIndicator={() => <ActivityIndicator color={ACCENT} />}
      onError={onError}
    />
  );
}

const styles = StyleSheet.create({
  pdf: {
    flex: 1,
    width: '100%',
    backgroundColor: '#f3f4f6',
  },
});
