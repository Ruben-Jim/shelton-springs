import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_FORM_THEME as theme } from '../../ios/iosFormTheme';
import {
  YARD_MAINTENANCE_CHECKLIST,
  YARD_MAINTENANCE_OTHER_VIOLATION,
  resolveSelectedViolations,
} from '../../../constants/yardMaintenanceNotice';

type ViolationPickerProps = {
  selectedViolations: string[];
  otherViolationDetail: string;
  onSelectionChange: (violations: string[]) => void;
  onOtherViolationDetailChange: (detail: string) => void;
};

export default function ViolationPicker({
  selectedViolations,
  otherViolationDetail,
  onSelectionChange,
  onOtherViolationDetailChange,
}: ViolationPickerProps) {
  const otherSelected = selectedViolations.includes(YARD_MAINTENANCE_OTHER_VIOLATION);
  const resolvedCount = resolveSelectedViolations(
    selectedViolations,
    otherViolationDetail
  ).length;

  const toggle = (item: string) => {
    if (item === YARD_MAINTENANCE_OTHER_VIOLATION) {
      if (otherSelected) {
        onSelectionChange(selectedViolations.filter((entry) => entry !== item));
        onOtherViolationDetailChange('');
      } else {
        onSelectionChange([...selectedViolations, item]);
      }
      return;
    }
    onSelectionChange(
      selectedViolations.includes(item)
        ? selectedViolations.filter((entry) => entry !== item)
        : [...selectedViolations, item]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.lead}>
        Select every yard maintenance item that applies. Only checked items appear on the
        compliance letter and email.
      </Text>

      <View style={styles.list}>
        {YARD_MAINTENANCE_CHECKLIST.map((item, index) => {
          const isOther = item === YARD_MAINTENANCE_OTHER_VIOLATION;
          const checked = isOther
            ? otherSelected
            : selectedViolations.includes(item);
          const isLast = index === YARD_MAINTENANCE_CHECKLIST.length - 1;

          return (
            <View key={item} style={[styles.rowWrap, isLast && !isOther && styles.rowWrapLast]}>
              <TouchableOpacity
                style={styles.row}
                onPress={() => toggle(item)}
                activeOpacity={0.85}
              >
                <Ionicons
                  name={checked ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={checked ? theme.accent : theme.textTertiary}
                />
                <Text style={[styles.rowText, checked && styles.rowTextChecked]}>
                  {isOther ? 'Other (describe below)' : item}
                </Text>
              </TouchableOpacity>
              {isOther && otherSelected ? (
                <View style={styles.otherInputWrap}>
                  <TextInput
                    style={styles.otherInput}
                    value={otherViolationDetail}
                    onChangeText={onOtherViolationDetailChange}
                    placeholder="Describe the violation…"
                    placeholderTextColor={theme.textTertiary}
                    multiline
                    autoFocus
                  />
                  {otherViolationDetail.trim().length === 0 ? (
                    <Text style={styles.otherHint}>Required when Other is selected</Text>
                  ) : (
                    <Text style={styles.otherPreview}>
                      Letter will show: Other: {otherViolationDetail.trim()}
                    </Text>
                  )}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <Text style={styles.footer}>
        {resolvedCount === 0
          ? 'Choose at least one violation to continue.'
          : otherSelected && otherViolationDetail.trim().length === 0
            ? 'Enter a description for Other to continue.'
            : `${resolvedCount} item${resolvedCount === 1 ? '' : 's'} on the notice`}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  lead: {
    fontSize: 14,
    lineHeight: 20,
    color: theme.textSecondary,
    marginBottom: 14,
  },
  list: {
    borderRadius: 14,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.separator,
    overflow: 'hidden',
  },
  rowWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.separator,
  },
  rowWrapLast: {
    borderBottomWidth: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    color: theme.textPrimary,
  },
  rowTextChecked: {
    color: theme.accent,
    fontWeight: '600',
  },
  otherInputWrap: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingLeft: 48,
  },
  otherInput: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.separator,
    backgroundColor: theme.groupedBackground,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.textPrimary,
    textAlignVertical: 'top',
  },
  otherHint: {
    marginTop: 6,
    fontSize: 12,
    color: theme.destructive,
  },
  otherPreview: {
    marginTop: 6,
    fontSize: 12,
    color: theme.textTertiary,
    lineHeight: 16,
  },
  footer: {
    marginTop: 12,
    fontSize: 13,
    color: theme.textTertiary,
  },
});
