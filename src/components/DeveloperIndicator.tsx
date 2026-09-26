import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

const DeveloperIndicator = () => {
  const { user } = useAuth();
  const isDev = user?.isDev ?? false;
  const isTestUser = user?.isTestUser === true;

  // Test User badge replaces Developer in headers for the review account
  if (!isDev || isTestUser) {
    return null;
  }

  return (
    <View style={styles.badge}>
      <Ionicons name="code-slash" size={12} color="#ffffff" />
      <Text style={styles.badgeText}>Developer</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default DeveloperIndicator;
