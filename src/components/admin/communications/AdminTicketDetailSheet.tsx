import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { IOS_FORM_THEME as theme } from '../../ios/iosFormTheme';
import NoticeTicketDetail from './NoticeTicketDetail';
import { formatTicketNumber } from './types';

type AdminTicketDetailSheetProps = {
  visible: boolean;
  loading: boolean;
  ticket: Parameters<typeof NoticeTicketDetail>[0]['ticket'];
  residents: Parameters<typeof NoticeTicketDetail>[0]['residents'];
  onClose: () => void;
};

export default function AdminTicketDetailSheet({
  visible,
  loading,
  ticket,
  residents,
  onClose,
}: AdminTicketDetailSheetProps) {
  const ticketNo = ticket ? formatTicketNumber(ticket._id, ticket.noticeNumber) : '';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="chevron-down" size={22} color={theme.accent} />
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Notice ticket</Text>
            {ticketNo ? <Text style={styles.headerSubtitle}>{ticketNo}</Text> : null}
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <View style={styles.loadingPane}>
            <ActivityIndicator color={theme.accent} />
          </View>
        ) : (
          <NoticeTicketDetail ticket={ticket} residents={residents} />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.groupedBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.separator,
    backgroundColor: theme.card,
  },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 80,
    gap: 2,
  },
  closeText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.accent,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textTertiary,
    marginTop: 2,
    letterSpacing: 0.4,
  },
  headerSpacer: {
    minWidth: 80,
  },
  loadingPane: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
