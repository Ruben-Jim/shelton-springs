import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import OptimizedImage from '../OptimizedImage';
import { AdminGrid, AdminGridItem } from './AdminGrid';
import { resolveDamageCategories } from '../../constants/damageCategories';
import { useAuth } from '../../context/AuthContext';
import CustomAlert from '../CustomAlert';
import { useCustomAlert } from '../../hooks/useCustomAlert';

type DamageStatus = 'Pending' | 'In Progress' | 'Resolved';

export type DamageReportItem = {
  _id: string;
  residentId: string;
  residentName: string;
  residentAddress?: string;
  category: string;
  description: string;
  photos?: string[];
  status: DamageStatus;
  adminNotes?: string;
  createdAt: number;
  updatedAt: number;
};

type DamageReportsPanelProps = {
  damageReports: DamageReportItem[];
  configuredCategories?: string[] | null;
  isDesktop: boolean;
};

const DAMAGE_STATUSES: DamageStatus[] = ['Pending', 'In Progress', 'Resolved'];
const STATUS_ORDER: Record<DamageStatus, number> = {
  Pending: 0,
  'In Progress': 1,
  Resolved: 2,
};

function getDamageStatusColor(status: string) {
  switch (status) {
    case 'Pending':
      return '#f59e0b';
    case 'In Progress':
      return '#3b82f6';
    case 'Resolved':
      return '#10b981';
    default:
      return '#6b7280';
  }
}

function matchesSearch(report: DamageReportItem, query: string) {
  const q = query.toLowerCase();
  return (
    report.residentName.toLowerCase().includes(q) ||
    (report.residentAddress ?? '').toLowerCase().includes(q) ||
    report.category.toLowerCase().includes(q) ||
    report.description.toLowerCase().includes(q) ||
    (report.adminNotes ?? '').toLowerCase().includes(q)
  );
}

function getNextStatus(status: DamageStatus): DamageStatus | null {
  if (status === 'Pending') return 'In Progress';
  if (status === 'In Progress') return 'Resolved';
  return null;
}

function getPrevStatus(status: DamageStatus): DamageStatus | null {
  if (status === 'Resolved') return 'In Progress';
  if (status === 'In Progress') return 'Pending';
  return null;
}

export default function DamageReportsPanel({
  damageReports,
  configuredCategories,
  isDesktop,
}: DamageReportsPanelProps) {
  const { user } = useAuth();
  const { alertState, showAlert, hideAlert } = useCustomAlert();
  const updateDamageReportStatus = useMutation(api.damageReports.updateStatus);
  const updateAdminNotes = useMutation(api.damageReports.updateAdminNotes);
  const updateDamageCategories = useMutation(api.damageReports.updateCategories);
  const removeDamageReport = useMutation(api.damageReports.remove);

  const [statusFilter, setStatusFilter] = useState<'All' | DamageStatus>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [notesEditing, setNotesEditing] = useState<Record<string, boolean>>({});
  const [updatingReportId, setUpdatingReportId] = useState<string | null>(null);
  const [savingNotesReportId, setSavingNotesReportId] = useState<string | null>(null);
  const [newDamageCategory, setNewDamageCategory] = useState('');
  const [savingDamageCategories, setSavingDamageCategories] = useState(false);
  const [lightboxPhotoId, setLightboxPhotoId] = useState<string | null>(null);
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);

  const configuredDamageCategories = useMemo(
    () => resolveDamageCategories(configuredCategories),
    [configuredCategories]
  );

  const statusCounts = useMemo(() => {
    const counts: Record<DamageStatus, number> = {
      Pending: 0,
      'In Progress': 0,
      Resolved: 0,
    };
    damageReports.forEach((report) => {
      counts[report.status] += 1;
    });
    return counts;
  }, [damageReports]);

  const processedReports = useMemo(() => {
    let list = [...damageReports];
    if (statusFilter !== 'All') {
      list = list.filter((report) => report.status === statusFilter);
    }
    if (searchQuery.trim()) {
      list = list.filter((report) => matchesSearch(report, searchQuery));
    }
    list.sort((a, b) => {
      const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (statusDiff !== 0) return statusDiff;
      return b.createdAt - a.createdAt;
    });
    return list;
  }, [damageReports, statusFilter, searchQuery]);

  const reportsByStatus = useMemo(() => {
    const grouped: Record<DamageStatus, DamageReportItem[]> = {
      Pending: [],
      'In Progress': [],
      Resolved: [],
    };
    let list = [...damageReports];
    if (searchQuery.trim()) {
      list = list.filter((report) => matchesSearch(report, searchQuery));
    }
    list.sort((a, b) => b.createdAt - a.createdAt);
    list.forEach((report) => {
      grouped[report.status].push(report);
    });
    return grouped;
  }, [damageReports, searchQuery]);

  const showKanban = isDesktop && statusFilter === 'All';

  const handleAddDamageCategory = async () => {
    const trimmed = newDamageCategory.trim();
    if (!trimmed) {
      Alert.alert('Category required', 'Enter a category name.');
      return;
    }
    if (trimmed.length > 40) {
      Alert.alert('Too long', 'Category names must be 40 characters or fewer.');
      return;
    }
    if (
      configuredDamageCategories.some(
        (category) => category.toLowerCase() === trimmed.toLowerCase()
      )
    ) {
      Alert.alert('Duplicate', 'That category already exists.');
      return;
    }

    setSavingDamageCategories(true);
    try {
      await updateDamageCategories({
        categories: [...configuredDamageCategories, trimmed],
      });
      setNewDamageCategory('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add category');
    } finally {
      setSavingDamageCategories(false);
    }
  };

  const handleRemoveDamageCategory = (category: string) => {
    if (configuredDamageCategories.length <= 1) {
      Alert.alert('Cannot remove', 'At least one damage category is required.');
      return;
    }

    Alert.alert('Remove category', `Remove "${category}" from report options?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setSavingDamageCategories(true);
          try {
            await updateDamageCategories({
              categories: configuredDamageCategories.filter((entry) => entry !== category),
            });
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to remove category');
          } finally {
            setSavingDamageCategories(false);
          }
        },
      },
    ]);
  };

  const handleUpdateStatus = async (reportId: string, status: DamageStatus) => {
    try {
      setUpdatingReportId(reportId);
      const draft = notesDraft[reportId];
      await updateDamageReportStatus({
        reportId: reportId as any,
        status,
        ...(draft !== undefined ? { adminNotes: draft.trim() || undefined } : {}),
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update damage report');
    } finally {
      setUpdatingReportId(null);
    }
  };

  const handleSaveNotes = async (reportId: string) => {
    try {
      setSavingNotesReportId(reportId);
      await updateAdminNotes({
        reportId: reportId as any,
        adminNotes: notesDraft[reportId]?.trim() || undefined,
      });
      setNotesEditing((prev) => ({ ...prev, [reportId]: false }));
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save notes');
    } finally {
      setSavingNotesReportId(null);
    }
  };

  const startEditingNotes = (report: DamageReportItem) => {
    setNotesDraft((prev) => ({
      ...prev,
      [report._id]: prev[report._id] ?? report.adminNotes ?? '',
    }));
    setNotesEditing((prev) => ({ ...prev, [report._id]: true }));
  };

  const cancelEditingNotes = (reportId: string) => {
    setNotesEditing((prev) => ({ ...prev, [reportId]: false }));
    setNotesDraft((prev) => {
      const next = { ...prev };
      delete next[reportId];
      return next;
    });
  };

  const confirmDeleteReport = (report: DamageReportItem) => {
    showAlert({
      title: 'Delete damage report?',
      message: `Remove the ${report.category} report from ${report.residentName}? This cannot be undone.`,
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => handleDeleteReport(report._id),
        },
      ],
    });
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!user?._id) {
      showAlert({
        title: 'Error',
        message: 'Please sign in to delete this report',
        type: 'error',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }

    try {
      setDeletingReportId(reportId);
      await removeDamageReport({
        reportId: reportId as any,
        requesterId: user._id,
        asAdmin: true,
      });
    } catch (error: any) {
      showAlert({
        title: 'Error',
        message: error.message || 'Failed to delete damage report',
        type: 'error',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    } finally {
      setDeletingReportId(null);
    }
  };

  const renderDeleteButton = (report: DamageReportItem) => {
    const isDeleting = deletingReportId === report._id;

    return (
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => confirmDeleteReport(report)}
        disabled={isDeleting || updatingReportId === report._id}
      >
        {isDeleting ? (
          <ActivityIndicator size="small" color="#dc2626" />
        ) : (
          <>
            <Ionicons name="trash-outline" size={15} color="#dc2626" />
            <Text style={styles.deleteButtonText}>Delete</Text>
          </>
        )}
      </TouchableOpacity>
    );
  };

  const renderStatusSegment = (report: DamageReportItem, compact?: boolean, mobile?: boolean) => {
    const isUpdating = updatingReportId === report._id;

    return (
      <View
        style={[
          styles.statusSegment,
          compact && styles.statusSegmentCompact,
          mobile && styles.statusSegmentMobile,
        ]}
      >
        {DAMAGE_STATUSES.map((status) => {
          const isActive = report.status === status;
          const color = getDamageStatusColor(status);
          return (
            <TouchableOpacity
              key={status}
              style={[
                styles.statusSegmentButton,
                compact && styles.statusSegmentButtonCompact,
                mobile && styles.statusSegmentButtonMobile,
                isActive && {
                  backgroundColor: color,
                  borderColor: color,
                },
              ]}
              disabled={isUpdating}
              onPress={() => {
                if (!isActive) {
                  handleUpdateStatus(report._id, status);
                }
              }}
            >
              {isUpdating && isActive ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text
                  style={[
                    styles.statusSegmentText,
                    compact && styles.statusSegmentTextCompact,
                    mobile && styles.statusSegmentTextMobile,
                    isActive && styles.statusSegmentTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {status}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderKanbanActions = (report: DamageReportItem) => {
    const next = getNextStatus(report.status);
    const prev = getPrevStatus(report.status);
    const isUpdating = updatingReportId === report._id;

    return (
      <View style={styles.kanbanActions}>
        {prev ? (
          <TouchableOpacity
            style={styles.kanbanActionSecondary}
            disabled={isUpdating}
            onPress={() => handleUpdateStatus(report._id, prev)}
          >
            <Ionicons name="arrow-back" size={14} color="#6b7280" />
            <Text style={styles.kanbanActionSecondaryText}>{prev}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.kanbanActionSpacer} />
        )}
        {next ? (
          <TouchableOpacity
            style={[
              styles.kanbanActionPrimary,
              { backgroundColor: getDamageStatusColor(next) },
            ]}
            disabled={isUpdating}
            onPress={() => handleUpdateStatus(report._id, next)}
          >
            {isUpdating ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Text style={styles.kanbanActionPrimaryText}>
                  {next === 'In Progress' ? 'Start Work' : 'Mark Resolved'}
                </Text>
                <Ionicons name="arrow-forward" size={14} color="#ffffff" />
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.kanbanActionSecondary}
            disabled={isUpdating}
            onPress={() => handleUpdateStatus(report._id, 'Pending')}
          >
            <Ionicons name="refresh" size={14} color="#6b7280" />
            <Text style={styles.kanbanActionSecondaryText}>Reopen</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderNotesSection = (report: DamageReportItem, compact?: boolean) => {
    const isEditing = notesEditing[report._id];
    const savedNotes = report.adminNotes?.trim();
    const draftValue = notesDraft[report._id] ?? savedNotes ?? '';
    const isSaving = savingNotesReportId === report._id;

    return (
      <View style={styles.notesSection}>
        <Text style={styles.notesLabel}>Admin notes</Text>
        {!isEditing ? (
          <View style={styles.notesReadOnly}>
            {savedNotes ? (
              <Text style={[styles.notesSavedText, compact && styles.notesSavedTextCompact]} numberOfLines={compact ? 3 : undefined}>
                {savedNotes}
              </Text>
            ) : (
              <Text style={styles.notesEmptyText}>No admin notes yet</Text>
            )}
            <TouchableOpacity
              style={styles.notesEditButton}
              onPress={() => startEditingNotes(report)}
            >
              <Ionicons name={savedNotes ? 'create-outline' : 'add-circle-outline'} size={14} color="#3b82f6" />
              <Text style={styles.notesEditButtonText}>{savedNotes ? 'Edit note' : 'Add note'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.notesEditing}>
            <TextInput
              style={[styles.notesInput, compact && styles.notesInputCompact]}
              placeholder="Optional notes for the resident..."
              placeholderTextColor="#9ca3af"
              value={draftValue}
              onChangeText={(text) =>
                setNotesDraft((prev) => ({ ...prev, [report._id]: text }))
              }
              multiline
              textAlignVertical="top"
            />
            <View style={styles.notesEditingActions}>
              <TouchableOpacity
                style={styles.notesCancelButton}
                onPress={() => cancelEditingNotes(report._id)}
                disabled={isSaving}
              >
                <Text style={styles.notesCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.notesSaveButton, isSaving && styles.notesSaveButtonDisabled]}
                onPress={() => handleSaveNotes(report._id)}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.notesSaveButtonText}>Save note</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderPhotos = (report: DamageReportItem, variant: 'kanban' | 'list') => {
    if (!report.photos?.length) return null;

    const thumbStyle =
      variant === 'kanban'
        ? styles.photoThumbCompact
        : isDesktop
          ? styles.photoThumbDesktop
          : styles.photoThumbMobile;

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosRow}>
        {report.photos.map((photoId, index) => (
          <TouchableOpacity
            key={`${report._id}-${index}`}
            style={[styles.photoThumb, thumbStyle]}
            onPress={() => setLightboxPhotoId(photoId)}
            activeOpacity={0.85}
          >
            <OptimizedImage
              storageId={photoId}
              style={styles.photoImage}
              contentFit="cover"
              priority="high"
            />
            {(isDesktop || variant === 'list') && (
              <View style={styles.photoExpandHint}>
                <Ionicons name="expand-outline" size={12} color="#ffffff" />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const renderReportCard = (report: DamageReportItem, variant: 'kanban' | 'list') => {
    const isKanban = variant === 'kanban';
    const isMobileList = !isDesktop && !isKanban;
    const showHeaderStatus = isKanban;

    return (
      <View
        key={report._id}
        style={[
          styles.reportCard,
          isDesktop && !isKanban && styles.reportCardDesktopSplit,
          isKanban && styles.reportCardKanban,
          isMobileList && styles.reportCardMobile,
        ]}
      >
        <View style={[styles.reportCardContent, isDesktop && !isKanban && styles.reportCardContentSplit]}>
          <View style={[styles.reportHeader, isMobileList && styles.reportHeaderMobile]}>
            <View style={styles.reportHeaderLeft}>
              <Text style={styles.reportResident} numberOfLines={1}>
                {report.residentName}
              </Text>
              {report.residentAddress ? (
                <Text style={styles.reportAddress} numberOfLines={1}>
                  {report.residentAddress}
                </Text>
              ) : null}
              {isMobileList ? (
                <View style={styles.reportMetaRow}>
                  <View style={styles.categoryBadge}>
                    <Ionicons name="construct" size={13} color="#f97316" />
                    <Text style={styles.categoryText}>{report.category}</Text>
                  </View>
                </View>
              ) : null}
            </View>
            {!isMobileList ? (
              <View style={styles.reportHeaderMeta}>
                <View style={styles.categoryBadge}>
                  <Ionicons name="construct" size={13} color="#f97316" />
                  <Text style={styles.categoryText}>{report.category}</Text>
                </View>
                {showHeaderStatus ? (
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: `${getDamageStatusColor(report.status)}18` },
                    ]}
                  >
                    <Text
                      style={[styles.statusPillText, { color: getDamageStatusColor(report.status) }]}
                    >
                      {report.status}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>

          <Text
            style={styles.reportDescription}
            numberOfLines={isKanban ? 4 : undefined}
          >
            {report.description}
          </Text>
          <Text style={styles.reportDate}>
            Reported {new Date(report.createdAt).toLocaleDateString()}
          </Text>
          {renderPhotos(report, variant)}

          {isKanban && (
            <View style={styles.reportCardFooter}>
              {renderNotesSection(report, true)}
              {renderKanbanActions(report)}
              {renderDeleteButton(report)}
            </View>
          )}

          {isMobileList && (
            <View style={styles.reportCardFooter}>
              {renderNotesSection(report)}
              {renderStatusSegment(report, false, true)}
              {renderDeleteButton(report)}
            </View>
          )}
        </View>

        {isDesktop && !isKanban && (
          <View style={styles.reportCardActions}>
            {renderStatusSegment(report, true)}
            {renderNotesSection(report)}
            {renderDeleteButton(report)}
          </View>
        )}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="construct-outline" size={48} color="#9ca3af" />
      <Text style={styles.emptyStateText}>No damage reports found</Text>
      <Text style={styles.emptyStateSubtext}>
        {searchQuery.trim()
          ? 'Try a different search term or filter'
          : 'Reports from residents will appear here'}
      </Text>
    </View>
  );

  return (
    <>
      <TouchableOpacity
        style={styles.categoriesToggle}
        onPress={() => setCategoriesExpanded((prev) => !prev)}
        activeOpacity={0.85}
      >
        <View style={styles.categoriesToggleLeft}>
          <Ionicons
            name={categoriesExpanded ? 'chevron-down' : 'chevron-forward'}
            size={18}
            color="#6b7280"
          />
          <Text style={styles.categoriesToggleTitle}>Manage Categories</Text>
        </View>
        <Text style={styles.categoriesToggleMeta}>
          {configuredDamageCategories.length} categor{configuredDamageCategories.length === 1 ? 'y' : 'ies'}
        </Text>
      </TouchableOpacity>

      {categoriesExpanded && (
        <View style={styles.categoriesSection}>
          <Text style={styles.categoriesHint}>
            Residents choose from these when filing a damage report.
          </Text>
          <View style={styles.categoriesList}>
            {configuredDamageCategories.map((category) => (
              <View key={category} style={styles.categoryChip}>
                <Text style={styles.categoryChipText}>{category}</Text>
                <TouchableOpacity
                  onPress={() => handleRemoveDamageCategory(category)}
                  disabled={savingDamageCategories || configuredDamageCategories.length <= 1}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={configuredDamageCategories.length <= 1 ? '#d1d5db' : '#f97316'}
                  />
                </TouchableOpacity>
              </View>
            ))}
          </View>
          <View style={styles.categoryAddRow}>
            <TextInput
              style={styles.categoryInput}
              placeholder="New category"
              placeholderTextColor="#9ca3af"
              value={newDamageCategory}
              onChangeText={setNewDamageCategory}
              maxLength={40}
              editable={!savingDamageCategories}
              onSubmitEditing={handleAddDamageCategory}
            />
            <TouchableOpacity
              style={[
                styles.categoryAddButton,
                savingDamageCategories && styles.categoryAddButtonDisabled,
              ]}
              onPress={handleAddDamageCategory}
              disabled={savingDamageCategories}
            >
              {savingDamageCategories ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="add" size={18} color="#ffffff" />
                  <Text style={styles.categoryAddButtonText}>Add</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.summaryRow}>
        <Text style={styles.summaryTitle}>Damage Reports</Text>
        <Text style={styles.summaryCounts}>
          {statusCounts.Pending} pending · {statusCounts['In Progress']} in progress ·{' '}
          {statusCounts.Resolved} resolved
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#6b7280" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by resident, address, category, or description..."
          placeholderTextColor="#9ca3af"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.searchClear}>
            <Ionicons name="close-circle" size={18} color="#6b7280" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        {(['All', ...DAMAGE_STATUSES] as const).map((filter) => {
          const count =
            filter === 'All'
              ? damageReports.length
              : statusCounts[filter as DamageStatus];
          return (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterButton,
                statusFilter === filter && styles.filterButtonActive,
                filter !== 'All' &&
                  statusFilter === filter && {
                    backgroundColor: `${getDamageStatusColor(filter)}14`,
                    borderColor: getDamageStatusColor(filter),
                  },
              ]}
              onPress={() => setStatusFilter(filter)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  statusFilter === filter && styles.filterButtonTextActive,
                  filter !== 'All' &&
                    statusFilter === filter && { color: getDamageStatusColor(filter) },
                ]}
              >
                {filter} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {showKanban ? (
        processedReports.length > 0 ? (
          <View style={styles.kanbanBoard}>
            {DAMAGE_STATUSES.map((status) => (
              <View
                key={status}
                style={[
                  styles.kanbanColumn,
                  status === 'Pending' && styles.kanbanColumnPending,
                ]}
              >
                <View
                  style={[
                    styles.kanbanColumnHeader,
                    { borderBottomColor: getDamageStatusColor(status) },
                  ]}
                >
                  <Text style={styles.kanbanColumnTitle}>{status}</Text>
                  <View
                    style={[
                      styles.kanbanColumnCount,
                      { backgroundColor: `${getDamageStatusColor(status)}18` },
                    ]}
                  >
                    <Text
                      style={[
                        styles.kanbanColumnCountText,
                        { color: getDamageStatusColor(status) },
                      ]}
                    >
                      {reportsByStatus[status].length}
                    </Text>
                  </View>
                </View>
                <ScrollView
                  style={styles.kanbanColumnScroll}
                  contentContainerStyle={styles.kanbanColumnScrollContent}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                >
                  {reportsByStatus[status].length > 0 ? (
                    reportsByStatus[status].map((report) =>
                      renderReportCard(report, 'kanban')
                    )
                  ) : (
                    <View style={styles.kanbanEmpty}>
                      <Text style={styles.kanbanEmptyText}>No {status.toLowerCase()} reports</Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            ))}
          </View>
        ) : (
          renderEmptyState()
        )
      ) : processedReports.length > 0 ? (
        isDesktop ? (
          <AdminGrid>
            {processedReports.map((report) => (
              <AdminGridItem key={report._id} columnWidthPercent={50}>
                {renderReportCard(report, 'list')}
              </AdminGridItem>
            ))}
          </AdminGrid>
        ) : (
          <View style={styles.reportsList}>
            {processedReports.map((report) => renderReportCard(report, 'list'))}
          </View>
        )
      ) : (
        renderEmptyState()
      )}

      <Modal
        visible={lightboxPhotoId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxPhotoId(null)}
      >
        <View style={styles.lightboxOverlay}>
          <TouchableOpacity
            style={styles.lightboxBackdrop}
            activeOpacity={1}
            onPress={() => setLightboxPhotoId(null)}
          />
          <View style={styles.lightboxContent}>
            <TouchableOpacity
              style={styles.lightboxClose}
              onPress={() => setLightboxPhotoId(null)}
            >
              <Ionicons name="close" size={22} color="#ffffff" />
            </TouchableOpacity>
            {lightboxPhotoId ? (
              <OptimizedImage
                storageId={lightboxPhotoId}
                style={styles.lightboxImage}
                contentFit="contain"
                priority="high"
              />
            ) : null}
          </View>
        </View>
      </Modal>

      <CustomAlert
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        buttons={alertState.buttons}
        type={alertState.type}
        onClose={hideAlert}
      />
    </>
  );
}

const styles = StyleSheet.create({
  categoriesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  categoriesToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoriesToggleTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  categoriesToggleMeta: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  categoriesSection: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginBottom: 16,
  },
  categoriesHint: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
  },
  categoriesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fdba74',
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#c2410c',
  },
  categoryAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'web' ? 10 : 12,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  categoryAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f97316',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  categoryAddButtonDisabled: {
    opacity: 0.6,
  },
  categoryAddButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  summaryCounts: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Platform.OS === 'web' ? 10 : 12,
    fontSize: 14,
    color: '#111827',
  },
  searchClear: {
    padding: 4,
  },
  filterScroll: {
    marginBottom: 16,
  },
  filterButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterButtonActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#fdba74',
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterButtonTextActive: {
    color: '#c2410c',
  },
  kanbanBoard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    minHeight: 420,
  },
  kanbanColumn: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    maxHeight: 720,
  },
  kanbanColumnPending: {
    borderColor: '#fcd34d',
    backgroundColor: '#fffbeb',
  },
  kanbanColumnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 3,
  },
  kanbanColumnTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  kanbanColumnCount: {
    minWidth: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  kanbanColumnCountText: {
    fontSize: 12,
    fontWeight: '700',
  },
  kanbanColumnScroll: {
    flex: 1,
  },
  kanbanColumnScrollContent: {
    padding: 10,
    gap: 10,
  },
  kanbanEmpty: {
    padding: 20,
    alignItems: 'center',
  },
  kanbanEmptyText: {
    fontSize: 13,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  reportsList: {
    gap: 12,
  },
  reportCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginBottom: 12,
  },
  reportCardMobile: {
    padding: 14,
  },
  reportCardKanban: {
    marginBottom: 0,
    padding: 14,
  },
  reportCardDesktopSplit: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 16,
    marginBottom: 0,
    minHeight: 220,
  },
  reportCardContent: {
    flex: 1,
  },
  reportCardContentSplit: {
    flex: 1,
    minWidth: 0,
  },
  reportCardActions: {
    width: 260,
    flexShrink: 0,
    borderLeftWidth: 1,
    borderLeftColor: '#eef2f7',
    paddingLeft: 16,
    justifyContent: 'flex-start',
    gap: 14,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  reportHeaderMobile: {
    marginBottom: 10,
  },
  reportHeaderLeft: {
    flex: 1,
    minWidth: 0,
  },
  reportMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  reportCardFooter: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 16,
  },
  reportHeaderMeta: {
    alignItems: 'flex-end',
    gap: 6,
  },
  reportResident: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  reportAddress: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#fff7ed',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#c2410c',
  },
  reportDescription: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 8,
  },
  reportDate: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 12,
  },
  photosRow: {
    marginBottom: 4,
  },
  photoThumb: {
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 8,
    backgroundColor: '#f3f4f6',
    position: 'relative',
  },
  photoThumbCompact: {
    width: 88,
    height: 88,
  },
  photoThumbMobile: {
    width: 104,
    height: 104,
  },
  photoThumbDesktop: {
    width: 128,
    height: 128,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoExpandHint: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 999,
    padding: 4,
  },
  statusSegment: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  statusSegmentCompact: {
    flexDirection: 'column',
  },
  statusSegmentMobile: {
    flexWrap: 'nowrap',
    gap: 8,
  },
  statusSegmentButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    minWidth: 88,
    alignItems: 'center',
  },
  statusSegmentButtonCompact: {
    minWidth: 0,
    width: '100%',
  },
  statusSegmentButtonMobile: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
  },
  statusSegmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  statusSegmentTextCompact: {
    fontSize: 11,
  },
  statusSegmentTextMobile: {
    fontSize: 11,
  },
  statusSegmentTextActive: {
    color: '#ffffff',
  },
  notesSection: {
    gap: 8,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  notesReadOnly: {
    gap: 8,
  },
  notesSavedText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 10,
  },
  notesSavedTextCompact: {
    fontSize: 12,
  },
  notesEmptyText: {
    fontSize: 13,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  notesEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  notesEditButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3b82f6',
  },
  notesEditing: {
    gap: 8,
  },
  notesInput: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#ffffff',
    textAlignVertical: 'top',
  },
  notesInputCompact: {
    minHeight: 72,
  },
  notesEditingActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  notesCancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  notesCancelButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  notesSaveButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#3b82f6',
    minWidth: 92,
    alignItems: 'center',
  },
  notesSaveButtonDisabled: {
    opacity: 0.7,
  },
  notesSaveButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  deleteButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#dc2626',
  },
  kanbanActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
  },
  kanbanActionSpacer: {
    width: 1,
  },
  kanbanActionPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  kanbanActionPrimaryText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  kanbanActionSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  kanbanActionSecondaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
    textAlign: 'center',
  },
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  lightboxContent: {
    width: '92%',
    maxWidth: 960,
    height: '82%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxClose: {
    position: 'absolute',
    top: -44,
    right: 0,
    zIndex: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxImage: {
    width: '100%',
    height: '100%',
  },
});
