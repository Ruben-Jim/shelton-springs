import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { IOS_FORM_THEME as theme } from '../../ios/iosFormTheme';
import NoticeTicketLetterPreview from './NoticeTicketLetterPreview';
import {
  AUDIENCE_LABELS,
  CHANNEL_LABELS,
  formatTicketNumber,
  NoticeChannel,
  NoticeTemplateType,
  NoticeTicketStatus,
  STATUS_LABELS,
  TEMPLATE_LABELS,
} from './types';

type TicketRecipient = {
  residentId: string;
  residentName: string;
  email: string;
  pushStatus: string;
  emailStatus: string;
  error?: string;
};

type Ticket = {
  _id: string;
  noticeNumber?: number;
  templateType: NoticeTemplateType;
  audienceType: keyof typeof AUDIENCE_LABELS;
  channels: NoticeChannel;
  createdByName: string;
  recipientIds: string[];
  status: NoticeTicketStatus;
  pushSentCount: number;
  emailSentCount: number;
  emailFailedCount: number;
  title: string;
  body: string;
  emailSubject: string;
  createdAt: number;
  sentAt: number;
  selectedViolations?: string[];
  recipients?: TicketRecipient[];
};

type ResidentLookup = {
  _id: string;
  address: string;
  unitNumber?: string;
};

type NoticeTicketDetailProps = {
  ticket: Ticket | null;
  residents?: ResidentLookup[];
};

function statusColor(status: NoticeTicketStatus) {
  if (status === 'sent') return theme.accentGreen;
  if (status === 'sending') return theme.accent;
  if (status === 'partial') return '#d97706';
  return theme.destructive;
}

function resolvePreviewAddress(
  ticket: Ticket,
  residents: ResidentLookup[]
): string {
  const firstRecipient = ticket.recipients?.[0];
  if (firstRecipient) {
    const resident = residents.find(
      (entry) => String(entry._id) === String(firstRecipient.residentId)
    );
    if (resident) {
      return `${resident.address}${resident.unitNumber ? `, Unit ${resident.unitNumber}` : ''}`;
    }
  }
  return 'Sample property address (per recipient)';
}

export default function NoticeTicketDetail({
  ticket,
  residents = [],
}: NoticeTicketDetailProps) {
  const templates = useQuery(api.adminNotices.getTemplates) ?? [];

  const templateMeta = useMemo(
    () => templates.find((entry: { type: string }) => entry.type === ticket?.templateType),
    [templates, ticket?.templateType]
  );

  if (!ticket) {
    return (
      <View style={styles.empty}>
        <Ionicons name="ticket-outline" size={44} color={theme.textTertiary} />
        <Text style={styles.emptyTitle}>Select a notice ticket</Text>
        <Text style={styles.emptyText}>
          Open a ticket from history to preview the notice letter and delivery log.
        </Text>
      </View>
    );
  }

  const showPushStats = ticket.channels === 'push' || ticket.channels === 'both';
  const showEmailStats = ticket.channels === 'email' || ticket.channels === 'both';
  const ticketNo = formatTicketNumber(ticket._id, ticket.noticeNumber);
  const statusTint = statusColor(ticket.status);
  const previewAddress = resolvePreviewAddress(ticket, residents);
  const multiRecipientNote =
    ticket.recipientIds.length > 1
      ? `Letter preview uses ${previewAddress}. Each recipient receives their own property address.`
      : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.ticketHeader}>
        <View style={styles.ticketHeaderTop}>
          <View>
            <Text style={styles.ticketLabel}>Notice ticket</Text>
            <Text style={styles.ticketNumber}>{ticketNo}</Text>
          </View>
          <View style={[styles.statusStamp, { borderColor: statusTint }]}>
            <Text style={[styles.statusStampText, { color: statusTint }]}>
              {STATUS_LABELS[ticket.status]}
            </Text>
          </View>
        </View>

        <Text style={styles.templateTitle}>{TEMPLATE_LABELS[ticket.templateType]}</Text>
        <Text style={styles.meta}>
          Sent {new Date(ticket.sentAt).toLocaleString()} by {ticket.createdByName}
        </Text>
        <Text style={styles.meta}>
          {AUDIENCE_LABELS[ticket.audienceType]} · {ticket.recipientIds.length} recipients ·{' '}
          {CHANNEL_LABELS[ticket.channels]}
        </Text>
        {showEmailStats ? (
          <Text style={styles.metaSubject}>Email subject: {ticket.emailSubject}</Text>
        ) : null}
        {ticket.selectedViolations && ticket.selectedViolations.length > 0 ? (
          <View style={styles.violationTags}>
            {ticket.selectedViolations.map((item) => (
              <View key={item} style={styles.violationTag}>
                <Text style={styles.violationTagText} numberOfLines={2}>
                  {item}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeading}>Notice on file</Text>
        {multiRecipientNote ? (
          <Text style={styles.sectionNote}>{multiRecipientNote}</Text>
        ) : null}
        {templateMeta ? (
          <NoticeTicketLetterPreview
            templateType={ticket.templateType}
            address={previewAddress}
            noticeDateMs={ticket.sentAt}
            noticeNumber={ticket.noticeNumber}
            title={ticket.title}
            body={ticket.body}
            emailBody={templateMeta.emailBody}
            badgeLabel={templateMeta.badgeLabel}
            createdByName={ticket.createdByName}
            selectedViolations={ticket.selectedViolations}
          />
        ) : (
          <View style={styles.fallbackPreview}>
            <Text style={styles.fallbackTitle}>{ticket.title}</Text>
            <Text style={styles.fallbackBody}>{ticket.body}</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeading}>Delivery summary</Text>
        <View style={styles.statsRow}>
          {showPushStats ? (
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{ticket.pushSentCount}</Text>
              <Text style={styles.statLabel}>Push delivered</Text>
            </View>
          ) : null}
          {showEmailStats ? (
            <>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{ticket.emailSentCount}</Text>
                <Text style={styles.statLabel}>Emails sent</Text>
              </View>
              <View style={styles.statCard}>
                <Text
                  style={[
                    styles.statValue,
                    ticket.emailFailedCount > 0 && styles.statValueDanger,
                  ]}
                >
                  {ticket.emailFailedCount}
                </Text>
                <Text style={styles.statLabel}>Email failed</Text>
              </View>
            </>
          ) : null}
        </View>
      </View>

      {ticket.recipients?.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>
            Recipient log · {ticket.recipients.length}
          </Text>
          <View style={styles.recipientList}>
            {ticket.recipients.map((recipient, index) => (
              <View
                key={`${recipient.residentId}-${recipient.email}`}
                style={[styles.recipientRow, index === 0 && styles.recipientRowFirst]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.recipientName}>{recipient.residentName}</Text>
                  <Text style={styles.recipientEmail}>{recipient.email}</Text>
                </View>
                <View style={styles.recipientStatusCol}>
                  {showPushStats ? (
                    <Text style={styles.recipientStatus}>Push: {recipient.pushStatus}</Text>
                  ) : null}
                  {showEmailStats ? (
                    <Text style={styles.recipientStatus}>Email: {recipient.emailStatus}</Text>
                  ) : null}
                  {recipient.error ? (
                    <Text style={styles.recipientError}>{recipient.error}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 28,
    gap: 16,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  emptyText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  ticketHeader: {
    backgroundColor: '#fffdf8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8dfd0',
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: { elevation: 1 },
      default: {},
    }),
  },
  ticketHeaderTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  ticketLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: theme.textTertiary,
    marginBottom: 2,
  },
  ticketNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  statusStamp: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1.5,
    transform: [{ rotate: '-3deg' }],
  },
  statusStampText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  templateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.accent,
    marginBottom: 6,
  },
  meta: {
    fontSize: 13,
    color: theme.textSecondary,
    marginBottom: 3,
    lineHeight: 18,
  },
  metaSubject: {
    fontSize: 12,
    color: theme.textTertiary,
    marginTop: 4,
  },
  violationTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  violationTag: {
    backgroundColor: `${theme.accent}10`,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: `${theme.accent}25`,
    maxWidth: '100%',
  },
  violationTagText: {
    fontSize: 11,
    color: theme.textSecondary,
    lineHeight: 15,
  },
  section: {
    gap: 8,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionNote: {
    fontSize: 12,
    color: theme.textTertiary,
    lineHeight: 17,
  },
  fallbackPreview: {
    backgroundColor: theme.card,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.separator,
  },
  fallbackTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 8,
  },
  fallbackBody: {
    fontSize: 14,
    lineHeight: 20,
    color: theme.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.separator,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  statValueDanger: {
    color: theme.destructive,
  },
  statLabel: {
    marginTop: 4,
    fontSize: 11,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  recipientList: {
    backgroundColor: theme.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.separator,
    overflow: 'hidden',
  },
  recipientRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.separator,
  },
  recipientRowFirst: {
    borderTopWidth: 0,
  },
  recipientName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  recipientEmail: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  recipientStatusCol: {
    alignItems: 'flex-end',
    maxWidth: 140,
  },
  recipientStatus: {
    fontSize: 11,
    color: theme.textSecondary,
  },
  recipientError: {
    marginTop: 4,
    fontSize: 10,
    color: theme.destructive,
    textAlign: 'right',
  },
});
