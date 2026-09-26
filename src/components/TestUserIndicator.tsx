import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

const TestUserIndicator = () => {
  const { user } = useAuth();
  const isTestUser = user?.isTestUser === true;

  if (!isTestUser) {
    return null;
  }

  return (
    <View style={styles.badge}>
      <Ionicons name="flask" size={12} color="#ffffff" />
      <Text style={styles.badgeText}>Test User</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d97706',
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

export default TestUserIndicator;
