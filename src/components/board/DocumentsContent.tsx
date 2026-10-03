import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import { useGuardedMutation, isTestUserReadOnlyError } from '../../hooks/useGuardedMutation';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../context/AuthContext';
import CustomAlert from '../CustomAlert';
import { useCustomAlert } from '../../hooks/useCustomAlert';
import { DocumentView } from '../documents/DocumentViewButton';
import UploadDocumentSheet from '../documents/UploadDocumentSheet';
import LoadingState from '../LoadingState';
import { HOA_TAB_ACCENT, HOA_TAB_ACCENT_SOFT, HOA_TAB_ACCENT_TEXT } from '../../constants/hoaTheme';

interface DocumentsContentProps {
  isActive: boolean;
}

const DocumentsContent = ({ isActive }: DocumentsContentProps) => {
  const { user } = useAuth();
  const hasBoardAccess = Boolean(user?.isActive && (user?.isBoardMember || user?.isDev));
  const { alertState, showAlert, hideAlert } = useCustomAlert();
  const { width } = useWindowDimensions();
  // Matches BoardScreen's desktop nav breakpoint
  const isDesktop = Platform.OS === 'web' && width >= 1024;

  const [activeType, setActiveType] = useState<'Minutes' | 'Financial'>('Minutes');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<any>(null);

  const [documentsLimit] = useState(50);
  const documentsData = useQuery(
    api.documents.getPaginated,
    isActive ? { limit: documentsLimit, offset: 0 } : 'skip'
  );
  const allDocuments = documentsData?.items ?? [];
  const documents = allDocuments.filter((doc: any) => doc.type === activeType);

  const deleteDocument = useGuardedMutation(api.documents.remove);


  const confirmDeleteDocument = async () => {
    if (!documentToDelete) return;
    setDeleteConfirmVisible(false);
    try {
      await deleteDocument({ id: documentToDelete._id });
      showAlert({
        title: 'Success',
        message: 'Document deleted successfully.',
        buttons: [{ text: 'OK', onPress: () => {} }],
        type: 'success',
      });
      setDocumentToDelete(null);
    } catch (error: any) {
    if (isTestUserReadOnlyError(error)) return;
      showAlert({
        title: 'Error',
        message: error?.message || 'Failed to delete document. Please try again.',
        buttons: [{ text: 'OK', onPress: () => {} }],
        type: 'error',
      });
    }
  };

  const formatDate = (timestamp: number) =>
    new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  return (
    <View>
      {/* Type Tabs */}
      <View style={styles.typeTabsContainer}>
        <TouchableOpacity
          style={[styles.typeTab, activeType === 'Minutes' && styles.activeTypeTab]}
          onPress={() => setActiveType('Minutes')}
        >
          <Ionicons
            name="clipboard"
            size={18}
            color={activeType === 'Minutes' ? HOA_TAB_ACCENT : '#6b7280'}
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
            color={activeType === 'Financial' ? HOA_TAB_ACCENT : '#6b7280'}
          />
          <Text
            style={[styles.typeTabText, activeType === 'Financial' && styles.activeTypeTabText]}
          >
            Financial Records ({allDocuments.filter((d: any) => d.type === 'Financial').length})
          </Text>
        </TouchableOpacity>
        {hasBoardAccess && isDesktop && (
          <TouchableOpacity
            style={[styles.uploadButton, styles.uploadButtonDesktop]}
            onPress={() => setShowUploadModal(true)}
          >
            <Ionicons name="cloud-upload" size={18} color="#ffffff" />
            <Text style={[styles.uploadButtonText, styles.uploadButtonTextDesktop]}>Upload Document</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Upload Button - Board Members Only (full width on mobile; inline with the tabs on desktop) */}
      {hasBoardAccess && !isDesktop && (
        <View style={styles.uploadButtonContainer}>
          <TouchableOpacity style={styles.uploadButton} onPress={() => setShowUploadModal(true)}>
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
            <Text style={styles.emptyStateText}>
              No {activeType === 'Minutes' ? 'meeting minutes' : 'financial records'} found
            </Text>
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
                    onPress={() => {
                      setDocumentToDelete(document);
                      setDeleteConfirmVisible(true);
                    }}
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
            onPress: () => {
              setDeleteConfirmVisible(false);
              setDocumentToDelete(null);
            },
          },
          { text: 'Delete', style: 'destructive', onPress: confirmDeleteDocument },
        ]}
        onClose={() => {
          setDeleteConfirmVisible(false);
          setDocumentToDelete(null);
        }}
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
  );
};

const styles = StyleSheet.create({
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
    backgroundColor: HOA_TAB_ACCENT_SOFT,
  },
  typeTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeTypeTabText: {
    color: HOA_TAB_ACCENT_TEXT,
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
    backgroundColor: HOA_TAB_ACCENT,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 8,
    ...(Platform.OS === 'web' && { cursor: 'pointer' as any }),
  },
  uploadButtonDesktop: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  uploadButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  uploadButtonTextDesktop: {
    fontSize: 14,
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

export default DocumentsContent;
