import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  TouchableOpacity,
  Pressable,
  Platform,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useStorageUrl } from '../../hooks/useStorageUrl';
import { openDocument } from '../../utils/openDocument';
import type { DocumentAttachment } from '../../utils/documentUpload';
import ZoomableImage from './ZoomableImage';
import IosFormSheet from '../ios/IosFormSheet';
import { canPreviewInline, getPageFileType, PAGE_FILE_LABELS } from './documentPages';

const ACCENT = '#2563eb';
/**
 * iOS presents like the in-app browser: the native page sheet Safari's in-app view uses (card
 * slides up, swipe down to dismiss). Android uses the shared bottom sheet; narrow web is full screen.
 */
const PRESENT_AS_PAGE_SHEET = Platform.OS === 'ios';
/** How long the sheet takes to slide in; heavy page views mount after it. */
const SHEET_PRESENT_MS = 340;
/** One system browser at a time (iOS refuses to present a second one). */
let browserOpen = false;

type DocumentPageBrowserProps = {
  visible: boolean;
  title: string;
  pages: DocumentAttachment[];
  initialIndex: number;
  onClose: () => void;
};

const openInSystemBrowser = async (url: string | undefined) => {
  if (!url) {
    Alert.alert('Please wait', 'Loading page…');
    return;
  }
  if (browserOpen) return;
  browserOpen = true;
  try {
    await openDocument(url);
  } catch {
    Alert.alert('Error', 'Unable to open this page. Please try again.');
  } finally {
    browserOpen = false;
  }
};

/** Web inline PDF: the browser's own viewer in an iframe. */
const WebFrame = ({ url, title }: { url: string; title: string }) =>
  React.createElement('iframe', {
    src: url,
    title,
    style: { border: 0, width: '100%', height: '100%', backgroundColor: '#ffffff' },
  });

/** iOS inline PDF/Word via WKWebView. Only required on iOS builds that include it. */
const NativeDocView = ({ url }: { url: string }) => {
  const { WebView } = require('react-native-webview') as typeof import('react-native-webview');
  return (
    <WebView
      source={{ uri: url }}
      style={styles.fill}
      startInLoadingState
      renderLoading={() => (
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} />
        </View>
      )}
    />
  );
};

/**
 * Pages the viewer can't draw (Word on Android/web, or PDFs before the native renderer is in
 * the build): a file view that opens the in-app browser / Chrome tab (new tab on web) on tap.
 */
const ExternalPage = ({ page }: { page: DocumentAttachment }) => {
  const type = getPageFileType(page);
  const url = useStorageUrl(page.storageId);
  const hint = !url ? 'Loading…' : Platform.OS === 'web' ? 'Click to open in a new tab' : 'Tap to open';

  return (
    <Pressable
      style={styles.center}
      onPress={() => openInSystemBrowser(url)}
      disabled={!url}
      accessibilityRole="button"
      accessibilityLabel={`Open ${page.name || PAGE_FILE_LABELS[type]}`}
    >
      <View style={[styles.fileIcon, type === 'word' && styles.fileIconWord]}>
        <Ionicons
          name={type === 'word' ? 'document' : 'document-text'}
          size={36}
          color={type === 'word' ? '#2563eb' : '#dc2626'}
        />
      </View>
      <Text style={styles.fileName} numberOfLines={2}>
        {page.name || PAGE_FILE_LABELS[type]}
      </Text>
      <View style={styles.hintRow}>
        {url ? <Ionicons name="open-outline" size={14} color={ACCENT} /> : null}
        <Text style={[styles.hint, url && styles.hintAction]}>{hint}</Text>
      </View>
    </Pressable>
  );
};

/** Android inline PDF via react-native-pdf (PDFium): fast scroll and pinch zoom. */
const AndroidPdfView = ({ page, url }: { page: DocumentAttachment; url: string }) => {
  const Pdf = require('react-native-pdf').default as typeof import('react-native-pdf').default;
  const [failed, setFailed] = useState(false);
  // If the renderer can't open this file, fall back to the Chrome tab
  if (failed) return <ExternalPage page={page} />;
  return (
    <Pdf
      source={{ uri: url, cache: true }}
      style={styles.pdf}
      trustAllCerts={false}
      renderActivityIndicator={() => <ActivityIndicator color={ACCENT} />}
      onError={() => setFailed(true)}
    />
  );
};

const InlineDocPage = ({ page, title }: { page: DocumentAttachment; title: string }) => {
  const url = useStorageUrl(page.storageId);
  if (!url) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }
  if (Platform.OS === 'web') return <WebFrame url={url} title={title} />;
  if (Platform.OS === 'android') return <AndroidPdfView page={page} url={url} />;
  return <NativeDocView url={url} />;
};

const BrowserPage = ({
  page,
  isCurrent,
  presented,
  title,
  onZoomChange,
}: {
  page: DocumentAttachment;
  isCurrent: boolean;
  /** False while the sheet is still sliding in */
  presented: boolean;
  title: string;
  onZoomChange: (zoomed: boolean) => void;
}) => {
  if (page.kind === 'image') {
    return <ZoomableImage storageId={page.storageId} onZoomChange={onZoomChange} active={isCurrent} />;
  }
  // Documents mount only while current (one webview / PDF view at a time), and only after the
  // sheet finishes sliding in so the native view's first render doesn't stutter the animation
  if (!isCurrent) return <View style={styles.fill} />;
  if (!presented) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }
  return canPreviewInline(page) ? <InlineDocPage page={page} title={title} /> : <ExternalPage page={page} />;
};

/**
 * Phone (and narrow web) document viewer that looks and presents like the in-app browser
 * (iOS page sheet, Done, title and page count on top); swipe or the toolbar arrows to move
 * between pages without closing.
 */
export default function DocumentPageBrowser({ visible, title, pages, initialIndex, onClose }: DocumentPageBrowserProps) {
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<DocumentAttachment>>(null);
  const [index, setIndex] = useState(initialIndex);
  const [zoomed, setZoomed] = useState(false);
  const [presented, setPresented] = useState(false);
  const current = pages[index];
  const currentUrl = useStorageUrl(visible ? current?.storageId : null);

  useEffect(() => {
    if (visible) {
      setIndex(Math.min(initialIndex, Math.max(0, pages.length - 1)));
      setZoomed(false);
    }
  }, [visible, initialIndex, pages.length]);

  // Matches the sheet's present animation (IosFormSheet 320ms; iOS page sheet is similar)
  useEffect(() => {
    if (!visible) {
      setPresented(false);
      return;
    }
    const timer = setTimeout(() => setPresented(true), SHEET_PRESENT_MS);
    return () => clearTimeout(timer);
  }, [visible]);

  const goTo = (next: number) => {
    const clamped = Math.max(0, Math.min(pages.length - 1, next));
    listRef.current?.scrollToOffset({ offset: clamped * width, animated: true });
    setIndex(clamped);
    setZoomed(false);
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.max(0, Math.min(pages.length - 1, Math.round(e.nativeEvent.contentOffset.x / width)));
    if (next !== index) {
      setIndex(next);
      setZoomed(false);
    }
  };

  const isFirst = index === 0;
  const isLast = index === pages.length - 1;
  const multiPage = pages.length > 1;
  // Single files (CC&Rs, covenant attachments) show their type instead of "Page 1 of 1"
  const pageLabel = multiPage
    ? `Page ${index + 1} of ${pages.length}`
    : current
      ? PAGE_FILE_LABELS[getPageFileType(current)]
      : '';
  const pageName = current
    ? current.kind === 'image'
      ? 'Photo'
      : current.name || PAGE_FILE_LABELS[getPageFileType(current)]
    : '';

  const body = (
    <>
      <FlatList
        ref={listRef}
        data={pages}
        keyExtractor={(page, i) => `${page.storageId}-${i}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={Math.min(initialIndex, Math.max(0, pages.length - 1))}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={onScrollEnd}
        // Swiping pauses while a photo is zoomed so panning moves the photo
        scrollEnabled={!zoomed && pages.length > 1}
        // Re-render when the current page changes (documents mount only when current)
        extraData={index}
        renderItem={({ item, index: i }) => (
          <View style={{ width, flex: 1 }}>
            <BrowserPage
              page={item}
              isCurrent={i === index}
              presented={presented}
              title={title}
              onZoomChange={setZoomed}
            />
          </View>
        )}
        style={styles.stage}
      />

      {multiPage ? (
      <View style={styles.toolbar}>
        <TouchableOpacity
          onPress={() => goTo(index - 1)}
          disabled={isFirst}
          style={styles.toolButton}
          accessibilityLabel="Previous page"
        >
          <Ionicons name="chevron-back" size={26} color={isFirst ? '#c7c7cc' : ACCENT} />
        </TouchableOpacity>
        <Text style={styles.toolCount}>
          {index + 1} / {pages.length}
        </Text>
        <TouchableOpacity
          onPress={() => goTo(index + 1)}
          disabled={isLast}
          style={styles.toolButton}
          accessibilityLabel="Next page"
        >
          <Ionicons name="chevron-forward" size={26} color={isLast ? '#c7c7cc' : ACCENT} />
        </TouchableOpacity>
      </View>
      ) : null}
    </>
  );

  const openButton = (
    <TouchableOpacity
      onPress={() => openInSystemBrowser(currentUrl)}
      style={styles.iconButton}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={Platform.OS === 'android' ? 'Download' : 'Open in browser'}
    >
      {/* Android hands the file to Chrome, which downloads it, so show a download icon there */}
      <Ionicons
        name={Platform.OS === 'android' ? 'download-outline' : 'open-outline'}
        size={20}
        color={ACCENT}
      />
    </TouchableOpacity>
  );

  // Android: the shared bottom sheet (drag the grabber to resize or close; Back closes) with a
  // Material-style header. The sheet pads the bottom safe area itself.
  if (Platform.OS === 'android') {
    return (
      <IosFormSheet
        visible={visible}
        onClose={onClose}
        defaultHeightPercent={0.94}
        maxHeightPercent={0.94}
        minHeightPercent={0.5}
        keyboardAware={false}
      >
        <View style={styles.materialHeader}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.materialClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={24} color="#1f2937" />
          </TouchableOpacity>
          <View style={styles.materialText}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.materialSubtitle} numberOfLines={1} ellipsizeMode="middle">
              {pageLabel}
              {multiPage && pageName ? ` · ${pageName}` : ''}
            </Text>
          </View>
          {openButton}
        </View>
        {body}
      </IosFormSheet>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={PRESENT_AS_PAGE_SHEET ? 'pageSheet' : 'fullScreen'}
      // Also fires when the iOS page sheet is swiped down
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.root}>
        {/* The page sheet already sits below the status bar, so only pad the bottom there */}
        <SafeAreaView style={styles.root} edges={PRESENT_AS_PAGE_SHEET ? ['bottom'] : ['top', 'bottom']}>
          <View style={styles.header}>
            {/* Grabber hints the page sheet can be swiped down to dismiss */}
            {PRESENT_AS_PAGE_SHEET ? <View style={styles.grabber} /> : null}
            <View style={styles.topBar}>
              {/* Equal-width side slots keep the title truly centered */}
              <View style={styles.topSide}>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.sideButton}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Done"
                >
                  <Text style={styles.doneText}>Done</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.topCenter}>
                <Text style={styles.title} numberOfLines={1}>
                  {title}
                </Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                  {pageLabel}
                </Text>
                {multiPage && pageName ? (
                  <Text style={styles.pageName} numberOfLines={1} ellipsizeMode="middle">
                    {pageName}
                  </Text>
                ) : null}
              </View>
              <View style={[styles.topSide, styles.topSideRight]}>{openButton}</View>
            </View>
          </View>
          {body}
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  fill: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d1d5db',
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#d1d5db',
    marginTop: 6,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: 12,
    paddingTop: PRESENT_AS_PAGE_SHEET ? 4 : 8,
    paddingBottom: 10,
  },
  topSide: {
    width: 72,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  topSideRight: {
    alignItems: 'flex-end',
  },
  sideButton: {
    minHeight: 44,
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
  },
  doneText: {
    color: ACCENT,
    fontSize: 17,
    fontWeight: '600',
  },
  topCenter: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4b5563',
    marginTop: 2,
  },
  materialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d1d5db',
  },
  materialClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  materialText: {
    flex: 1,
    minWidth: 0,
  },
  materialSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  pageName: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 1,
    maxWidth: '100%',
  },
  stage: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#d1d5db',
    backgroundColor: '#f9fafb',
  },
  toolButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4b5563',
  },
  fileIcon: {
    width: 72,
    height: 72,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    marginBottom: 14,
  },
  fileIconWord: {
    backgroundColor: '#eff6ff',
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  hint: {
    fontSize: 14,
    color: '#6b7280',
  },
  hintAction: {
    color: ACCENT,
    fontWeight: '600',
  },
  pdf: {
    flex: 1,
    width: '100%',
    backgroundColor: '#f3f4f6',
  },
});
