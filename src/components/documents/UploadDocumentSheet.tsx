import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  Platform,
  Alert,
  ActionSheetIOS,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../convex/_generated/api';
import { useGuardedMutation, isTestUserReadOnlyError } from '../../hooks/useGuardedMutation';
import { useAuth } from '../../context/AuthContext';
import { ensurePhotoLibraryAccess } from '../../utils/ensurePhotoLibraryAccess';
import {
  DOCUMENT_PICKER_TYPES,
  MAX_DOCUMENT_ATTACHMENTS,
  PendingAttachment,
  toPendingAttachment,
  uploadDocumentAttachments,
} from '../../utils/documentUpload';
import IosFormSheet from '../ios/IosFormSheet';
import IosNavBar from '../ios/IosNavBar';
import { IosSectionHeader } from '../ios/IosGroupedSection';
import { IOS_FORM_THEME as theme } from '../ios/iosFormTheme';
import DocumentAttachmentList from './DocumentAttachmentList';

export type DocumentType = 'Minutes' | 'Financial';

interface UploadDocumentSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Type preselected when the sheet opens (usually the tab the user is on). */
  initialType: DocumentType;
  onUploaded?: () => void;
}

const DESKTOP_MIN_WIDTH = 1024;

/** Upload form for Minutes/Financial documents: bottom sheet on phones and narrow web, centered card on desktop web. */
const UploadDocumentSheet = ({ visible, onClose, initialType, onUploaded }: UploadDocumentSheetProps) => {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const useDesktopModal = Platform.OS === 'web' && width >= DESKTOP_MIN_WIDTH;

  const createDocument = useGuardedMutation(api.documents.create);
  const generateUploadUrl = useGuardedMutation(api.storage.generateUploadUrl);

  const [type, setType] = useState<DocumentType>(initialType);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setType(initialType);
    setTitle('');
    setDescription('');
    setAttachments([]);
    setError(null);
  }, [visible, initialType]);

  const remainingSlots = MAX_DOCUMENT_ATTACHMENTS - attachments.length;

  const addAttachments = (picked: PendingAttachment[]) => {
    if (!picked.length) return;
    const next = [...attachments, ...picked];
    setError(
      next.length > MAX_DOCUMENT_ATTACHMENTS
        ? `Only the first ${MAX_DOCUMENT_ATTACHMENTS} files or photos were kept.`
        : null
    );
    setAttachments(next.slice(0, MAX_DOCUMENT_ATTACHMENTS));
  };

  const pickFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: DOCUMENT_PICKER_TYPES,
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (!result.canceled) addAttachments(result.assets.map(toPendingAttachment));
    } catch {
      setError('Could not open files. Please try again.');
    }
  };

  const pickPhotos = async () => {
    try {
      const allowed = await ensurePhotoLibraryAccess();
      if (!allowed) return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        allowsMultipleSelection: true,
        orderedSelection: true,
        selectionLimit: remainingSlots,
        quality: 1,
      });
      if (!result.canceled) addAttachments(result.assets.map(toPendingAttachment));
    } catch {
      setError('Could not open your photos. Please try again.');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow camera access to take a photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 1 });
      if (!result.canceled) addAttachments(result.assets.map(toPendingAttachment));
    } catch {
      setError('Could not open the camera. Please try again.');
    }
  };

  const handleAddPress = () => {
    if (remainingSlots <= 0) {
      setError(`A document can have up to ${MAX_DOCUMENT_ATTACHMENTS} files or photos.`);
      return;
    }
    // The browser's file chooser already offers photos, camera and files in one place
    if (Platform.OS === 'web') {
      void pickFiles();
      return;
    }
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Photo Library', 'Take Photo', 'Browse Files', 'Cancel'], cancelButtonIndex: 3 },
        (index) => {
          if (index === 0) void pickPhotos();
          if (index === 1) void takePhoto();
          if (index === 2) void pickFiles();
        }
      );
      return;
    }
    Alert.alert(
      'Add files or photos',
      undefined,
      [
        { text: 'Browse Files', onPress: () => void pickFiles() },
        { text: 'Take Photo', onPress: () => void takePhoto() },
        { text: 'Photo Library', onPress: () => void pickPhotos() },
      ],
      { cancelable: true }
    );
  };

  const handleUpload = async () => {
    if (!title.trim()) {
      setError('Please enter a document title.');
      return;
    }
    if (!attachments.length) {
      setError('Please add at least one file or photo.');
      return;
    }
    if (!user) {
      setError('Please sign in to upload documents.');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      const uploaded = await uploadDocumentAttachments(generateUploadUrl, attachments);
      const allPhotos = uploaded.every((a) => a.kind === 'image');
      await createDocument({
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        fileStorageId: uploaded[0].storageId,
        // Older app versions only understand photo-only pages
        imageStorageIds: allPhotos && uploaded.length > 1 ? uploaded.map((a) => a.storageId) : undefined,
        attachments: uploaded.length > 1 ? uploaded : undefined,
        uploadedBy: `${user.firstName} ${user.lastName}`,
      });
      onUploaded?.();
      onClose();
    } catch (err: any) {
      if (isTestUserReadOnlyError(err)) return;
      setError(err?.message || 'Failed to upload document. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const canSubmit = Boolean(title.trim() && attachments.length);

  // Desktop web gets a plain labeled form; phones and narrow web use iOS grouped-sheet styling
  const sectionLabel = (iosTitle: string, desktopTitle: string) =>
    useDesktopModal ? (
      <Text style={styles.desktopLabel}>{desktopTitle}</Text>
    ) : (
      <IosSectionHeader title={iosTitle} />
    );

  const form = (
    <ScrollView
      style={useDesktopModal ? styles.desktopScroll : styles.scroll}
      contentContainerStyle={useDesktopModal ? styles.desktopScrollContent : styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      scrollEnabled={!dragActive}
    >
      {sectionLabel('TYPE', 'Document Type *')}
      <View style={styles.segment}>
        {(['Minutes', 'Financial'] as const).map((option) => {
          const selected = type === option;
          return (
            <TouchableOpacity
              key={option}
              style={[
                styles.segmentButton,
                useDesktopModal && styles.desktopSegmentButton,
                selected && styles.segmentButtonSelected,
              ]}
              onPress={() => setType(option)}
            >
              <Ionicons
                name={option === 'Minutes' ? 'clipboard' : 'cash'}
                size={16}
                color={selected ? '#ffffff' : theme.textSecondary}
              />
              <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                {option === 'Minutes' ? 'Meeting Minutes' : 'Financial'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {useDesktopModal ? (
        <>
          <Text style={styles.desktopLabel}>Title *</Text>
          <TextInput
            style={styles.desktopInput}
            placeholder="Enter document title"
            placeholderTextColor={theme.textTertiary}
            value={title}
            onChangeText={setTitle}
            autoCapitalize="words"
          />
          <Text style={styles.desktopLabel}>Description (Optional)</Text>
          <TextInput
            style={[styles.desktopInput, styles.textArea]}
            placeholder="Enter document description"
            placeholderTextColor={theme.textTertiary}
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />
        </>
      ) : (
        <>
          <IosSectionHeader title="DETAILS" />
          <View style={styles.card}>
            <TextInput
              style={styles.input}
              placeholder="Title"
              placeholderTextColor={theme.textTertiary}
              value={title}
              onChangeText={setTitle}
              autoCapitalize="words"
            />
            <View style={styles.separator} />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description (optional)"
              placeholderTextColor={theme.textTertiary}
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
            />
          </View>
        </>
      )}

      {sectionLabel('FILES & PHOTOS', 'Files & Photos *')}
      <TouchableOpacity
        style={[
          styles.addButton,
          useDesktopModal && styles.desktopAddButton,
          remainingSlots <= 0 && styles.addButtonDisabled,
        ]}
        onPress={handleAddPress}
        disabled={uploading}
      >
        <Ionicons name="cloud-upload-outline" size={22} color={theme.accent} />
        <View>
          <Text style={styles.addButtonText}>
            {attachments.length ? 'Add more files or photos' : 'Add files or photos'}
          </Text>
          <Text style={styles.addButtonSubtext}>
            PDF, Word or images · {attachments.length} of {MAX_DOCUMENT_ATTACHMENTS}
          </Text>
        </View>
      </TouchableOpacity>
      <DocumentAttachmentList
        items={attachments}
        onReorder={setAttachments}
        onRemove={(id) => setAttachments((prev) => prev.filter((a) => a.id !== id))}
        onDragActiveChange={setDragActive}
      />

      {error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={18} color={theme.destructive} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </ScrollView>
  );

  if (useDesktopModal) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.desktopOverlay}>
          <TouchableOpacity style={styles.desktopBackdrop} activeOpacity={1} onPress={onClose} />
          <View style={styles.desktopCard}>
            <View style={styles.desktopHeader}>
              <Text style={styles.desktopTitle}>Upload Document</Text>
              <TouchableOpacity onPress={onClose} style={styles.desktopClose} accessibilityLabel="Close">
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            {form}
            <View style={styles.desktopFooter}>
              <TouchableOpacity style={styles.desktopCancel} onPress={onClose} disabled={uploading}>
                <Text style={styles.desktopCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.desktopSubmit, (!canSubmit || uploading) && styles.desktopSubmitDisabled]}
                onPress={handleUpload}
                disabled={!canSubmit || uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Ionicons name="cloud-upload" size={16} color="#ffffff" />
                )}
                <Text style={styles.desktopSubmitText}>{uploading ? 'Uploading…' : 'Upload'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <IosFormSheet visible={visible} onClose={onClose}>
      <View style={styles.body}>
        <IosNavBar
          title="Upload Document"
          onCancel={onClose}
          onConfirm={handleUpload}
          confirmLabel="Upload"
          confirmDisabled={!canSubmit}
          loading={uploading}
          loadingLabel="Uploading…"
        />
        {form}
      </View>
    </IosFormSheet>
  );
};

const styles = StyleSheet.create({
  body: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  segment: {
    flexDirection: 'row',
    gap: 10,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.separator,
  },
  segmentButtonSelected: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.textSecondary,
  },
  segmentTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  card: {
    backgroundColor: theme.card,
    borderRadius: 12,
    overflow: 'hidden',
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.textPrimary,
  },
  textArea: {
    minHeight: 80,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.separator,
    marginLeft: 14,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#93c5fd',
    backgroundColor: theme.card,
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.accent,
  },
  addButtonSubtext: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#fef2f2',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: theme.destructive,
  },
  desktopOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 24,
  },
  desktopBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  desktopCard: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '88%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
  },
  desktopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  desktopTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  desktopClose: {
    padding: 4,
    cursor: 'pointer' as any,
  },
  desktopScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  desktopScrollContent: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 24,
  },
  desktopLabel: {
    marginTop: 20,
    marginBottom: 8,
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  desktopSegmentButton: {
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
    cursor: 'pointer' as any,
  },
  desktopInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.textPrimary,
    backgroundColor: '#ffffff',
  },
  desktopAddButton: {
    backgroundColor: '#f9fafb',
    cursor: 'pointer' as any,
  },
  desktopFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  desktopCancel: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    cursor: 'pointer' as any,
  },
  desktopCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  desktopSubmit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: theme.accent,
    cursor: 'pointer' as any,
  },
  desktopSubmitDisabled: {
    opacity: 0.5,
    cursor: 'default' as any,
  },
  desktopSubmitText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default UploadDocumentSheet;
