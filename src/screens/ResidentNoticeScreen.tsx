import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { useAuth } from '../context/AuthContext';
import YardMaintenanceNoticeLetter from '../components/notices/YardMaintenanceNoticeLetter';
import CommunityNoticeLetter from '../components/notices/CommunityNoticeLetter';

export type ResidentNoticeRouteParams = {
  ResidentNotice: {
    ticketId: string;
  };
};

export default function ResidentNoticeScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<ResidentNoticeRouteParams, 'ResidentNotice'>>();
  const { user } = useAuth();
  const ticketId = route.params?.ticketId;
  const markRead = useMutation(api.notifications.markAdminNoticeTicketRead);

  const notice = useQuery(
    api.adminNotices.getNoticeForResident,
    user?._id && ticketId
      ? {
          residentId: user._id as Id<'residents'>,
          ticketId: ticketId as Id<'adminNoticeTickets'>,
        }
      : 'skip'
  );

  useEffect(() => {
    if (!user?._id || !ticketId || notice === undefined || notice === null) return;
    void markRead({ userId: String(user._id), ticketId });
  }, [user?._id, ticketId, notice, markRead]);

  const isCompliance =
    notice?.templateType === 'action_request' || notice?.templateType === 'reminder';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#2563eb" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>HOA Notice</Text>
        <View style={styles.headerSpacer} />
      </View>

      {notice === undefined ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading notice…</Text>
        </View>
      ) : notice === null ? (
        <View style={styles.centered}>
          <Ionicons name="document-text-outline" size={42} color="#9ca3af" />
          <Text style={styles.errorTitle}>Notice unavailable</Text>
          <Text style={styles.errorText}>
            This notice may have expired or is not assigned to your account.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {isCompliance ? (
            <YardMaintenanceNoticeLetter
              address={notice.address}
              noticeDateMs={notice.sentAt}
              noticeNumber={notice.noticeNumber}
              isReminder={notice.templateType === 'reminder'}
              selectedViolations={notice.selectedViolations}
            />
          ) : (
            <CommunityNoticeLetter
              address={notice.address}
              noticeDateMs={notice.sentAt}
              badgeLabel={notice.badgeLabel}
              title={notice.title}
              body={notice.body}
              emailBody={notice.emailBody}
              createdByName={notice.createdByName}
            />
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 72,
  },
  backText: {
    fontSize: 17,
    color: '#2563eb',
    marginLeft: -2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  headerSpacer: {
    minWidth: 72,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  loadingText: {
    fontSize: 15,
    color: '#6b7280',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  errorText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});
