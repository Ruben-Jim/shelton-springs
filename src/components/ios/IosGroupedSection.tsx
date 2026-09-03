import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_FORM_THEME as theme } from './iosFormTheme';
import AppIcon from './AppIcon';

export function IosSectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

export function IosSectionFooter({ text }: { text: string }) {
  return <Text style={styles.sectionFooter}>{text}</Text>;
}

export function IosGroupedCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.groupedCard}>{children}</View>;
}

type IosFormRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  iosIcon?: string;
  iconColor?: string;
  label: string;
  value?: string;
  onPress?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  trailing?: React.ReactNode;
  showChevron?: boolean;
  isLast?: boolean;
};

export function IosFormRow({
  icon,
  iosIcon,
  iconColor = theme.accent,
  label,
  value,
  onPress,
  disabled,
  destructive,
  trailing,
  showChevron,
  isLast,
}: IosFormRowProps) {
  const content = (
    <View style={[styles.row, isLast && styles.rowLast]}>
      <View style={[styles.rowIconWrap, { backgroundColor: `${iconColor}14` }]}>
        <AppIcon
          iosName={iosIcon ?? 'circle.fill'}
          ionicon={icon}
          size={18}
          color={iconColor}
        />
      </View>
      <View style={styles.rowTextWrap}>
        <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>{label}</Text>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      </View>
      <View style={styles.rowTrailing}>
        {trailing}
        {showChevron ? <Ionicons name="chevron-forward" size={18} color="#C7C7CC" /> : null}
      </View>
    </View>
  );

  if (!onPress) return content;

  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.65}>
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    marginTop: 18,
    marginBottom: 6,
    marginLeft: 16,
    fontSize: 13,
    fontWeight: '400',
    color: theme.textSecondary,
    letterSpacing: 0.2,
  },
  sectionFooter: {
    marginBottom: 8,
    marginHorizontal: 16,
    fontSize: 13,
    lineHeight: 18,
    color: theme.textSecondary,
  },
  groupedCard: {
    backgroundColor: theme.card,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  row: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.separator,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowTextWrap: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 16,
    color: theme.textPrimary,
  },
  rowLabelDestructive: {
    color: theme.destructive,
  },
  rowValue: {
    marginTop: 2,
    fontSize: 13,
    color: theme.textSecondary,
  },
  rowTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
