import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

const BoardMemberIndicator = () => {
  const { user } = useAuth();
  const isBoardMember = user?.isBoardMember && user?.isActive;
  const isDev = user?.isDev ?? false;

  // Devs see DeveloperIndicator only; don't show Board Member
  if (!isBoardMember || isDev) {
    return null;
  }

  return (
    <View style={styles.badge}>
      <Ionicons name="shield" size={12} color="#ffffff" />
      <Text style={styles.badgeText}>Board Member</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
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

export default BoardMemberIndicator;
