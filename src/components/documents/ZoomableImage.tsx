import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import OptimizedImage from '../OptimizedImage';

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
const SETTLE = { duration: 220 };

type ZoomableImageProps = {
  storageId: string;
  /** Lets a pager stop swiping while the photo is zoomed in */
  onZoomChange?: (zoomed: boolean) => void;
  /** False once the pager moves to another page: snaps back to fit so it isn't zoomed on return */
  active?: boolean;
};

/** Photo with pinch-to-zoom, double-tap zoom and panning while zoomed (UI-thread gestures). */
export default function ZoomableImage({ storageId, onZoomChange, active = true }: ZoomableImageProps) {
  const [loaded, setLoaded] = useState(false);
  const width = useSharedValue(0);
  const height = useSharedValue(0);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  const zoomed = useSharedValue(false);

  useEffect(() => {
    if (active) return;
    scale.value = 1;
    savedScale.value = 1;
    tx.value = 0;
    ty.value = 0;
    savedTx.value = 0;
    savedTy.value = 0;
    zoomed.value = false;
  }, [active, scale, savedScale, tx, ty, savedTx, savedTy, zoomed]);

  const onLayout = (e: LayoutChangeEvent) => {
    width.value = e.nativeEvent.layout.width;
    height.value = e.nativeEvent.layout.height;
  };

  const reportZoom = (next: boolean) => {
    'worklet';
    if (zoomed.value === next) return;
    zoomed.value = next;
    if (onZoomChange) runOnJS(onZoomChange)(next);
  };

  /** Keep the zoomed photo covering the frame: no panning past its edges. */
  const clampX = (x: number, s: number) => {
    'worklet';
    const max = (width.value * (s - 1)) / 2;
    return Math.min(max, Math.max(-max, x));
  };
  const clampY = (y: number, s: number) => {
    'worklet';
    const max = (height.value * (s - 1)) / 2;
    return Math.min(max, Math.max(-max, y));
  };

  const settle = (s: number, x: number, y: number) => {
    'worklet';
    const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
    const nextX = clampX(x, nextScale);
    const nextY = clampY(y, nextScale);
    scale.value = withTiming(nextScale, SETTLE);
    tx.value = withTiming(nextX, SETTLE);
    ty.value = withTiming(nextY, SETTLE);
    savedScale.value = nextScale;
    savedTx.value = nextX;
    savedTy.value = nextY;
    reportZoom(nextScale > 1.01);
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      const next = Math.min(MAX_SCALE * 1.2, Math.max(MIN_SCALE * 0.8, savedScale.value * e.scale));
      // Zoom toward the fingers: keep the focal point under them
      const fx = e.focalX - width.value / 2;
      const fy = e.focalY - height.value / 2;
      const ratio = next / savedScale.value;
      tx.value = fx - (fx - savedTx.value) * ratio;
      ty.value = fy - (fy - savedTy.value) * ratio;
      scale.value = next;
    })
    .onEnd(() => {
      settle(scale.value, tx.value, ty.value);
    });

  // Only claims the touch while zoomed, so an unzoomed photo still swipes in the pager
  const pan = Gesture.Pan()
    .manualActivation(true)
    .onTouchesMove((_e, state) => {
      if (savedScale.value > 1.01) state.activate();
      else state.fail();
    })
    .onUpdate((e) => {
      tx.value = clampX(savedTx.value + e.translationX, scale.value);
      ty.value = clampY(savedTy.value + e.translationY, scale.value);
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      if (savedScale.value > 1.01) {
        settle(1, 0, 0);
        return;
      }
      // Zoom in on the tapped spot
      const fx = e.x - width.value / 2;
      const fy = e.y - height.value / 2;
      settle(DOUBLE_TAP_SCALE, -fx * (DOUBLE_TAP_SCALE - 1), -fy * (DOUBLE_TAP_SCALE - 1));
    });

  const gesture = Gesture.Simultaneous(pinch, pan, doubleTap);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.frame} onLayout={onLayout} collapsable={false}>
        {!loaded && (
          <View style={styles.loading}>
            <ActivityIndicator color="#6b7280" />
          </View>
        )}
        <Animated.View style={[styles.fill, imageStyle]}>
          <OptimizedImage
            storageId={storageId}
            style={styles.fill}
            contentFit="contain"
            onLoad={() => setLoaded(true)}
          />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    overflow: 'hidden',
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
