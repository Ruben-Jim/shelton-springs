import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { homeSectionStyles } from './homeSectionStyles';

export type HomeAttentionItem = {
  id: string;
  label: string;
  icon: string;
  color: string;
  onPress: () => void;
};

type HomeAttentionStripProps = {
  items: HomeAttentionItem[];
  embedded?: boolean;
};

export default function HomeAttentionStrip({ items, embedded = false }: HomeAttentionStripProps) {
  if (items.length === 0) return null;

  return (
    <View style={[styles.container, embedded && styles.containerEmbedded]}>
      <Text style={homeSectionStyles.heading}>Needs your attention</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {items.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.chip, { borderColor: `${item.color}35`, backgroundColor: `${item.color}10` }]}
            activeOpacity={0.85}
            onPress={item.onPress}
          >
            <View style={[styles.iconWrap, { backgroundColor: `${item.color}18` }]}>
              <Ionicons name={item.icon as any} size={15} color={item.color} />
            </View>
            <Text style={[styles.chipText, { color: item.color }]} numberOfLines={1}>
              {item.label}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={item.color} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 15,
    marginTop: 12,
    marginBottom: 4,
  },
  containerEmbedded: {
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 0,
  },
  row: {
    gap: 10,
    paddingRight: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: 260,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '600',
    maxWidth: 190,
  },
});
