import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatNoticeDate } from '../../constants/yardMaintenanceNotice';

type CommunityNoticeLetterProps = {
  address: string;
  noticeDateMs: number;
  badgeLabel: string;
  title: string;
  body: string;
  emailBody: string;
  createdByName: string;
};

export default function CommunityNoticeLetter({
  address,
  noticeDateMs,
  badgeLabel,
  title,
  body,
  emailBody,
  createdByName,
}: CommunityNoticeLetterProps) {
  return (
    <View style={styles.paper}>
      <View style={styles.headerBand}>
        <Text style={styles.brand}>Shelton Springs</Text>
        <Text style={styles.brandSub}>HOA Community</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.badge}>{badgeLabel.toUpperCase()}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.paragraph}>{emailBody || body}</Text>

        <View style={styles.addressCard}>
          <Text style={styles.addressLabel}>Property on file</Text>
          <Text style={styles.addressValue}>{address}</Text>
        </View>

        <Text style={styles.meta}>
          Notice date: {formatNoticeDate(noticeDateMs)}
        </Text>
        <Text style={styles.meta}>Sent by {createdByName}</Text>

        <Text style={styles.helpText}>
          Questions? Contact the board through the Shelton Springs app.
        </Text>
      </View>

      <Text style={styles.footer}>Shelton Springs HOA Community · sheltonsprings.homes</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  paper: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  headerBand: {
    borderBottomWidth: 3,
    borderBottomColor: '#0B1A12',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  brand: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
  },
  brandSub: {
    marginTop: 4,
    fontSize: 14,
    color: '#6b7280',
  },
  body: {
    paddingHorizontal: 24,
    paddingVertical: 22,
  },
  badge: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb',
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    color: '#4b5563',
    marginBottom: 18,
  },
  addressCard: {
    backgroundColor: '#f3f4f6',
    borderLeftWidth: 4,
    borderLeftColor: '#2563eb',
    borderRadius: 6,
    padding: 16,
    marginBottom: 16,
  },
  addressLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 6,
  },
  addressValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  meta: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 4,
  },
  helpText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
  },
});
