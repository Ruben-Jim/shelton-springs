import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { homeSectionStyles } from './homeSectionStyles';

export type HomeQuickLink = {
  id: string;
  label: string;
  icon: string;
  color: string;
  onPress: () => void;
};

type HomeQuickLinksProps = {
  links: HomeQuickLink[];
  embedded?: boolean;
  showDivider?: boolean;
};

export default function HomeQuickLinks({ links, embedded = false, showDivider = false }: HomeQuickLinksProps) {
  if (links.length === 0) return null;

  return (
    <View style={[styles.container, embedded && styles.containerEmbedded]}>
      {showDivider ? <View style={styles.divider} /> : null}
      <Text style={[homeSectionStyles.heading, showDivider && styles.headingWithDivider]}>Explore</Text>
      <View style={styles.grid}>
        {links.map((link) => (
          <TouchableOpacity
            key={link.id}
            style={styles.card}
            activeOpacity={0.85}
            onPress={link.onPress}
          >
            <View style={[styles.iconWrap, { backgroundColor: `${link.color}15` }]}>
              <Ionicons name={link.icon as any} size={21} color={link.color} />
            </View>
            <Text style={styles.label} numberOfLines={2}>
              {link.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 15,
    marginTop: 8,
    marginBottom: 12,
  },
  containerEmbedded: {
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 0,
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginBottom: 16,
    marginTop: 4,
  },
  headingWithDivider: {
    marginTop: 0,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  card: {
    width: '31.5%',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    lineHeight: 14,
  },
});
