import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
  Easing,
  ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { Id } from '../../../convex/_generated/dataModel';
import { useAuth } from '../../context/AuthContext';
import { useCachedHoaInfo } from '../../context/QueryCacheContext';
import { useStorageUrl } from '../../hooks/useStorageUrl';
import { isTestUserReadOnlyError } from '../../hooks/useGuardedMutation';
import { openDocument } from '../../utils/openDocument';

type UploadPhase = 'idle' | 'uploading' | 'saved';

const SAVED_HOLD_MS = 1800;

interface CcrsDocumentActionsProps {
  generateUploadUrl: () => Promise<string>;
  updateCcrsPdf: (args: {
    requesterId: Id<'residents'>;
    ccrsPdfStorageId: Id<'_storage'>;
  }) => Promise<unknown>;
  /** Stretch both buttons to share the full row width (phone layout) */
  fill?: boolean;
}

/**
 * Admin header actions for the community CC&Rs PDF: view the current document,
 * and upload a replacement. The upload button animates idle → uploading → saved
 * and then settles back to "Upload New CC&Rs".
 */
const CcrsDocumentActions = ({ generateUploadUrl, updateCcrsPdf, fill = false }: CcrsDocumentActionsProps) => {
  const { user } = useAuth();
  const hoaInfo = useCachedHoaInfo();
  const ccrsStorageId: string | undefined = hoaInfo?.ccrsPdfStorageId || undefined;
  const ccrsPdfUrl = useStorageUrl(ccrsStorageId || null);

  const [phase, setPhase] = useState<UploadPhase>('idle');

  // 0 = idle (blue), 1 = uploading (indigo), 2 = saved (green)
  const colorProgress = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const shakeX = useRef(new Animated.Value(0)).current;
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  const transitionTo = (next: UploadPhase) => {
    Animated.timing(contentOpacity, {
      toValue: 0,
      duration: 120,
      useNativeDriver: false,
    }).start(() => {
      setPhase(next);
      if (next === 'saved') {
        checkScale.setValue(0);
        Animated.spring(checkScale, {
          toValue: 1,
          friction: 4,
          tension: 120,
          useNativeDriver: false,
        }).start();
      }
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: false,
        }),
        Animated.timing(colorProgress, {
          toValue: next === 'idle' ? 0 : next === 'uploading' ? 1 : 2,
          duration: 260,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
      ]).start();
    });
  };

  const shake = () => {
    shakeX.setValue(0);
    Animated.sequence(
      [8, -8, 6, -6, 0].map((toValue) =>
        Animated.timing(shakeX, { toValue, duration: 50, useNativeDriver: false })
      )
    ).start();
  };

  const pulsePress = () => {
    Animated.sequence([
      Animated.timing(pressScale, { toValue: 0.95, duration: 80, useNativeDriver: false }),
      Animated.spring(pressScale, { toValue: 1, friction: 4, useNativeDriver: false }),
    ]).start();
  };

  const handleUpload = async () => {
    if (phase !== 'idle') return;
    pulsePress();

    const requesterId = user?._id as Id<'residents'> | undefined;
    if (!requesterId) {
      Alert.alert('Error', 'You must be signed in to upload the CC&Rs.');
      return;
    }

    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;

    const file = result.assets[0];
    if (!file) {
      Alert.alert('Error', 'No file selected.');
      return;
    }

    transitionTo('uploading');
    try {
      const uploadUrl = await generateUploadUrl();
      const fileResponse = await fetch(file.uri);
      const blob = await fileResponse.blob();

      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.mimeType || 'application/pdf' },
        body: blob,
      });
      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      const { storageId } = await uploadResponse.json();
      // Server swaps the file in and deletes the previous one atomically
      await updateCcrsPdf({ requesterId, ccrsPdfStorageId: storageId });

      transitionTo('saved');
      resetTimer.current = setTimeout(() => transitionTo('idle'), SAVED_HOLD_MS);
    } catch (error: any) {
      transitionTo('idle');
      if (isTestUserReadOnlyError(error)) return;
      shake();
      console.error('Error uploading CC&Rs PDF:', error);
      Alert.alert('Error', error?.message || 'Failed to upload CC&Rs PDF. Please try again.');
    }
  };

  const handleView = () => {
    if (!ccrsPdfUrl) {
      Alert.alert('Please wait', 'Loading document link…');
      return;
    }
    openDocument(ccrsPdfUrl).catch(() =>
      Alert.alert('Error', 'Unable to open PDF. Please try again.')
    );
  };

  const backgroundColor = colorProgress.interpolate({
    inputRange: [0, 1, 2],
    outputRange: ['#2563eb', '#6366f1', '#16a34a'],
  });

  const idleLabel = ccrsStorageId ? 'Upload New CC&Rs' : 'Upload CC&Rs';
  const viewLoading = !!ccrsStorageId && ccrsPdfUrl === undefined;

  return (
    <View style={[styles.row, fill && styles.rowFill]}>
      {ccrsStorageId && (
        <TouchableOpacity
          style={[styles.viewButton, fill && styles.buttonFill]}
          onPress={handleView}
          disabled={viewLoading}
          accessibilityRole="button"
          accessibilityLabel="View current CC&Rs document"
        >
          {viewLoading ? (
            <ActivityIndicator size="small" color="#2563eb" />
          ) : (
            <Ionicons name="document-text" size={18} color="#2563eb" />
          )}
          <Text style={[styles.viewButtonText, fill && styles.textFill]} numberOfLines={1}>
            View CC&Rs
          </Text>
        </TouchableOpacity>
      )}

      <Animated.View
        style={[
          fill && styles.uploadWrapperFill,
          { transform: [{ scale: pressScale }, { translateX: shakeX }] },
        ]}
      >
        <TouchableOpacity
          onPress={handleUpload}
          disabled={phase !== 'idle'}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={idleLabel}
          accessibilityState={{ busy: phase === 'uploading' }}
        >
          <Animated.View
            style={[styles.uploadButton, fill && styles.uploadButtonFill, { backgroundColor }]}
          >
            <Animated.View style={[styles.uploadContent, { opacity: contentOpacity }]}>
              {phase === 'uploading' && (
                <>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text style={[styles.uploadButtonText, fill && styles.textFill]} numberOfLines={1}>
                    Uploading…
                  </Text>
                </>
              )}
              {phase === 'saved' && (
                <>
                  <Animated.View style={{ transform: [{ scale: checkScale }] }}>
                    <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
                  </Animated.View>
                  <Text style={[styles.uploadButtonText, fill && styles.textFill]} numberOfLines={1}>
                    Saved
                  </Text>
                </>
              )}
              {phase === 'idle' && (
                <>
                  <Ionicons name="document-attach" size={20} color="#ffffff" />
                  <Text style={[styles.uploadButtonText, fill && styles.textFill]} numberOfLines={1}>
                    {idleLabel}
                  </Text>
                </>
              )}
            </Animated.View>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  rowFill: {
    width: '100%',
    flexWrap: 'nowrap',
  },
  buttonFill: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  uploadWrapperFill: {
    flex: 1,
  },
  uploadButtonFill: {
    minWidth: 0,
    paddingHorizontal: 8,
  },
  textFill: {
    fontSize: 13,
    flexShrink: 1,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 6,
  },
  viewButtonText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '600',
  },
  uploadButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 150,
    alignItems: 'center',
  },
  uploadContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 20,
  },
  uploadButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default CcrsDocumentActions;
