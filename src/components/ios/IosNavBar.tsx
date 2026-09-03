import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { IOS_FORM_THEME as theme } from './iosFormTheme';

type IosNavBarProps = {
  title: string;
  onCancel: () => void;
  cancelLabel?: string;
  onConfirm?: () => void;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  loading?: boolean;
};

export default function IosNavBar({
  title,
  onCancel,
  cancelLabel = 'Cancel',
  onConfirm,
  confirmLabel = 'Send',
  confirmDisabled = false,
  loading = false,
}: IosNavBarProps) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onCancel} disabled={loading} style={styles.sideButton}>
        <Text style={styles.cancelText}>{cancelLabel}</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{title}</Text>
      {onConfirm ? (
        <TouchableOpacity
          onPress={onConfirm}
          disabled={confirmDisabled || loading}
          style={styles.sideButton}
        >
          <Text
            style={[
              styles.confirmText,
              (confirmDisabled || loading) && styles.confirmTextDisabled,
            ]}
          >
            {loading ? 'Sending…' : confirmLabel}
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.sideButton} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
    paddingBottom: 10,
  },
  sideButton: {
    minWidth: 72,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: theme.textPrimary,
    textAlign: 'center',
  },
  cancelText: {
    fontSize: 17,
    color: theme.accent,
  },
  confirmText: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.accent,
    textAlign: 'right',
  },
  confirmTextDisabled: {
    opacity: 0.4,
  },
});
