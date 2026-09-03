import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Platform,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_FORM_THEME as theme } from '../../ios/iosFormTheme';
import { ResidentOption } from './types';

type RecipientPickerProps = {
  residents: ResidentOption[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
};

function sortResidents(residents: ResidentOption[], selectedIds: string[]) {
  const selectedSet = new Set(selectedIds);
  return [...residents].sort((a, b) => {
    const aSelected = selectedSet.has(a._id);
    const bSelected = selectedSet.has(b._id);
    if (aSelected !== bSelected) return aSelected ? -1 : 1;
    const aName = `${a.lastName} ${a.firstName}`.toLowerCase();
    const bName = `${b.lastName} ${b.firstName}`.toLowerCase();
    return aName.localeCompare(bName);
  });
}

export default function RecipientPicker({
  residents,
  selectedIds,
  onSelectionChange,
}: RecipientPickerProps) {
  const [search, setSearch] = useState('');
  const searchInputRef = useRef<TextInput>(null);

  const dismissSearchKeyboard = () => {
    searchInputRef.current?.blur();
    Keyboard.dismiss();
  };

  const visibleResidents = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = sortResidents(residents, selectedIds);
    if (!q) return base;
    return base.filter((resident) => {
      const name = `${resident.firstName} ${resident.lastName}`.toLowerCase();
      const address = `${resident.address} ${resident.unitNumber ?? ''}`.toLowerCase();
      return (
        name.includes(q) ||
        address.includes(q) ||
        resident.email.toLowerCase().includes(q)
      );
    });
  }, [residents, search, selectedIds]);

  const toggleResident = (id: string) => {
    onSelectionChange(
      selectedIds.includes(id)
        ? selectedIds.filter((entry) => entry !== id)
        : [...selectedIds, id]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.heading}>Residents</Text>
          <Text style={styles.subheading}>
            Tap to select. Search narrows the list below.
          </Text>
        </View>
        {selectedIds.length > 0 ? (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{selectedIds.length}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={theme.textTertiary} />
        <TextInput
          ref={searchInputRef}
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Filter by name or address…"
          placeholderTextColor={theme.textTertiary}
          autoCapitalize="words"
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
          blurOnSubmit
          onSubmitEditing={dismissSearchKeyboard}
        />
        {search.length > 0 ? (
          <TouchableOpacity
            onPress={() => {
              setSearch('');
              dismissSearchKeyboard();
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close-circle" size={18} color={theme.textTertiary} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.listShell}>
        <FlatList
          style={styles.list}
          data={visibleResidents}
          keyExtractor={(item) => item._id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          contentContainerStyle={
            visibleResidents.length === 0 ? styles.listEmptyContent : styles.listContent
          }
          renderItem={({ item, index }) => {
            const checked = selectedIds.includes(item._id);
            const isLast = index === visibleResidents.length - 1;
            return (
              <TouchableOpacity
                style={[styles.residentRow, isLast && styles.residentRowLast]}
                onPress={() => toggleResident(item._id)}
              >
                <Ionicons
                  name={checked ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={checked ? theme.accent : theme.textTertiary}
                />
                <View style={styles.residentText}>
                  <Text style={[styles.residentName, checked && styles.residentNameSelected]}>
                    {item.firstName} {item.lastName}
                  </Text>
                  <Text style={styles.residentMeta}>
                    {item.address}
                    {item.unitNumber ? `, Unit ${item.unitNumber}` : ''}
                  </Text>
                </View>
                {checked ? (
                  <Ionicons name="checkmark-circle" size={18} color={theme.accent} />
                ) : null}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={32} color={theme.textTertiary} />
              <Text style={styles.emptyTitle}>No matches</Text>
              <Text style={styles.emptyText}>
                {search.trim()
                  ? 'Try a different name or address.'
                  : 'No active residents are available to select.'}
              </Text>
            </View>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    minHeight: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  headerText: {
    flex: 1,
  },
  heading: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 4,
  },
  subheading: {
    fontSize: 13,
    lineHeight: 18,
    color: theme.textSecondary,
  },
  countBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  countBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.separator,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.textPrimary,
  },
  listShell: {
    flex: 1,
    minHeight: 0,
    borderRadius: 12,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.separator,
    overflow: 'hidden',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 8,
  },
  listEmptyContent: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  emptyText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  residentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.separator,
  },
  residentRowLast: {
    borderBottomWidth: 0,
  },
  residentText: {
    flex: 1,
  },
  residentName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  residentNameSelected: {
    color: theme.accent,
  },
  residentMeta: {
    marginTop: 2,
    fontSize: 12,
    color: theme.textSecondary,
    lineHeight: 16,
  },
});
