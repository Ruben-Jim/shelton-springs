import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import OptimizedImage from '../OptimizedImage';
import type { DocumentAttachment } from '../../utils/documentUpload';
import { getPageFileType } from './documentPages';

const FILE_TILE = {
  pdf: { icon: 'document-text', color: '#dc2626', bg: '#fef2f2', label: 'PDF' },
  word: { icon: 'document', color: '#2563eb', bg: '#eff6ff', label: 'DOC' },
  other: { icon: 'document-attach', color: '#6b7280', bg: '#f3f4f6', label: 'FILE' },
} as const;

type DocumentPageThumbProps = {
  page: DocumentAttachment;
  /** 1-based page number shown in the corner */
  pageNumber?: number;
  width: number;
  height: number;
  active?: boolean;
  /** Dark surfaces (viewer) vs light cards (document list) */
  tone?: 'light' | 'dark';
  onPress?: () => void;
};

/** Small preview of one document page: the photo itself, or a typed file tile for PDF/Word pages. */
const DocumentPageThumb = ({
  page,
  pageNumber,
  width,
  height,
  active = false,
  tone = 'light',
  onPress,
}: DocumentPageThumbProps) => {
  const type = getPageFileType(page);
  const tile = type === 'image' ? null : FILE_TILE[type];

  const content = (
    <View
      style={[
        styles.thumb,
        { width, height },
        tone === 'dark' ? styles.thumbDark : styles.thumbLight,
        active && styles.thumbActive,
      ]}
    >
      {tile ? (
        <View style={[styles.fileTile, { backgroundColor: tile.bg }]}>
          <Ionicons name={tile.icon} size={Math.min(width, height) * 0.36} color={tile.color} />
          <Text style={[styles.fileLabel, { color: tile.color }]}>{tile.label}</Text>
        </View>
      ) : (
        <OptimizedImage storageId={page.storageId} style={styles.image} contentFit="cover" />
      )}
      {pageNumber != null ? (
        <View style={styles.pageNumber}>
          <Text style={styles.pageNumberText}>{pageNumber}</Text>
        </View>
      ) : null}
    </View>
  );

  if (!onPress) return content;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={pageNumber != null ? `Page ${pageNumber}` : 'Open page'}
      style={Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : undefined}
    >
      {content}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  thumb: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
  },
  thumbLight: {
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  thumbDark: {
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#1f2937',
  },
  thumbActive: {
    borderColor: '#3b82f6',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fileTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  fileLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  pageNumber: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    minWidth: 18,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 9,
    backgroundColor: 'rgba(17,24,39,0.75)',
    alignItems: 'center',
  },
  pageNumberText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
});

export default DocumentPageThumb;
