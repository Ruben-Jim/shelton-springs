import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface DocumentPhotoPickerProps {
  uris: string[];
  max: number;
  onAdd: () => void;
  onRemove: (index: number) => void;
}

/** Numbered thumbnails (page 1, 2, …) for photos picked for a document, with remove and "add page". */
const DocumentPhotoPicker = ({ uris, max, onAdd, onRemove }: DocumentPhotoPickerProps) => {
  if (!uris.length) return null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Ionicons name="checkmark-circle" size={18} color="#10b981" />
        <Text style={styles.headerText}>
          {uris.length === 1 ? '1 photo selected' : `${uris.length} photos selected`}
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {uris.map((uri, index) => (
          <View key={`${uri}-${index}`} style={styles.thumbWrap}>
            <Image source={{ uri }} style={styles.thumb} />
            <View style={styles.pageNumber}>
              <Text style={styles.pageNumberText}>{index + 1}</Text>
            </View>
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => onRemove(index)}
              hitSlop={8}
              accessibilityLabel={`Remove page ${index + 1}`}
            >
              <Ionicons name="close-circle" size={22} color="#ef4444" />
            </TouchableOpacity>
          </View>
        ))}
        {uris.length < max && (
          <TouchableOpacity style={styles.addTile} onPress={onAdd} accessibilityLabel="Add another page">
            <Ionicons name="add" size={26} color="#2563eb" />
            <Text style={styles.addText}>Add page</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      <Text style={styles.hint}>Pages appear in this order. Up to {max} photos.</Text>
    </View>
  );
};

const THUMB = 76;

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#065f46',
  },
  row: {
    gap: 10,
    paddingTop: 6,
    paddingRight: 6,
  },
  thumbWrap: {
    width: THUMB,
    height: THUMB,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  pageNumber: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17,24,39,0.75)',
  },
  pageNumberText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  removeButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#ffffff',
    borderRadius: 11,
  },
  addTile: {
    width: THUMB,
    height: THUMB,
    borderRadius: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#93c5fd',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  addText: {
    fontSize: 11,
    color: '#2563eb',
    fontWeight: '600',
    marginTop: 2,
  },
  hint: {
    marginTop: 8,
    fontSize: 12,
    color: '#6b7280',
  },
});

export default DocumentPhotoPicker;
