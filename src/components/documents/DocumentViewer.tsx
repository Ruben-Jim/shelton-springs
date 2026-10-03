import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Platform,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import OptimizedImage from '../OptimizedImage';
import { IOS_FORM_THEME as theme } from '../ios/iosFormTheme';
import { useStorageUrl } from '../../hooks/useStorageUrl';
import { openDocument } from '../../utils/openDocument';
import type { DocumentAttachment } from '../../utils/documentUpload';
import DocumentPageThumb from './DocumentPageThumb';
import DocumentPageBrowser from './DocumentPageBrowser';
import { canPreviewInline, getPageFileType, PAGE_FILE_LABELS } from './documentPages';

const DESKTOP_MIN_WIDTH = 1024;
const RAIL_THUMB = { width: 96, height: 124 };

type DocumentViewerProps = {
  visible: boolean;
  title: string;
  /** Ordered pages; a single-file document is one page */
  pages: DocumentAttachment[];
  initialIndex?: number;
  onClose: () => void;
};

const openPageExternally = (url: string | undefined) => {
  if (!url) {
    Alert.alert('Please wait', 'Loading page…');
    return;
  }
  openDocument(url).catch(() => Alert.alert('Error', 'Unable to open this page. Please try again.'));
};

/** Web-only inline PDF: the browser's own PDF viewer in an iframe. */
const WebPdfFrame = ({ url, title }: { url: string; title: string }) =>
  React.createElement('iframe', {
    src: url,
    title,
    style: { border: 0, width: '100%', height: '100%', backgroundColor: '#ffffff' },
  });

/**
 * Desktop pages that can't render inline (Word): click opens a new tab. Browsers block tabs
 * opened without a click, so this can't open on its own.
 */
const ExternalFilePage = ({ page, url }: { page: DocumentAttachment; url: string | undefined }) => {
  const type = getPageFileType(page);
  return (
    <Pressable
      style={[styles.centerFill, Platform.OS === 'web' && ({ cursor: 'pointer' } as any)]}
      onPress={() => openPageExternally(url)}
      disabled={!url}
      accessibilityRole="button"
      accessibilityLabel={`Open ${page.name || PAGE_FILE_LABELS[type]}`}
    >
      <FileIcon type={type} size={36} />
      <Text style={styles.fileName} numberOfLines={2}>
        {page.name || PAGE_FILE_LABELS[type]}
      </Text>
      <Text style={styles.fileHint}>{url ? 'Click to open in a new tab' : 'Loading…'}</Text>
    </Pressable>
  );
};

const FileIcon = ({ type, size }: { type: ReturnType<typeof getPageFileType>; size: number }) => (
  <View
    style={[
      styles.fileIconWrap,
      { width: size * 2, height: size * 2, borderRadius: size / 2 },
      type === 'word' && styles.fileIconWrapWord,
    ]}
  >
    <Ionicons
      name={type === 'word' ? 'document' : 'document-text'}
      size={size}
      color={type === 'word' ? '#2563eb' : '#dc2626'}
    />
  </View>
);

/** One page in the stage. Inline PDFs only mount for the current page to keep it light. */
const ViewerPage = ({
  page,
  isCurrent,
  title,
}: {
  page: DocumentAttachment;
  isCurrent: boolean;
  title: string;
}) => {
  const type = getPageFileType(page);
  const url = useStorageUrl(type === 'image' || !isCurrent ? null : page.storageId);
  const [imageLoaded, setImageLoaded] = useState(false);

  if (type === 'image') {
    return (
      <View style={styles.fill}>
        {!imageLoaded && (
          <View style={styles.centerFill}>
            <ActivityIndicator color={theme.accent} />
          </View>
        )}
        <OptimizedImage
          storageId={page.storageId}
          style={styles.fill}
          contentFit="contain"
          onLoad={() => setImageLoaded(true)}
        />
      </View>
    );
  }

  if (!isCurrent) return <View style={styles.fill} />;

  if (canPreviewInline(page)) {
    if (!url) {
      return (
        <View style={styles.centerFill}>
          <ActivityIndicator color={theme.accent} />
        </View>
      );
    }
    return <WebPdfFrame url={url} title={title} />;
  }

  return <ExternalFilePage page={page} url={url} />;
};

/**
 * In-app viewer for Minutes/Financial documents, single-file or multi-page.
 * Desktop web: centered panel with a page rail; photos and PDFs inline, Word click-to-open.
 * Phones and narrow web: DocumentPageBrowser, a full-screen browser-style pager.
 */
const DocumentViewer = ({
  visible,
  title,
  pages,
  initialIndex = 0,
  onClose,
}: DocumentViewerProps) => {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= DESKTOP_MIN_WIDTH;
  const [index, setIndex] = useState(initialIndex);
  const current = pages[index];
  const multiPage = pages.length > 1;
  // Header "open" action: full-size photo or the file in the in-app browser / new tab
  const currentUrl = useStorageUrl(visible ? current?.storageId : null);

  useEffect(() => {
    if (visible) setIndex(Math.min(initialIndex, Math.max(0, pages.length - 1)));
  }, [visible, initialIndex, pages.length]);

  const goTo = useCallback(
    (next: number) => setIndex(Math.max(0, Math.min(pages.length - 1, next))),
    [pages.length]
  );

  // Desktop keyboard: arrows move between pages, Escape closes
  useEffect(() => {
    if (!visible || !isDesktop || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goTo(index + 1);
      else if (e.key === 'ArrowLeft') goTo(index - 1);
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, isDesktop, index, goTo, onClose]);

  const subtitle = multiPage
    ? `Page ${index + 1} of ${pages.length}`
    : current
      ? PAGE_FILE_LABELS[getPageFileType(current)]
      : '';

  if (isDesktop) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.desktopOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
          <View style={styles.desktopPanel}>
            <View style={styles.desktopHeader}>
              <View style={styles.headerTextWrap}>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {title}
                </Text>
                <Text style={styles.headerSubtitle}>{subtitle}</Text>
              </View>
              <TouchableOpacity
                style={styles.desktopOpenButton}
                onPress={() => openPageExternally(currentUrl)}
              >
                <Ionicons name="open-outline" size={16} color={theme.accent} />
                <Text style={styles.desktopOpenText}>Open in new tab</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={onClose} accessibilityLabel="Close">
                <Ionicons name="close" size={22} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.desktopBody}>
              {multiPage ? (
                <ScrollView style={styles.rail} contentContainerStyle={styles.railContent}>
                  {pages.map((page, i) => (
                    <DocumentPageThumb
                      key={`${page.storageId}-${i}`}
                      page={page}
                      pageNumber={i + 1}
                      width={RAIL_THUMB.width}
                      height={RAIL_THUMB.height}
                      active={i === index}
                      onPress={() => goTo(i)}
                    />
                  ))}
                </ScrollView>
              ) : null}

              <View style={styles.stage}>
                {current ? (
                  <ViewerPage key={`${current.storageId}-${index}`} page={current} isCurrent title={title} />
                ) : null}
                {multiPage ? (
                  <>
                    <StageArrow side="left" disabled={index === 0} onPress={() => goTo(index - 1)} />
                    <StageArrow
                      side="right"
                      disabled={index === pages.length - 1}
                      onPress={() => goTo(index + 1)}
                    />
                  </>
                ) : null}
              </View>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // Phones and narrow web: full-screen, browser-style pager (swipe between pages)
  return (
    <DocumentPageBrowser
      visible={visible}
      title={title}
      pages={pages}
      initialIndex={initialIndex}
      onClose={onClose}
    />
  );
};

const StageArrow = ({
  side,
  disabled,
  onPress,
}: {
  side: 'left' | 'right';
  disabled: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    style={[styles.stageArrow, side === 'left' ? styles.stageArrowLeft : styles.stageArrowRight, disabled && styles.stageArrowDisabled]}
    accessibilityLabel={side === 'left' ? 'Previous page' : 'Next page'}
  >
    <Ionicons name={side === 'left' ? 'chevron-back' : 'chevron-forward'} size={22} color={theme.textPrimary} />
  </TouchableOpacity>
);

const shadow = Platform.select({
  web: { boxShadow: '0 24px 64px rgba(15,23,42,0.28)' } as any,
  default: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
});

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  centerFill: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  headerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 2,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.groupedBackground,
  },
  // Desktop
  desktopOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  desktopPanel: {
    width: '100%',
    maxWidth: 1240,
    height: '100%',
    maxHeight: 920,
    backgroundColor: theme.card,
    borderRadius: 16,
    overflow: 'hidden',
    ...shadow,
  },
  desktopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  desktopOpenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
  },
  desktopOpenText: {
    color: theme.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  desktopBody: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 0,
  },
  rail: {
    flexGrow: 0,
    width: RAIL_THUMB.width + 32,
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  railContent: {
    padding: 16,
    gap: 12,
    alignItems: 'center',
  },
  stage: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    position: 'relative',
  },
  stageArrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    ...Platform.select({
      web: { boxShadow: '0 4px 14px rgba(15,23,42,0.18)', cursor: 'pointer' } as any,
      default: {},
    }),
  },
  stageArrowLeft: {
    left: 16,
  },
  stageArrowRight: {
    right: 16,
  },
  stageArrowDisabled: {
    opacity: 0.35,
  },
  // External file page
  fileIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    marginBottom: 14,
  },
  fileIconWrapWord: {
    backgroundColor: '#eff6ff',
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
    textAlign: 'center',
  },
  fileHint: {
    fontSize: 14,
    color: theme.textSecondary,
  },
});

export default DocumentViewer;
