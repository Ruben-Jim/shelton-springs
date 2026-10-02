import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  TouchableOpacity,
  useWindowDimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import OptimizedImage from '../OptimizedImage';
import LoadingState from '../LoadingState';
import { useStorageUrl } from '../../hooks/useStorageUrl';
import { openDocument } from '../../utils/openDocument';

interface DocumentGalleryModalProps {
  visible: boolean;
  title: string;
  /** Ordered photo pages */
  storageIds: string[];
  onClose: () => void;
}

const GalleryPage = ({ storageId, width }: { storageId: string; width: number }) => {
  const [loaded, setLoaded] = useState(false);
  return (
    <View style={[styles.page, { width }]}>
      {!loaded && (
        <View style={styles.pageLoading}>
          <LoadingState message="Loading page…" />
        </View>
      )}
      <OptimizedImage
        storageId={storageId}
        style={styles.pageImage}
        contentFit="contain"
        onLoad={() => setLoaded(true)}
      />
    </View>
  );
};

/** Full-screen, swipeable viewer for documents made of several photos (e.g. statement page 1 & 2). */
const DocumentGalleryModal = ({ visible, title, storageIds, onClose }: DocumentGalleryModalProps) => {
  const { width } = useWindowDimensions();
  const [pageIndex, setPageIndex] = useState(0);
  const listRef = useRef<FlatList<string>>(null);
  const currentUrl = useStorageUrl(visible ? storageIds[pageIndex] : null);

  useEffect(() => {
    if (visible) setPageIndex(0);
  }, [visible]);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    setPageIndex(Math.max(0, Math.min(storageIds.length - 1, index)));
  };

  const goTo = (index: number) => {
    listRef.current?.scrollToIndex({ index, animated: true });
    setPageIndex(index);
  };

  const openFullSize = () => {
    if (!currentUrl) {
      Alert.alert('Please wait', 'Loading page…');
      return;
    }
    openDocument(currentUrl).catch(() =>
      Alert.alert('Error', 'Unable to open this page. Please try again.')
    );
  };

  const isFirst = pageIndex === 0;
  const isLast = pageIndex === storageIds.length - 1;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton} accessibilityLabel="Close">
            <Ionicons name="close" size={26} color="#ffffff" />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.headerSubtitle}>
              Page {pageIndex + 1} of {storageIds.length}
            </Text>
          </View>
          <TouchableOpacity
            onPress={openFullSize}
            style={styles.headerButton}
            accessibilityLabel="Open full size"
          >
            <Ionicons name="expand" size={22} color="#ffffff" />
          </TouchableOpacity>
        </View>

        <FlatList
          ref={listRef}
          data={storageIds}
          keyExtractor={(id, i) => `${id}-${i}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          renderItem={({ item }) => <GalleryPage storageId={item} width={width} />}
          style={styles.list}
        />

        <View style={styles.footer}>
          <TouchableOpacity
            onPress={() => goTo(pageIndex - 1)}
            disabled={isFirst}
            style={[styles.navButton, isFirst && styles.navButtonDisabled]}
            accessibilityLabel="Previous page"
          >
            <Ionicons name="chevron-back" size={22} color="#ffffff" />
          </TouchableOpacity>
          <View style={styles.dots}>
            {storageIds.map((id, i) => (
              <View key={`${id}-${i}`} style={[styles.dot, i === pageIndex && styles.dotActive]} />
            ))}
          </View>
          <TouchableOpacity
            onPress={() => goTo(pageIndex + 1)}
            disabled={isLast}
            style={[styles.navButton, isLast && styles.navButtonDisabled]}
            accessibilityLabel="Next page"
          >
            <Ionicons name="chevron-forward" size={22} color="#ffffff" />
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>Tap ⤢ to open full size and zoom</Text>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerSubtitle: {
    color: '#9ca3af',
    fontSize: 13,
    marginTop: 2,
  },
  list: {
    flex: 1,
  },
  page: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  pageLoading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageImage: {
    width: '100%',
    height: '100%',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    backgroundColor: '#22c55e',
    width: 20,
  },
  hint: {
    color: '#6b7280',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 10,
  },
});

export default DocumentGalleryModal;
