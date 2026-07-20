import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

type AdminGridProps = {
  children: React.ReactNode;
  style?: ViewStyle;
};

export function AdminGrid({ children, style }: AdminGridProps) {
  return <View style={[styles.grid, style]}>{children}</View>;
}

type AdminGridItemProps = {
  children: React.ReactNode;
  columnWidthPercent: number;
};

export function AdminGridItem({ children, columnWidthPercent }: AdminGridItemProps) {
  return (
    <View
      style={[
        styles.item,
        {
          width: `${columnWidthPercent}%` as any,
          flexGrow: 0,
          flexShrink: 0,
        },
      ]}
    >
      <View style={styles.itemInner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    marginHorizontal: -8,
    width: '100%',
  },
  item: {
    padding: 8,
  },
  itemInner: {
    flex: 1,
    alignSelf: 'stretch',
  },
});
