import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
} from 'react-native';

const SHOW_THRESHOLD = 120;

type ScrollContainerRef = React.RefObject<ScrollView | FlatList<any> | null>;

type UseScrollToTopOptions = {
  resetKey?: string | number;
  threshold?: number;
};

export function useScrollToTop(
  scrollRef: ScrollContainerRef,
  options: UseScrollToTopOptions = {}
) {
  const { resetKey, threshold = SHOW_THRESHOLD } = options;
  const [showScrollToTop, setShowScrollToTop] = useState(false);

  useEffect(() => {
    setShowScrollToTop(false);

    if (resetKey === undefined) return;

    const target = scrollRef.current;
    if (!target) return;

    requestAnimationFrame(() => {
      if ('scrollTo' in target && typeof target.scrollTo === 'function') {
        target.scrollTo({ y: 0, animated: false });
        return;
      }

      if ('scrollToOffset' in target && typeof target.scrollToOffset === 'function') {
        target.scrollToOffset({ offset: 0, animated: false });
      }
    });
  }, [resetKey, scrollRef]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      const shouldShow = offsetY > threshold;
      setShowScrollToTop((previous) => (previous === shouldShow ? previous : shouldShow));
    },
    [threshold]
  );

  const scrollToTop = useCallback(() => {
    const target = scrollRef.current;
    if (!target) return;

    if ('scrollTo' in target && typeof target.scrollTo === 'function') {
      target.scrollTo({ y: 0, animated: true });
      return;
    }

    if ('scrollToOffset' in target && typeof target.scrollToOffset === 'function') {
      target.scrollToOffset({ offset: 0, animated: true });
    }
  }, [scrollRef]);

  return { showScrollToTop, scrollToTop, handleScroll };
}
