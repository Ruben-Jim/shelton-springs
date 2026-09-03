import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
import { useAuth } from '../../../context/AuthContext';
import { IOS_FORM_THEME as theme } from '../../ios/iosFormTheme';
import AdminTicketDetailSheet from './AdminTicketDetailSheet';
import NoticeTicketDetail from './NoticeTicketDetail';
import NoticeTicketList from './NoticeTicketList';

type CommunicationsPanelProps = {
  residents: any[];
  useSidebar: boolean;
  isMobileDevice: boolean;
  onComposeVisibleChange: (visible: boolean) => void;
  focusTicketId?: string | null;
  onFocusTicketHandled?: () => void;
};

export default function CommunicationsPanel({
  residents,
  useSidebar,
  isMobileDevice,
  onComposeVisibleChange,
  focusTicketId,
  onFocusTicketHandled,
}: CommunicationsPanelProps) {
  const { user } = useAuth();
  const requesterId = user?._id as Id<'residents'> | undefined;
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  useEffect(() => {
    if (!focusTicketId) return;
    setSelectedTicketId(focusTicketId);
    onFocusTicketHandled?.();
  }, [focusTicketId, onFocusTicketHandled]);

  const tickets = useQuery(
    api.adminNotices.listTickets,
    requesterId ? { requesterId, limit: 50 } : 'skip'
  );

  const selectedTicket = useQuery(
    api.adminNotices.getTicket,
    requesterId && selectedTicketId
      ? { requesterId, ticketId: selectedTicketId as Id<'adminNoticeTickets'> }
      : 'skip'
  );

  const ticketsLoading = requesterId != null && tickets === undefined;
  const detailLoading =
    requesterId != null && selectedTicketId != null && selectedTicket === undefined;

  const showMobileTicketSheet = !useSidebar && isMobileDevice && selectedTicketId != null;

  return (
    <View style={styles.container}>
      <View style={[styles.header, useSidebar && styles.headerDesktop]}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Send Notice</Text>
          <Text style={styles.subtitle}>
            Send template-based notices to residents via push, email, or both.
          </Text>
        </View>
        <TouchableOpacity style={styles.composeButton} onPress={() => onComposeVisibleChange(true)}>
          <Text style={styles.composeButtonText}>New Notice</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.body, useSidebar && styles.bodyDesktop]}>
        <View style={[styles.listPane, useSidebar && styles.listPaneDesktop]}>
          {ticketsLoading ? (
            <View style={styles.loadingPane}>
              <ActivityIndicator color={theme.accent} />
              <Text style={styles.loadingText}>Loading notice history…</Text>
            </View>
          ) : (
            <NoticeTicketList
              tickets={tickets ?? []}
              selectedId={selectedTicketId}
              onSelect={(id) => setSelectedTicketId(id)}
            />
          )}
        </View>
        {useSidebar ? (
          <View style={styles.detailPane}>
            {detailLoading ? (
              <View style={styles.loadingPane}>
                <ActivityIndicator color={theme.accent} />
              </View>
            ) : (
              <NoticeTicketDetail ticket={selectedTicket ?? null} residents={residents} />
            )}
          </View>
        ) : null}
      </View>

      <AdminTicketDetailSheet
        visible={showMobileTicketSheet}
        loading={detailLoading}
        ticket={selectedTicket ?? null}
        residents={residents}
        onClose={() => setSelectedTicketId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 480,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  headerDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },
  composeButton: {
    alignSelf: 'flex-start',
    backgroundColor: theme.accent,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  composeButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  body: {
    flex: 1,
  },
  bodyDesktop: {
    flexDirection: 'row',
    gap: 16,
    minHeight: 520,
  },
  listPane: {
    flex: 1,
  },
  listPaneDesktop: {
    flex: 0.42,
    borderWidth: 1,
    borderColor: theme.separator,
    borderRadius: 12,
    backgroundColor: theme.card,
    overflow: 'hidden',
  },
  detailPane: {
    flex: 0.58,
    borderWidth: 1,
    borderColor: theme.separator,
    borderRadius: 12,
    backgroundColor: theme.card,
    overflow: 'hidden',
  },
  loadingPane: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: theme.textSecondary,
  },
});
