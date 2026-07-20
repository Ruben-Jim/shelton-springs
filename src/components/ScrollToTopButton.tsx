import React from 'react';
import { Platform, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ScrollToTopButtonProps = {
  visible: boolean;
  onPress: () => void;
  bottomOffset?: number;
};

export default function ScrollToTopButton({
  visible,
  onPress,
  bottomOffset = 12,
}: ScrollToTopButtonProps) {
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { bottom: Math.max(insets.bottom, 16) + bottomOffset },
      ]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Scroll to top"
    >
      <Ionicons name="chevron-up" size={24} color="#ffffff" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    left: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 16px rgba(37, 99, 235, 0.35)',
        cursor: 'pointer',
      } as any,
      default: {
        shadowColor: '#2563eb',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
      },
    }),
  },
});
