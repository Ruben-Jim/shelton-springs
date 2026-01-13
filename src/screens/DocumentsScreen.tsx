import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ImageBackground,
  Animated,
  Dimensions,
  Platform,
  Linking,
  ActivityIndicator,
  Image,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../context/AuthContext';
import BoardMemberIndicator from '../components/BoardMemberIndicator';
import DeveloperIndicator from '../components/DeveloperIndicator';
import CustomTabBar from '../components/CustomTabBar';
import MobileTabBar from '../components/MobileTabBar';
import { useStorageUrl } from '../hooks/useStorageUrl';
import CustomAlert from '../components/CustomAlert';
import { useCustomAlert } from '../hooks/useCustomAlert';
import MessagingButton from '../components/MessagingButton';
import { useMessaging } from '../context/MessagingContext';

const DocumentsScreen = () => {
  const { user } = useAuth();
  const { setShowOverlay } = useMessaging();
  const isBoardMember = user?.isBoardMember && user?.isActive;
  const { alertState, showAlert, hideAlert } = useCustomAlert();
  const [activeType, setActiveType] = useState<'Minutes' | 'Financial'>('Minutes');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<any>(null);
  const [documentForm, setDocumentForm] = useState({
    title: '',
    description: '',
    type: 'Minutes' as 'Minutes' | 'Financial',
  });
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'document' | 'image' | null>(null);

  // State for dynamic responsive behavior (only for web/desktop)
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  
  // Dynamic responsive check - show mobile nav when screen is too narrow for desktop nav
  // On mobile, always show mobile nav regardless of screen size
  const isMobileDevice = Platform.OS === 'ios' || Platform.OS === 'android';
  const showMobileNav = isMobileDevice || screenWidth < 1024;
  const showDesktopNav = !isMobileDevice && screenWidth >= 1024;

  // Animation values
  const uploadModalOpacity = useRef(new Animated.Value(0)).current;
  const uploadModalTranslateY = useRef(new Animated.Value(300)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  // Listen for window size changes (only on web/desktop)
  useEffect(() => {
    if (Platform.OS === 'web') {
      const subscription = Dimensions.addEventListener('change', ({ window }) => {
        setScreenWidth(window.width);
      });

      return () => subscription?.remove();
    }
  }, []);

  // Set initial cursor and cleanup on unmount (web only)
  useEffect(() => {
    if (Platform.OS === 'web') {
      document.body.style.cursor = 'grab';
      
      setTimeout(() => {
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({ y: 0, animated: false });
        }
      }, 100);
      
      return () => {
        document.body.style.cursor = 'default';
      };
    }
  }, [screenWidth, showMobileNav, showDesktopNav]);

  // Animation functions
  const animateModalIn = () => {
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(uploadModalOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(uploadModalTranslateY, {
        toValue: 0,
        tension: 100,
        friction: 8,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  };

  const animateModalOut = (callback: () => void) => {
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(uploadModalOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(uploadModalTranslateY, {
        toValue: 300,
        duration: 250,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      callback();
    });
  };

  // Convex queries
  const [documentsLimit, setDocumentsLimit] = useState(50);
  const documentsData = useQuery(api.documents.getPaginated, { limit: documentsLimit, offset: 0 });
  const allDocuments = documentsData?.items ?? [];
  const documents = allDocuments.filter((doc: any) => doc.type === activeType);

  // Convex mutations
  const createDocument = useMutation(api.documents.create);
  const deleteDocument = useMutation(api.documents.remove);
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedFile(result.assets[0]);
        setSelectedImage(null);
        setFileType('document');
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document. Please try again.');
    }
  };

  const handlePickImage = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to access your photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
        setSelectedFile(null);
        setFileType('image');
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleUploadDocument = async () => {
    if (!documentForm.title.trim()) {
      Alert.alert('Error', 'Please enter a document title.');
      return;
    }

    if (!selectedFile && !selectedImage) {
      Alert.alert('Error', 'Please select a document or photo.');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'Please sign in to upload documents.');
      return;
    }

    try {
      setUploading(true);

      // Upload file to Convex storage
      const uploadUrl = await generateUploadUrl();
      let blob: Blob;
      let mimeType: string;

      if (selectedFile) {
        // Handle document upload
        const response = await fetch(selectedFile.uri);
        blob = await response.blob();
        mimeType = blob.type || selectedFile.mimeType || 'application/pdf';
      } else if (selectedImage) {
        // Handle image upload
        const response = await fetch(selectedImage);
        blob = await response.blob();
        mimeType = blob.type || 'image/jpeg';
      } else {
        throw new Error('No file selected');
      }
      
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': mimeType },
        body: blob,
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      const { storageId } = await uploadResponse.json();

      // Create document record
      await createDocument({
        title: documentForm.title.trim(),
        description: documentForm.description.trim() || undefined,
        type: documentForm.type,
        fileStorageId: storageId,
        uploadedBy: `${user.firstName} ${user.lastName}`,
      });

      Alert.alert('Success', 'Document uploaded successfully!');
      
      // Reset form
      setDocumentForm({
        title: '',
        description: '',
        type: 'Minutes',
      });
      setSelectedFile(null);
      setSelectedImage(null);
      setFileType(null);
      
      animateModalOut(() => {
        setShowUploadModal(false);
      });
    } catch (error) {
      console.error('Error uploading document:', error);
      Alert.alert('Error', 'Failed to upload document. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = (document: any) => {
    setDocumentToDelete(document);
    setDeleteConfirmVisible(true);
  };

  const confirmDeleteDocument = async () => {
    if (!documentToDelete) return;
    
    setDeleteConfirmVisible(false);
    
    try {
      await deleteDocument({ id: documentToDelete._id });
      showAlert({
        title: 'Success',
        message: 'Document deleted successfully.',
        buttons: [{ text: 'OK', onPress: () => {} }],
        type: 'success'
      });
      setDocumentToDelete(null);
    } catch (error: any) {
      console.error('Error deleting document:', error);
      showAlert({
        title: 'Error',
        message: error?.message || 'Failed to delete document. Please try again.',
        buttons: [{ text: 'OK', onPress: () => {} }],
        type: 'error'
      });
    }
  };

  const cancelDeleteDocument = () => {
    setDeleteConfirmVisible(false);
    setDocumentToDelete(null);
  };


  // Helper component to get document URL
  const DocumentViewer = ({ storageId }: { storageId: string }) => {
    // Use cached storage URL hook to reduce API calls
    const fileUrl = useStorageUrl(storageId);

    if (fileUrl === undefined) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#2563eb" />
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={styles.viewButton}
        onPress={() => {
          if (fileUrl) {
            Linking.openURL(fileUrl);
          } else {
            Alert.alert('Error', 'Document URL not available.');
          }
        }}
      >
        <Ionicons name="eye" size={16} color="#2563eb" />
        <Text style={styles.viewButtonText}>View</Text>
      </TouchableOpacity>
    );
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Mobile Navigation */}
        {showMobileNav && (
          <MobileTabBar 
            isMenuOpen={isMenuOpen}
            onMenuClose={() => setIsMenuOpen(false)}
          />
        )}
        
        <ScrollView 
          ref={scrollViewRef}
          style={[styles.scrollContainer, Platform.OS === 'web' && styles.webScrollContainer]}
          contentContainerStyle={[styles.scrollContent, Platform.OS === 'web' && styles.webScrollContent]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={true}
          bounces={true}
          scrollEnabled={true}
          alwaysBounceVertical={false}
          nestedScrollEnabled={true}
          removeClippedSubviews={false}
          scrollEventThrottle={16}
          decelerationRate="normal"
          directionalLockEnabled={true}
          canCancelContentTouches={true}
          {...(Platform.OS === 'web' && {
            onScrollBeginDrag: () => {
              if (Platform.OS === 'web') {
                document.body.style.cursor = 'grabbing';
                document.body.style.userSelect = 'none';
              }
            },
            onScrollEndDrag: () => {
              if (Platform.OS === 'web') {
                document.body.style.cursor = 'grab';
                document.body.style.userSelect = 'auto';
              }
            },
            onScroll: () => {},
          })}
        >
          {/* Header */}
          <Animated.View
            style={[
              { opacity: fadeAnim },
              styles.headerContainerIOS
            ]}
          >
            <ImageBackground
              source={require('../../assets/hoa-4k.jpg')}
              style={[styles.header, !isBoardMember && styles.headerNonMember]}
              imageStyle={styles.headerImage}
              resizeMode="stretch"
            >
              <View style={styles.headerOverlay} />
                <View style={styles.headerTop}>
                {/* Hamburger Menu - Only when mobile nav is shown */}
                {showMobileNav && (
                  <TouchableOpacity
                    style={styles.menuButton}
                    onPress={() => setIsMenuOpen(true)}
                  >
                    <Ionicons name="menu" size={24} color="#ffffff" />
                  </TouchableOpacity>
                )}
                
                <View style={styles.headerLeft}>
                  <View style={styles.titleContainer}>
                    <Text style={styles.headerTitle}>Documents</Text>
                  </View>
                  <Text style={styles.headerSubtitle}>
                    Meeting minutes and financial records
                  </Text>
                  <View style={styles.indicatorsContainer}>
                    <DeveloperIndicator />
                    <BoardMemberIndicator />
                  </View>
                </View>

                {/* Spacer for non-board members to center the text */}
                {!isBoardMember && <View style={styles.headerSpacer} />}

                {/* Messaging Button - Board Members Only */}
                {isBoardMember && (
                  <View style={styles.headerRight}>
                    <MessagingButton onPress={() => setShowOverlay(true)} />
                  </View>
                )}
              </View>
            </ImageBackground>
          </Animated.View>

          {/* Custom Tab Bar - Only when screen is wide enough */}
          {showDesktopNav && (
            <Animated.View style={{ opacity: fadeAnim }}>
              <CustomTabBar />
            </Animated.View>
          )}

          {/* Type Tabs */}
          <View style={styles.typeTabsContainer}>
            <TouchableOpacity
              style={[styles.typeTab, activeType === 'Minutes' && styles.activeTypeTab]}
              onPress={() => setActiveType('Minutes')}
            >
              <Ionicons 
                name="clipboard" 
                size={18} 
                color={activeType === 'Minutes' ? '#06b6d4' : '#6b7280'} 
              />
              <Text style={[styles.typeTabText, activeType === 'Minutes' && styles.activeTypeTabText]}>
                Meeting Minutes ({allDocuments.filter((d: any) => d.type === 'Minutes').length})
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.typeTab, activeType === 'Financial' && styles.activeTypeTab]}
              onPress={() => setActiveType('Financial')}
            >
              <Ionicons 
                name="cash" 
                size={18} 
                color={activeType === 'Financial' ? '#10b981' : '#6b7280'} 
              />
              <Text style={[styles.typeTabText, activeType === 'Financial' && styles.activeTypeTabText]}>
                Financial Records ({allDocuments.filter((d: any) => d.type === 'Financial').length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Upload Button - Only for Board Members */}
          {isBoardMember && (
            <View style={styles.uploadButtonContainer}>
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={() => {
                  setDocumentForm({ ...documentForm, type: activeType });
                  setShowUploadModal(true);
                  animateModalIn();
                }}
              >
                <Ionicons name="cloud-upload" size={20} color="#ffffff" />
                <Text style={styles.uploadButtonText}>Upload Document</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Documents List */}
          <View style={styles.documentsContainer}>
            {documents.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons 
                  name={activeType === 'Minutes' ? 'clipboard-outline' : 'cash-outline'} 
                  size={64} 
                  color="#9ca3af" 
                />
                <Text style={styles.emptyStateText}>No {activeType === 'Minutes' ? 'meeting minutes' : 'financial records'} found</Text>
                <Text style={styles.emptyStateSubtext}>
                  {isBoardMember 
                    ? 'Upload documents to share with the community'
                    : 'Documents will appear here once uploaded by board members'}
                </Text>
              </View>
            ) : (
              documents.map((document: any) => (
                <View key={document._id} style={styles.documentCard}>
                  <View style={styles.documentCardHeader}>
                    <View style={styles.documentIconContainer}>
                      <Ionicons 
                        name="document-text" 
                        size={24} 
                        color={activeType === 'Minutes' ? '#06b6d4' : '#10b981'} 
                      />
                    </View>
                    <View style={styles.documentInfo}>
                      <Text style={styles.documentTitle}>{document.title}</Text>
                      <Text style={styles.documentDate}>
                        Uploaded {formatDate(document.createdAt)} by {document.uploadedBy}
                      </Text>
                      {document.description && (
                        <Text style={styles.documentDescription} numberOfLines={2}>
                          {document.description}
                        </Text>
                      )}
                    </View>
                  </View>
                  
                  <View style={styles.documentActions}>
                    <DocumentViewer storageId={document.fileStorageId} />
                    {isBoardMember && (
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDeleteDocument(document)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="trash" size={16} color="#ef4444" />
                        <Text style={styles.deleteButtonText}>Delete</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Spacer */}
          <View style={styles.spacer} />
        </ScrollView>

        {/* Upload Document Modal */}
        <Modal
          visible={showUploadModal}
          transparent={true}
          animationType="none"
          onRequestClose={() => animateModalOut(() => setShowUploadModal(false))}
        >
          <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]}>
            <Animated.View style={[
              styles.modalContent,
              {
                opacity: uploadModalOpacity,
                transform: [{ translateY: uploadModalTranslateY }],
              }
            ]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Upload Document</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => animateModalOut(() => setShowUploadModal(false))}
                >
                  <Ionicons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Document Type *</Text>
                  <View style={styles.typeSelector}>
                    <TouchableOpacity
                      style={[
                        styles.typeButton,
                        documentForm.type === 'Minutes' && styles.typeButtonSelected
                      ]}
                      onPress={() => setDocumentForm({ ...documentForm, type: 'Minutes' })}
                    >
                      <Ionicons name="clipboard" size={18} color={documentForm.type === 'Minutes' ? '#ffffff' : '#6b7280'} />
                      <Text style={[
                        styles.typeButtonText,
                        documentForm.type === 'Minutes' && styles.typeButtonTextSelected
                      ]}>
                        Meeting Minutes
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.typeButton,
                        documentForm.type === 'Financial' && styles.typeButtonSelected
                      ]}
                      onPress={() => setDocumentForm({ ...documentForm, type: 'Financial' })}
                    >
                      <Ionicons name="cash" size={18} color={documentForm.type === 'Financial' ? '#ffffff' : '#6b7280'} />
                      <Text style={[
                        styles.typeButtonText,
                        documentForm.type === 'Financial' && styles.typeButtonTextSelected
                      ]}>
                        Financial
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Title *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter document title"
                    value={documentForm.title}
                    onChangeText={(text) => setDocumentForm({ ...documentForm, title: text })}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Description (Optional)</Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    placeholder="Enter document description"
                    value={documentForm.description}
                    onChangeText={(text) => setDocumentForm({ ...documentForm, description: text })}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>File or Photo *</Text>
                  <View style={styles.filePickerRow}>
                    <TouchableOpacity
                      style={[styles.filePickerButton, styles.filePickerButtonHalf]}
                      onPress={handlePickDocument}
                    >
                      <Ionicons name="document-attach" size={20} color="#2563eb" />
                      <Text style={styles.filePickerText}>
                        Document
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.filePickerButton, styles.filePickerButtonHalf]}
                      onPress={handlePickImage}
                    >
                      <Ionicons name="image" size={20} color="#2563eb" />
                      <Text style={styles.filePickerText}>
                        Photo
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {selectedFile && (
                    <View style={styles.selectedFileContainer}>
                      <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                      <Text style={styles.selectedFileText} numberOfLines={1}>
                        {selectedFile.name}
                      </Text>
                      <TouchableOpacity onPress={() => {
                        setSelectedFile(null);
                        setFileType(null);
                      }}>
                        <Ionicons name="close-circle" size={20} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  )}
                  {selectedImage && (
                    <View style={styles.selectedFileContainer}>
                      <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                      <Text style={styles.selectedFileText} numberOfLines={1}>
                        Photo selected
                      </Text>
                      <TouchableOpacity onPress={() => {
                        setSelectedImage(null);
                        setFileType(null);
                      }}>
                        <Ionicons name="close-circle" size={20} color="#ef4444" />
                      </TouchableOpacity>
                      <Image
                        source={{ uri: selectedImage }}
                        style={styles.selectedImagePreview}
                      />
                    </View>
                  )}
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => animateModalOut(() => {
                    setShowUploadModal(false);
                    setSelectedFile(null);
                    setDocumentForm({ title: '', description: '', type: 'Minutes' });
                  })}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitButton, uploading && styles.submitButtonDisabled]}
                  onPress={handleUploadDocument}
                  disabled={uploading}
                >
                  {uploading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload" size={16} color="#ffffff" />
                      <Text style={styles.submitButtonText}>Upload</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </Animated.View>
          </Animated.View>
        </Modal>

        {/* Delete Confirmation Alert */}
        <CustomAlert
          visible={deleteConfirmVisible}
          title="Confirm Delete"
          message="Are you sure you want to delete this document? This action cannot be undone."
          type="warning"
          buttons={[
            { 
              text: 'Cancel', 
              style: 'cancel',
              onPress: cancelDeleteDocument
            },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: confirmDeleteDocument,
            },
          ]}
          onClose={cancelDeleteDocument}
        />

        {/* Success/Error Alert */}
        <CustomAlert
          visible={alertState.visible}
          title={alertState.title}
          message={alertState.message}
          type={alertState.type || 'info'}
          buttons={alertState.buttons || [{ text: 'OK', onPress: hideAlert }]}
          onClose={hideAlert}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  scrollContainer: {
    flex: 1,
  },
  webScrollContainer: {
    ...(Platform.OS === 'web' && {
      cursor: 'grab' as any,
      userSelect: 'none' as any,
      WebkitUserSelect: 'none' as any,
      MozUserSelect: 'none' as any,
      msUserSelect: 'none' as any,
      overflow: 'auto' as any,
      height: '100vh' as any,
      maxHeight: '100vh' as any,
      position: 'relative' as any,
    }),
  },
  scrollContent: {
    paddingBottom: 20,
  },
  webScrollContent: {
    ...(Platform.OS === 'web' && {
      minHeight: '100vh' as any,
      flexGrow: 1,
      paddingBottom: 100 as any,
    }),
  },
  spacer: {
    height: Platform.OS === 'web' ? 200 : 100,
  },
  headerContainerIOS: {
    width: Dimensions.get('window').width,
    alignSelf: 'stretch',
    overflow: 'hidden',
    marginLeft: 0,
    marginRight: 0,
    marginHorizontal: 0,
  },
  header: {
    height: 180,
    padding: 20,
    paddingTop: 40,
    paddingBottom: 20,
    position: 'relative',
    justifyContent: 'space-between',
    width: '100%',
    alignSelf: 'stretch',
  },
  headerNonMember: {
    height: 170,
    padding: 20,
    paddingTop: 40,
    paddingBottom: 20,
    position: 'relative',
    justifyContent: 'space-between',
    width: '100%',
    alignSelf: 'stretch',
  },
  headerImage: {
    borderRadius: 0,
    resizeMode: 'stretch',
    width: Dimensions.get('window').width,
    height: 240,
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    zIndex: 1,
    gap: 12,
  },
  headerRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 44, // Same width as MessagingButton (icon + padding)
  },
  menuButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    marginRight: 12,
  },
  headerLeft: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  indicatorsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
    textAlign: 'center',
  },
  headerSubtitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '400',
    opacity: 0.9,
    marginTop: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
    textAlign: 'center',
  },
  typeTabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 8,
  },
  typeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    gap: 6,
  },
  activeTypeTab: {
    backgroundColor: '#eff6ff',
  },
  typeTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeTypeTabText: {
    color: '#2563eb',
    fontWeight: '600',
  },
  uploadButtonContainer: {
    padding: 15,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 8,
  },
  uploadButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  documentsContainer: {
    padding: 15,
  },
  documentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  documentCardHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  documentIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  documentInfo: {
    flex: 1,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  documentDate: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 4,
  },
  documentDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  documentActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  viewButtonText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer' as any,
      userSelect: 'none' as any,
    }),
  },
  deleteButtonText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 8,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  modalForm: {
    maxHeight: 400,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    gap: 8,
  },
  typeButtonSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  typeButtonTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
    color: '#374151',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  filePickerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  filePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    backgroundColor: '#f9fafb',
    gap: 8,
  },
  filePickerButtonHalf: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  filePickerText: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '500',
  },
  selectedFileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f0fdf4',
    borderRadius: 6,
    gap: 8,
  },
  selectedImagePreview: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginTop: 8,
    marginLeft: 8,
  },
  selectedFileText: {
    flex: 1,
    fontSize: 14,
    color: '#059669',
    fontWeight: '500',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    gap: 6,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default DocumentsScreen;

