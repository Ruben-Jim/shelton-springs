import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TEMPLATE_LABELS } from '../admin/communications/types';

export type HomeHoaNoticeItem = {
  ticketId: string;
  templateType: keyof typeof TEMPLATE_LABELS;
  title: string;
  isRead: boolean;
  createdAt: number;
};

type HomeHoaNoticesSectionProps = {
  notices: HomeHoaNoticeItem[];
  onOpenNotice: (ticketId: string) => void;
  embedded?: boolean;
};

export default function HomeHoaNoticesSection({
  notices,
  onOpenNotice,
  embedded = false,
}: HomeHoaNoticesSectionProps) {
  if (!notices.length) return null;

  const unreadCount = notices.filter((notice) => !notice.isRead).length;

  return (
    <View style={[styles.section, embedded && styles.sectionEmbedded]}>
      <View style={styles.header}>
        <Ionicons name="mail-unread-outline" size={22} color="#64748b" />
        <Text style={styles.title}>HOA Notices</Text>
        {unreadCount > 0 ? (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{unreadCount} new</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.subtitle}>
        Official notices from the board stay here after push alerts disappear.
      </Text>

      {notices.slice(0, 5).map((notice) => (
        <TouchableOpacity
          key={notice.ticketId}
          style={[styles.noticeRow, !notice.isRead && styles.noticeRowUnread]}
          onPress={() => onOpenNotice(notice.ticketId)}
          activeOpacity={0.85}
        >
          <View style={styles.noticeIconWrap}>
            <Ionicons
              name={
                notice.templateType === 'notice'
                  ? 'megaphone-outline'
                  : notice.templateType === 'reminder'
                    ? 'alarm-outline'
                    : 'leaf-outline'
              }
              size={18}
              color={notice.isRead ? '#6b7280' : '#2563eb'}
            />
          </View>
          <View style={styles.noticeText}>
            <Text style={[styles.noticeTitle, !notice.isRead && styles.noticeTitleUnread]} numberOfLines={1}>
              {notice.title}
            </Text>
            <Text style={styles.noticeMeta} numberOfLines={1}>
              {TEMPLATE_LABELS[notice.templateType]} ·{' '}
              {new Date(notice.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          </View>
          {!notice.isRead ? <View style={styles.unreadDot} /> : null}
          <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
        </TouchableOpacity>
      ))}

      {notices.length > 5 ? (
        <Text style={styles.moreHint}>{notices.length - 5} older notice{notices.length - 5 === 1 ? '' : 's'} in your history</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  sectionEmbedded: {
    marginBottom: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  unreadBadge: {
    backgroundColor: '#fee2e2',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  unreadBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#dc2626',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: '#6b7280',
    marginBottom: 12,
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  noticeRowUnread: {
    borderColor: '#bfdbfe',
    backgroundColor: '#f8fbff',
  },
  noticeIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeText: {
    flex: 1,
    minWidth: 0,
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 2,
  },
  noticeTitleUnread: {
    color: '#111827',
    fontWeight: '700',
  },
  noticeMeta: {
    fontSize: 12,
    color: '#9ca3af',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563eb',
  },
  moreHint: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
});
