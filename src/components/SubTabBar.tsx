import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SubTabItem } from '../navigation/mainTabs';
import { DESKTOP_CONTENT_STYLE } from '../constants/hoaTheme';

const INACTIVE_COLOR = '#6b7280';

type SubTabBarProps<Id extends string> = {
  tabs: ReadonlyArray<SubTabItem<Id>>;
  activeId: Id;
  onChange: (id: Id) => void;
  /** Section accent (SECTION_ACCENTS) for the underline, active label and hover shade */
  accent: string;
  /** Desktop web: evenly spread tabs, centered in the shared content width */
  desktop: boolean;
  /**
   * Phones: scroll sideways instead of splitting the width evenly. For sections with more
   * or longer labels than fit (Community); desktop always uses the even layout.
   */
  scrollOnMobile?: boolean;
};

/** Section subtab strip (HOA, Community): icon + label, accent underline, hover shade on web. */
export default function SubTabBar<Id extends string>({
  tabs,
  activeId,
  onChange,
  accent,
  desktop,
  scrollOnMobile = false,
}: SubTabBarProps<Id>) {
  const scroll = scrollOnMobile && !desktop;

  const buttons = tabs.map((tab) => (
    <SubTabButton
      key={tab.id}
      tab={tab}
      isActive={tab.id === activeId}
      accent={accent}
      desktop={desktop}
      compact={scroll}
      onPress={() => onChange(tab.id)}
    />
  ));

  return (
    <View style={styles.bar}>
      {scroll ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {buttons}
        </ScrollView>
      ) : (
        <View style={desktop ? styles.rowDesktop : styles.row}>{buttons}</View>
      )}
    </View>
  );
}

function SubTabButton<Id extends string>({
  tab,
  isActive,
  accent,
  desktop,
  compact,
  onPress,
}: {
  tab: SubTabItem<Id>;
  isActive: boolean;
  accent: string;
  desktop: boolean;
  /** Content-width tab for the scrolling mobile strip */
  compact: boolean;
  onPress: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const color = isActive ? accent : INACTIVE_COLOR;

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      style={({ pressed }) => [
        compact ? styles.tabCompact : styles.tab,
        { borderBottomColor: isActive ? accent : 'transparent' },
        hovered && { backgroundColor: `${accent}14` },
        pressed && !hovered && styles.tabPressed,
      ]}
    >
      <Ionicons name={tab.icon} size={desktop || compact ? 18 : 16} color={color} />
      <Text style={[styles.label, desktop && styles.labelDesktop, { color }, isActive && styles.labelActive]}>
        {tab.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 8,
  },
  row: {
    flexDirection: 'row',
  },
  rowDesktop: {
    ...DESKTOP_CONTENT_STYLE,
    flexDirection: 'row',
  },
  scrollContent: {
    paddingHorizontal: 0,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 6,
    borderBottomWidth: 2,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    ...Platform.select({ web: { cursor: 'pointer', transition: 'background-color 120ms ease' } as any }),
  },
  tabCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
  },
  tabPressed: {
    opacity: 0.5,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
  labelDesktop: {
    fontSize: 14,
  },
  labelActive: {
    fontWeight: '600',
  },
});
