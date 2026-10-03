import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DocumentViewer from './DocumentViewer';
import { canPreviewInline, DocumentLike, getDocumentPages } from './documentPages';
import { useStorageUrl } from '../../hooks/useStorageUrl';
import { openDocument } from '../../utils/openDocument';

export { getDocumentPages } from './documentPages';

type DocumentViewParts = {
  /** "N documents" pill for multi-page documents (null otherwise) */
  pagesBadge: React.ReactNode;
  /** View button */
  viewButton: React.ReactNode;
};

const openUrl = (url: string | undefined) => {
  if (!url) {
    Alert.alert('Please wait', 'Loading document…');
    return;
  }
  openDocument(url).catch(() => Alert.alert('Error', 'Unable to open this document. Please try again.'));
};

/**
 * View behavior for a Minutes/Financial document card, as render-prop parts.
 * - Single page on phones (or one web can't show inline): View opens the in-app browser.
 * - Multi-page: View opens the viewer on page 1 (in-app-browser-style page sheet on phones,
 *   page rail on desktop), where you swipe or page through the rest.
 */
export function DocumentView({
  document,
  children,
}: {
  document: DocumentLike;
  children: (parts: DocumentViewParts) => React.ReactNode;
}) {
  const pages = getDocumentPages(document);
  const multiPage = pages.length > 1;
  const opensDirectly = !multiPage && (Platform.OS !== 'web' || !canPreviewInline(pages[0]));
  const directUrl = useStorageUrl(opensDirectly ? pages[0].storageId : null);
  const [viewerOpen, setViewerOpen] = useState(false);

  const handleView = () => {
    if (opensDirectly) openUrl(directUrl);
    else setViewerOpen(true);
  };

  const viewButton = (
    <>
      <TouchableOpacity style={styles.viewButton} onPress={handleView}>
        <Ionicons name="eye" size={16} color="#2563eb" />
        <Text style={styles.viewButtonText}>View</Text>
      </TouchableOpacity>
      <DocumentViewer
        visible={viewerOpen}
        title={document.title}
        pages={pages}
        onClose={() => setViewerOpen(false)}
      />
    </>
  );

  const pagesBadge = multiPage ? (
    <View style={styles.badge}>
      <Ionicons name="documents-outline" size={12} color="#047857" />
      <Text style={styles.badgeText}>{pages.length} documents</Text>
    </View>
  ) : null;

  return <>{children({ pagesBadge, viewButton })}</>;
}

const styles = StyleSheet.create({
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  viewButtonText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '600',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: '#ecfdf5',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#047857',
  },
});
