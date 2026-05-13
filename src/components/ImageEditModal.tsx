import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useDemoMutation } from '../hooks/useDemoMutation';
import { api } from '../../convex/_generated/api';
import { getUploadReadyImage } from '../utils/imageUpload';

interface ImageEditModalProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSave: (storageId: string) => Promise<void>;
  currentImageStorageId?: string | null;
}

const ImageEditModal: React.FC<ImageEditModalProps> = ({
  visible,
  title,
  onClose,
  onSave,
  currentImageStorageId,
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const generateUploadUrl = useDemoMutation(api.storage.generateUploadUrl);

  const modalOpacity = useRef(new Animated.Value(0)).current;
  const modalOverlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset selected image when opening
      setSelectedImage(null);
      animateModalIn();
    } else {
      animateModalOut();
    }
  }, [visible]);

  const animateModalIn = () => {
    Animated.parallel([
      Animated.timing(modalOverlayOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(modalOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  };

  const animateModalOut = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(modalOverlayOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(modalOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => callback?.());
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Permission to access camera roll is required!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images' as any,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Permission to access camera is required!');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const uploadImage = async (imageUri: string): Promise<string> => {
    try {
      const uploadUrl = await generateUploadUrl();
      const { blob, mimeType } = await getUploadReadyImage(imageUri);
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': mimeType },
        body: blob,
      });
      const { storageId } = await uploadResponse.json();
      return storageId;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw new Error('Failed to upload image');
    }
  };

  const handleSave = async () => {
    if (!selectedImage) {
      return;
    }

    try {
      setUploading(true);
      const storageId = await uploadImage(selectedImage);
      await onSave(storageId);
      animateModalOut(() => {
        setSelectedImage(null);
        onClose();
      });
    } catch (error) {
      console.error('Error saving image:', error);
      Alert.alert('Error', 'Failed to save image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    animateModalOut(() => {
      setSelectedImage(null);
      onClose();
    });
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <Animated.View style={[
          styles.overlay,
          { opacity: modalOverlayOpacity }
        ]}>
          <TouchableOpacity
            style={styles.overlayTouchable}
            activeOpacity={1}
            onPress={handleClose}
          />
          <Animated.View
            style={[
              styles.content,
              {
                opacity: modalOpacity,
              }
            ]}
          >
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <TouchableOpacity onPress={handleClose}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            <View style={styles.body}>
              <View style={styles.imagePickerContainer}>
                {selectedImage ? (
                  <View style={styles.imagePreviewContainer}>
                    <Image source={{ uri: selectedImage }} style={styles.imagePreview} resizeMode="cover" />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => setSelectedImage(null)}
                    >
                      <Ionicons name="close-circle" size={24} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.imagePickerButton}
                    onPress={pickImage}
                  >
                    <Ionicons name="image" size={32} color="#6b7280" />
                    <Text style={styles.imagePickerText}>Choose from Gallery</Text>
                  </TouchableOpacity>
                )}

                {!selectedImage && (
                  <TouchableOpacity
                    style={styles.cameraButton}
                    onPress={takePhoto}
                  >
                    <Ionicons name="camera" size={32} color="#6b7280" />
                    <Text style={styles.imagePickerText}>Take Photo</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={[styles.saveButton, (!selectedImage || uploading) && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={!selectedImage || uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    width: '90%',
    maxHeight: '90%',
    minHeight: '70%',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    paddingTop: 24,
    backgroundColor: '#f8fafc',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
    marginRight: 24,
  },
  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
    paddingBottom: 20,
  },
  imagePickerContainer: {
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  imagePickerButton: {
    width: '100%',
    height: 200,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  cameraButton: {
    width: '100%',
    height: 200,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  imagePickerText: {
    marginTop: 8,
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  imagePreviewContainer: {
    width: '100%',
    height: 200,
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 4,
  },
  saveButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#d1d5db',
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ImageEditModal;

