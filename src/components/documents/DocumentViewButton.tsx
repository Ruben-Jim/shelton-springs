import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStorageUrl } from '../../hooks/useStorageUrl';
import { openDocument } from '../../utils/openDocument';
import DocumentGalleryModal from './DocumentGalleryModal';

interface DocumentLike {
  title: string;
  fileStorageId: string;
  imageStorageIds?: string[];
}

/** Photo pages for multi-photo documents, or an empty list for single-file documents. */
export const getDocumentPages = (document: DocumentLike): string[] =>
  document.imageStorageIds && document.imageStorageIds.length > 1 ? document.imageStorageIds : [];

/** "View" for a Minutes/Financial document: swipeable gallery for multi-photo docs, in-app browser otherwise. */
const DocumentViewButton = ({ document }: { document: DocumentLike }) => {
  const pages = getDocumentPages(document);
  const fileUrl = useStorageUrl(pages.length ? null : document.fileStorageId);
  const [galleryOpen, setGalleryOpen] = useState(false);

  if (pages.length) {
    return (
      <>
        <TouchableOpacity style={styles.viewButton} onPress={() => setGalleryOpen(true)}>
          <Ionicons name="images" size={16} color="#2563eb" />
          <Text style={styles.viewButtonText}>View</Text>
        </TouchableOpacity>
        <DocumentGalleryModal
          visible={galleryOpen}
          title={document.title}
          storageIds={pages}
          onClose={() => setGalleryOpen(false)}
        />
      </>
    );
  }

  if (fileUrl === undefined) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#2563eb" />
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.viewButton}
      onPress={() => {
        if (fileUrl) {
          openDocument(fileUrl);
        } else {
          Alert.alert('Error', 'Document URL not available.');
        }
      }}
    >
      <Ionicons name="eye" size={16} color="#2563eb" />
      <Text style={styles.viewButtonText}>View</Text>
    </TouchableOpacity>
  );
};

/** Small "2 pages" pill shown on multi-photo document cards. */
export const PageCountBadge = ({ document }: { document: DocumentLike }) => {
  const count = getDocumentPages(document).length;
  if (!count) return null;
  return (
    <View style={styles.badge}>
      <Ionicons name="images-outline" size={12} color="#047857" />
      <Text style={styles.badgeText}>{count} pages</Text>
    </View>
  );
};

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
  loadingContainer: {
    padding: 8,
    alignItems: 'center',
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

export default DocumentViewButton;
