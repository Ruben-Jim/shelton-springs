import React, { useEffect } from 'react';
import { Platform, StyleProp, ViewStyle, useWindowDimensions } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

// Matches the desktop nav breakpoint; desktop web switches tabs without motion
const DESKTOP_MIN_WIDTH = 1024;

/** Soft spring: settles in ~400ms with a barely-there overshoot on the rise. */
const ENTRANCE_SPRING = { damping: 18, stiffness: 160, mass: 1 };
const RISE_DISTANCE = 16;

/** Header height the last hero header settled at, so the next one can grow/shrink from it. */
let lastHeroHeight: number | null = null;

const useMotionEnabled = () => {
  const { width } = useWindowDimensions();
  return Platform.OS !== 'web' || width < DESKTOP_MIN_WIDTH;
};

/**
 * Entrance for a main tab's content: fades in while rising into place when the tab mounts.
 * Use increasing `delay`s (e.g. 0, 70) to stagger sections. Static on desktop web.
 */
export function useTabEntranceStyle(delay = 0, distance = RISE_DISTANCE) {
  const enabled = useMotionEnabled();
  const progress = useSharedValue(enabled ? 0 : 1);

  useEffect(() => {
    if (enabled) progress.value = withDelay(delay, withSpring(1, ENTRANCE_SPRING));
    // Run once on mount: tabs remount on every switch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.6, 1], [0, 1, 1], 'clamp'),
    transform: [{ translateY: (1 - progress.value) * distance }],
  }));
}

/**
 * Hero header height that springs from the previous tab's header height (e.g. Home's taller
 * hero) to this one, so the header frame morphs instead of jumping.
 */
export function useHeroHeightStyle(targetHeight: number) {
  const enabled = useMotionEnabled();
  const startHeight = enabled && lastHeroHeight != null ? lastHeroHeight : targetHeight;
  const height = useSharedValue(startHeight);

  useEffect(() => {
    height.value =
      height.value === targetHeight
        ? targetHeight
        : withSpring(targetHeight, { damping: 26, stiffness: 220, overshootClamping: true });
    lastHeroHeight = targetHeight;
  }, [targetHeight, height]);

  return useAnimatedStyle(() => ({ height: height.value }));
}

type TabEntranceProps = {
  delay?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

/** Wraps a block of tab content so it fades and rises in when the tab opens. */
export default function TabEntrance({ delay = 0, style, children }: TabEntranceProps) {
  const entranceStyle = useTabEntranceStyle(delay);
  return <Animated.View style={[style, entranceStyle]}>{children}</Animated.View>;
}
