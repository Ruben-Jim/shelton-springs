import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsTestUserReadOnly } from '../hooks/useGuardedMutation';

/** Compact header note when the App Store / QA test account is logged in. */
export default function TestUserReadOnlyBanner() {
  const { isReadOnly } = useIsTestUserReadOnly();
  if (!isReadOnly) return null;

  return (
    <View style={styles.banner} accessibilityRole="text">
      <Ionicons name="eye-outline" size={14} color="#ffffff" />
      <Text style={styles.text}>View only — changes are disabled</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(217, 119, 6, 0.85)',
    alignSelf: 'center',
  },
  text: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});
