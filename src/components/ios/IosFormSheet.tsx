import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Keyboard,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IOS_FORM_THEME as theme } from './iosFormTheme';
import { canUseBlurView } from './nativeModuleSupport';

type IosFormSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeightPercent?: number;
  defaultHeightPercent?: number;
  minHeightPercent?: number;
  /** Lift sheet content when the software keyboard is open (native mobile). */
  keyboardAware?: boolean;
};

const OPEN_SPRING = { damping: 22, stiffness: 240 };
const SETTLE_SPRING = { damping: 24, stiffness: 280 };
const DISMISS_SPRING = { damping: 26, stiffness: 320 };

function SheetBackdrop() {
  if (canUseBlurView) {
    const { BlurView } = require('expo-blur') as typeof import('expo-blur');
    return <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFillObject} />;
  }
  return <View style={styles.dimBackdrop} />;
}

export default function IosFormSheet({
  visible,
  onClose,
  children,
  maxHeightPercent = 0.94,
  defaultHeightPercent = 0.9,
  minHeightPercent = 0.28,
  keyboardAware = true,
}: IosFormSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    if (!visible || !keyboardAware || Platform.OS === 'web') {
      setKeyboardInset(0);
      return;
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      const overlap = Math.max(0, event.endCoordinates.height - insets.bottom);
      setKeyboardInset(overlap);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardInset(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible, keyboardAware, insets.bottom]);

  const bounds = useMemo(() => {
    const maxHeight = screenHeight * maxHeightPercent;
    const minHeight = Math.min(maxHeight - 48, Math.max(220, screenHeight * minHeightPercent));
    const defaultHeight = Math.min(
      maxHeight,
      Math.max(minHeight, screenHeight * defaultHeightPercent)
    );
    const dismissHeight = Math.max(100, screenHeight * 0.16);
    return { maxHeight, minHeight, defaultHeight, dismissHeight };
  }, [screenHeight, maxHeightPercent, defaultHeightPercent, minHeightPercent]);

  const sheetHeight = useSharedValue(bounds.defaultHeight);
  const dragStartHeight = useSharedValue(bounds.defaultHeight);

  useEffect(() => {
    if (visible) {
      sheetHeight.value = withSpring(bounds.defaultHeight, OPEN_SPRING);
      dragStartHeight.value = bounds.defaultHeight;
      return;
    }
    sheetHeight.value = bounds.defaultHeight;
    dragStartHeight.value = bounds.defaultHeight;
    setKeyboardInset(0);
  }, [visible, bounds.defaultHeight, dragStartHeight, sheetHeight]);

  useEffect(() => {
    if (!keyboardAware || keyboardInset <= 0 || !visible) return;
    sheetHeight.value = withSpring(bounds.maxHeight, SETTLE_SPRING);
    dragStartHeight.value = bounds.maxHeight;
  }, [keyboardAware, keyboardInset, visible, bounds.maxHeight, dragStartHeight, sheetHeight]);

  const dismissSheet = () => {
    sheetHeight.value = withSpring(0, DISMISS_SPRING, (finished) => {
      if (finished) {
        runOnJS(onClose)();
      }
    });
  };

  const panGesture = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onBegin(() => {
      dragStartHeight.value = sheetHeight.value;
    })
    .onUpdate((event) => {
      const next = dragStartHeight.value - event.translationY;
      sheetHeight.value = Math.min(bounds.maxHeight + 12, Math.max(0, next));
    })
    .onEnd((event) => {
      const current = sheetHeight.value;
      const shouldDismiss =
        current < bounds.dismissHeight || event.velocityY > 850;

      if (shouldDismiss) {
        sheetHeight.value = withSpring(0, DISMISS_SPRING, (finished) => {
          if (finished) {
            runOnJS(onClose)();
          }
        });
        return;
      }

      if (current < bounds.minHeight) {
        sheetHeight.value = withSpring(bounds.minHeight, SETTLE_SPRING);
        return;
      }

      if (current > bounds.maxHeight) {
        sheetHeight.value = withSpring(bounds.maxHeight, SETTLE_SPRING);
        return;
      }

      sheetHeight.value = withSpring(current, SETTLE_SPRING);
    });

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    height: sheetHeight.value,
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => {
    const progress = Math.min(
      1,
      sheetHeight.value / Math.max(bounds.defaultHeight, 1)
    );
    return {
      opacity: 0.2 + progress * 0.35,
    };
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={dismissSheet}
      presentationStyle="overFullScreen"
      statusBarTranslucent
    >
      <GestureHandlerRootView style={styles.flex}>
          <View style={styles.overlay}>
          <TouchableOpacity
            style={styles.backdropTouchable}
            activeOpacity={1}
            onPress={dismissSheet}
          />
          <Animated.View style={[styles.backdropTint, backdropAnimatedStyle]}>
            <SheetBackdrop />
          </Animated.View>

          <Animated.View
            style={[
              styles.sheet,
              sheetAnimatedStyle,
              keyboardInset > 0 && { paddingBottom: 0 },
            ]}
          >
            {Platform.OS !== 'web' ? (
              <GestureDetector gesture={panGesture}>
                <Animated.View style={styles.handleArea} accessibilityRole="adjustable">
                  <View style={styles.grabber} />
                </Animated.View>
              </GestureDetector>
            ) : null}
            <View
              style={[
                styles.sheetInner,
                {
                  paddingBottom: Math.max(insets.bottom, 12) + keyboardInset,
                },
              ]}
            >
              {children}
            </View>
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropTouchable: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropTint: {
    ...StyleSheet.absoluteFillObject,
  },
  dimBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: theme.groupedBackground,
    borderTopLeftRadius: theme.sheetRadius,
    borderTopRightRadius: theme.sheetRadius,
    overflow: 'hidden',
  },
  sheetInner: {
    flex: 1,
  },
  handleArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
    paddingBottom: 8,
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.grabber,
  },
});
