import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { useQuery } from 'convex/react';
import { useGuardedMutation, isTestUserReadOnlyError } from '../hooks/useGuardedMutation';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../context/AuthContext';
import BoardMemberIndicator from '../components/BoardMemberIndicator';
import DeveloperIndicator from '../components/DeveloperIndicator';
import { DesktopTabBarSlot, useDesktopTabBarScrollSync } from '../components/DesktopTabBarLayer';
import { useWindowWidth } from '../hooks/useWindowWidth';
import DesktopContentWidth from '../components/DesktopContentWidth';
import MobileTabBar from '../components/MobileTabBar';
import CustomAlert from '../components/CustomAlert';
import { useCustomAlert } from '../hooks/useCustomAlert';
import MessagingButton from '../components/MessagingButton';
import { useMessaging } from '../context/MessagingContext';
import { DocumentView } from '../components/documents/DocumentViewButton';
import UploadDocumentSheet from '../components/documents/UploadDocumentSheet';
import LoadingState from '../components/LoadingState';
import {
  HERO_TAB_CONTAINER_STYLE,
  HERO_TAB_SAFE_AREA_EDGES,
  HERO_TAB_SAFE_AREA_STYLE,
} from '../hooks/useHeroHeaderPadding';
import TabHeroHeader from '../components/TabHeroHeader';

const DocumentsScreen = () => {
  const { user } = useAuth();
  const isFocused = useIsFocused();
  const { setShowOverlay } = useMessaging();
  const hasBoardAccess = Boolean(user?.isActive && (user?.isBoardMember || user?.isDev));
  const { alertState, showAlert, hideAlert } = useCustomAlert();
  const [activeType, setActiveType] = useState<'Minutes' | 'Financial'>('Minutes');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<any>(null);

  // State for dynamic responsive behavior (only for web/desktop)
  // Shared, frame-throttled width; paused while this screen sits under another one
  const screenWidth = useWindowWidth(isFocused);
  
  // Dynamic responsive check - show mobile nav when screen is too narrow for desktop nav
  // On mobile, always show mobile nav regardless of screen size
  const isMobileDevice = Platform.OS === 'ios' || Platform.OS === 'android';
  const showMobileNav = isMobileDevice || screenWidth < 1024;
  const showDesktopNav = !isMobileDevice && screenWidth >= 1024;

  // Animation values
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const syncDesktopTabBar = useDesktopTabBarScrollSync();

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
    // Mount only: re-running on resize scrolled the page back to the top
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Convex queries (conditional based on screen focus)
  const [documentsLimit, setDocumentsLimit] = useState(50);
  const documentsData = useQuery(
    api.documents.getPaginated,
    isFocused ? { limit: documentsLimit, offset: 0 } : "skip"
  );
  const allDocuments = documentsData?.items ?? [];
  const documents = allDocuments.filter((doc: any) => doc.type === activeType);

  // Convex mutations
  const deleteDocument = useGuardedMutation(api.documents.remove);

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
    if (isTestUserReadOnlyError(error)) return;
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



  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <SafeAreaView style={HERO_TAB_SAFE_AREA_STYLE} edges={HERO_TAB_SAFE_AREA_EDGES}>
      <View style={HERO_TAB_CONTAINER_STYLE}>
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
          showsVerticalScrollIndicator={false}
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
            onScroll: syncDesktopTabBar,
          })}
        >
          <TabHeroHeader
            screenWidth={screenWidth}
            showMobileNav={showMobileNav}
            hasBoardAccess={hasBoardAccess}
            onOpenMenu={() => setIsMenuOpen(true)}
            onOpenMessaging={() => setShowOverlay(true)}
            title="Documents"
            subtitle="Meeting minutes and financial records"
            animatedOpacity={fadeAnim}
          />

          {/* Custom Tab Bar - Only when screen is wide enough */}
          {showDesktopNav && (
            <Animated.View style={{ opacity: fadeAnim }}>
              <DesktopTabBarSlot />
            </Animated.View>
          )}

          <DesktopContentWidth enabled={showDesktopNav}>

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
          {hasBoardAccess && (
            <View style={styles.uploadButtonContainer}>
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={() => setShowUploadModal(true)}
              >
                <Ionicons name="cloud-upload" size={20} color="#ffffff" />
                <Text style={styles.uploadButtonText}>Upload Document</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Documents List */}
          <View style={styles.documentsContainer}>
            {documentsData === undefined ? (
              <LoadingState message="Loading documents…" />
            ) : documents.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons 
                  name={activeType === 'Minutes' ? 'clipboard-outline' : 'cash-outline'} 
                  size={64} 
                  color="#9ca3af" 
                />
                <Text style={styles.emptyStateText}>No {activeType === 'Minutes' ? 'meeting minutes' : 'financial records'} found</Text>
                <Text style={styles.emptyStateSubtext}>
                  {hasBoardAccess
                    ? 'Upload documents to share with the community'
                    : 'Documents will appear here once uploaded by board members'}
                </Text>
              </View>
            ) : (
              documents.map((document: any) => (
                <DocumentView key={document._id} document={document}>
                {({ pagesBadge, viewButton }) => (
                <View style={styles.documentCard}>
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
                  {pagesBadge}
                    </View>
                  </View>
                  
                  <View style={styles.documentActions}>
                    {viewButton}
                    {hasBoardAccess && (
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
                )}
                </DocumentView>
              ))
            )}
          </View>

          </DesktopContentWidth>

          {/* Spacer */}
          <View style={styles.spacer} />
        </ScrollView>

        <UploadDocumentSheet
          visible={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          initialType={activeType}
          onUploaded={() =>
            showAlert({
              title: 'Success',
              message: 'Document uploaded successfully!',
              buttons: [{ text: 'OK', onPress: () => {} }],
              type: 'success',
            })
          }
        />

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
});

export default DocumentsScreen;

