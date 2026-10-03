import { useEffect, useState } from 'react';
import { Dimensions, Platform } from 'react-native';

/**
 * One shared window-width source. A single Dimensions listener feeds every subscriber, and
 * on web resize events are coalesced to at most one update per animation frame, so dragging
 * the window edge doesn't re-render whole screens on every pixel.
 */
let currentWidth = Dimensions.get('window').width;
const listeners = new Set<(width: number) => void>();
let dimensionsSub: { remove: () => void } | null = null;
let pendingFrame: number | null = null;

function publish(width: number) {
  currentWidth = width;
  listeners.forEach((listener) => listener(width));
}

function subscribe(listener: (width: number) => void) {
  listeners.add(listener);
  if (!dimensionsSub) {
    dimensionsSub = Dimensions.addEventListener('change', ({ window }) => {
      if (Platform.OS !== 'web' || typeof requestAnimationFrame === 'undefined') {
        publish(window.width);
        return;
      }
      if (pendingFrame != null) cancelAnimationFrame(pendingFrame);
      pendingFrame = requestAnimationFrame(() => {
        pendingFrame = null;
        publish(Dimensions.get('window').width);
      });
    });
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && dimensionsSub) {
      dimensionsSub.remove();
      dimensionsSub = null;
    }
  };
}

/**
 * Current window width. Pass `active = false` (e.g. `useIsFocused()` on a stack screen that
 * stays mounted underneath) to pause updates; it catches up when it becomes active again.
 */
export function useWindowWidth(active = true) {
  const [width, setWidth] = useState(currentWidth);

  useEffect(() => {
    if (!active) return;
    setWidth(currentWidth);
    return subscribe(setWidth);
  }, [active]);

  return width;
}

/** True once the window is at least `minWidth` wide. Only re-renders when that flips. */
export function useIsWindowAtLeast(minWidth: number) {
  const [matches, setMatches] = useState(currentWidth >= minWidth);

  useEffect(() => {
    setMatches(currentWidth >= minWidth);
    return subscribe((width) => setMatches(width >= minWidth));
  }, [minWidth]);

  return matches;
}
