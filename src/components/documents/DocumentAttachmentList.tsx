import React, { useLayoutEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Animated, PanResponder, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PendingAttachment } from '../../utils/documentUpload';

interface DocumentAttachmentListProps {
  items: PendingAttachment[];
  onReorder: (next: PendingAttachment[]) => void;
  onRemove: (id: string) => void;
  /** Lets the parent pause its own scrolling while a row is being dragged. */
  onDragActiveChange?: (active: boolean) => void;
}

const ROW_HEIGHT = 60;
const ROW_GAP = 8;
const SLOT = ROW_HEIGHT + ROW_GAP;
const useNativeDriver = Platform.OS !== 'web';

const fileLabel = (item: PendingAttachment) => {
  if (item.kind === 'image') return 'Photo';
  if (item.mimeType === 'application/pdf' || /\.pdf$/i.test(item.name)) return 'PDF';
  if (/word|\.docx?$/i.test(`${item.mimeType ?? ''} ${item.name}`)) return 'Word';
  return 'File';
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

type RowProps = {
  item: PendingAttachment;
  index: number;
  offset: Animated.Value;
  dragging: boolean;
  onDragStart: (index: number) => void;
  onDragMove: (index: number, dy: number) => void;
  onDragEnd: (index: number, dy: number) => void;
  onRemove: (id: string) => void;
};

const AttachmentRow = ({ item, index, offset, dragging, onDragStart, onDragMove, onDragEnd, onRemove }: RowProps) => {
  // PanResponder is created once; read the latest index/callbacks through a ref
  const latest = useRef({ index, onDragStart, onDragMove, onDragEnd });
  latest.current = { index, onDragStart, onDragMove, onDragEnd };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: () => latest.current.onDragStart(latest.current.index),
      onPanResponderMove: (_, g) => latest.current.onDragMove(latest.current.index, g.dy),
      onPanResponderRelease: (_, g) => latest.current.onDragEnd(latest.current.index, g.dy),
      onPanResponderTerminate: (_, g) => latest.current.onDragEnd(latest.current.index, g.dy),
    })
  ).current;

  return (
    <Animated.View
      style={[
        styles.row,
        { top: index * SLOT, transform: [{ translateY: offset }] },
        dragging && styles.rowDragging,
      ]}
    >
      <View style={styles.pageNumber}>
        <Text style={styles.pageNumberText}>{index + 1}</Text>
      </View>
      {item.kind === 'image' ? (
        <Image source={{ uri: item.uri }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.fileThumb]}>
          <Ionicons name="document-text" size={22} color="#2563eb" />
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.kind}>{fileLabel(item)}</Text>
      </View>
      <TouchableOpacity
        onPress={() => onRemove(item.id)}
        hitSlop={8}
        style={styles.iconButton}
        accessibilityLabel={`Remove page ${index + 1}`}
      >
        <Ionicons name="close-circle" size={22} color="#ef4444" />
      </TouchableOpacity>
      <View
        {...responder.panHandlers}
        style={[styles.iconButton, styles.handle]}
        accessibilityLabel={`Drag to reorder page ${index + 1}`}
      >
        <Ionicons name="reorder-three" size={26} color="#6b7280" />
      </View>
    </Animated.View>
  );
};

/** Selected photos/files for a document, numbered in upload order; drag the handle to rearrange. */
const DocumentAttachmentList = ({ items, onReorder, onRemove, onDragActiveChange }: DocumentAttachmentListProps) => {
  const offsets = useRef(new Map<string, Animated.Value>()).current;
  const shifts = useRef(new Map<string, number>()).current;
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const offsetFor = (id: string) => {
    let value = offsets.get(id);
    if (!value) {
      value = new Animated.Value(0);
      offsets.set(id, value);
    }
    return value;
  };

  // Rows are positioned by index, so clear drag offsets before the reordered list paints
  useLayoutEffect(() => {
    offsets.forEach((value) => value.setValue(0));
    shifts.clear();
  }, [items, offsets, shifts]);

  const targetIndex = (from: number, dy: number) => clamp(from + Math.round(dy / SLOT), 0, items.length - 1);

  const handleDragStart = (index: number) => {
    setDraggingId(items[index].id);
    onDragActiveChange?.(true);
  };

  const handleDragMove = (from: number, dy: number) => {
    const maxDy = (items.length - 1 - from) * SLOT;
    offsetFor(items[from].id).setValue(clamp(dy, -from * SLOT, maxDy));
    const to = targetIndex(from, dy);
    items.forEach((item, i) => {
      if (i === from) return;
      const shift = from < to && i > from && i <= to ? -SLOT : to < from && i >= to && i < from ? SLOT : 0;
      if (shifts.get(item.id) === shift) return;
      shifts.set(item.id, shift);
      Animated.timing(offsetFor(item.id), { toValue: shift, duration: 150, useNativeDriver }).start();
    });
  };

  const handleDragEnd = (from: number, dy: number) => {
    setDraggingId(null);
    onDragActiveChange?.(false);
    const to = targetIndex(from, dy);
    if (to === from) {
      offsets.forEach((value) => value.setValue(0));
      shifts.clear();
      return;
    }
    offsetFor(items[from].id).setValue((to - from) * SLOT);
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorder(next);
  };

  if (!items.length) return null;

  return (
    <View style={styles.container}>
      <View style={[styles.list, { height: items.length * SLOT - ROW_GAP }]}>
        {items.map((item, index) => (
          <AttachmentRow
            key={item.id}
            item={item}
            index={index}
            offset={offsetFor(item.id)}
            dragging={draggingId === item.id}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
            onRemove={onRemove}
          />
        ))}
      </View>
      {items.length > 1 && (
        <Text style={styles.hint}>Drag ☰ to change the page order. Page 1 shows first.</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
  },
  list: {
    position: 'relative',
    ...(Platform.OS === 'web' && { userSelect: 'none' as any }),
  },
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  rowDragging: {
    zIndex: 10,
    borderColor: '#93c5fd',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  pageNumber: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
  },
  pageNumberText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#e5e7eb',
  },
  fileThumb: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  kind: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  iconButton: {
    padding: 4,
  },
  handle: {
    ...(Platform.OS === 'web' && { cursor: 'grab' as any, touchAction: 'none' as any }),
  },
  hint: {
    marginTop: 8,
    fontSize: 12,
    color: '#6b7280',
  },
});

export default DocumentAttachmentList;
