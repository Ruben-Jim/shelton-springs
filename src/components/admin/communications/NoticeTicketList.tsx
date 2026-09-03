import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_FORM_THEME as theme } from '../../ios/iosFormTheme';
import {
  AUDIENCE_LABELS,
  CHANNEL_LABELS,
  formatTicketNumber,
  NoticeChannel,
  NoticeTicketStatus,
  STATUS_LABELS,
  TEMPLATE_LABELS,
} from './types';

export type NoticeTicketListItem = {
  _id: string;
  noticeNumber?: number;
  templateType: keyof typeof TEMPLATE_LABELS;
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
  sentAt: number;
};

type NoticeTicketListProps = {
  tickets: NoticeTicketListItem[];
  selectedId?: string | null;
  onSelect: (ticketId: string) => void;
};

function statusColor(status: NoticeTicketStatus) {
  if (status === 'sent') return theme.accentGreen;
  if (status === 'sending') return theme.accent;
  if (status === 'partial') return '#d97706';
  return theme.destructive;
}

const TEMPLATE_ICONS: Record<keyof typeof TEMPLATE_LABELS, keyof typeof Ionicons.glyphMap> = {
  notice: 'megaphone-outline',
  action_request: 'leaf-outline',
  reminder: 'alarm-outline',
};

export default function NoticeTicketList({
  tickets,
  selectedId,
  onSelect,
}: NoticeTicketListProps) {
  if (!tickets.length) {
    return (
      <View style={styles.empty}>
        <Ionicons name="ticket-outline" size={40} color={theme.textTertiary} />
        <Text style={styles.emptyTitle}>No notices yet</Text>
        <Text style={styles.emptyText}>
          Sent notices appear here as delivery tickets with the notice content on file.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.listContent} nestedScrollEnabled>
      {tickets.map((item) => {
        const selected = item._id === selectedId;
        const ticketNo = formatTicketNumber(item._id, item.noticeNumber);
        const statusTint = statusColor(item.status);

        return (
          <TouchableOpacity
            key={item._id}
            style={[styles.ticket, selected && styles.ticketSelected]}
            onPress={() => onSelect(item._id)}
            activeOpacity={0.88}
          >
            <View style={styles.ticketStub}>
              <Ionicons
                name={TEMPLATE_ICONS[item.templateType]}
                size={18}
                color={selected ? theme.accent : '#78716c'}
              />
            </View>

            <View style={styles.perforation} />

            <View style={styles.ticketBody}>
              <View style={styles.ticketTopRow}>
                <Text style={styles.ticketNumber}>{ticketNo}</Text>
                <View style={[styles.statusStamp, { borderColor: statusTint }]}>
                  <Text style={[styles.statusStampText, { color: statusTint }]}>
                    {STATUS_LABELS[item.status]}
                  </Text>
                </View>
              </View>

              <Text style={styles.templateLabel}>{TEMPLATE_LABELS[item.templateType]}</Text>
              <Text style={styles.ticketTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.ticketExcerpt} numberOfLines={2}>
                {item.body}
              </Text>

              <View style={styles.ticketFooter}>
                <Text style={styles.ticketMeta}>
                  {new Date(item.sentAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
                <Text style={styles.ticketMetaDot}>·</Text>
                <Text style={styles.ticketMeta}>
                  {item.recipientIds.length} recipient{item.recipientIds.length === 1 ? '' : 's'}
                </Text>
                <Text style={styles.ticketMetaDot}>·</Text>
                <Text style={styles.ticketMeta} numberOfLines={1}>
                  {CHANNEL_LABELS[item.channels]}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: 16,
    gap: 10,
  },
  empty: {
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  emptyText: {
    fontSize: 13,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  ticket: {
    flexDirection: 'row',
    backgroundColor: '#fffdf8',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e7e0d5',
    overflow: 'hidden',
    marginBottom: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#78716c',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  ticketSelected: {
    borderColor: theme.accent,
    backgroundColor: '#f8fbff',
  },
  ticketStub: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f0e8',
  },
  perforation: {
    width: 1,
    backgroundColor: '#e7e0d5',
    borderStyle: 'dashed',
  },
  ticketBody: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  ticketTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  ticketNumber: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: theme.textTertiary,
    fontVariant: ['tabular-nums'],
  },
  statusStamp: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1.5,
    transform: [{ rotate: '-2deg' }],
  },
  statusStampText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  templateLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  ticketTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.textPrimary,
    lineHeight: 20,
    marginBottom: 3,
  },
  ticketExcerpt: {
    fontSize: 13,
    lineHeight: 18,
    color: theme.textSecondary,
    marginBottom: 8,
  },
  ticketFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  ticketMeta: {
    fontSize: 11,
    color: theme.textTertiary,
  },
  ticketMetaDot: {
    fontSize: 11,
    color: theme.textTertiary,
  },
});
