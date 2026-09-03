import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AdminNavBadges, AdminTabId, CommunitySubTab } from './types';

type AdminOverviewProps = {
  badges: AdminNavBadges;
  homeownerCount: number;
  renterCount: number;
  blockedCount: number;
  onNavigate: (tab: AdminTabId, communitySubTab?: CommunitySubTab) => void;
  cardWidthPercent: number;
};

type OverviewCard = {
  id: AdminTabId;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  stat?: string;
  alert?: boolean;
};

export default function AdminOverview({
  badges,
  homeownerCount,
  renterCount,
  blockedCount,
  onNavigate,
  cardWidthPercent,
}: AdminOverviewProps) {
  const cards: OverviewCard[] = [
    {
      id: 'communications',
      title: 'Send Notice',
      subtitle: 'Compose notices & view delivery history',
      icon: 'mail',
      color: '#2563eb',
    },
    {
      id: 'residents',
      title: 'Residents',
      subtitle: `${homeownerCount} homeowners · ${renterCount} renters`,
      icon: 'people',
      color: '#10b981',
      stat: String(badges.residents ?? homeownerCount + renterCount),
    },
    {
      id: 'fees',
      title: 'Fees & Payments',
      subtitle:
        (badges.pendingPayments ?? 0) > 0
          ? `${badges.pendingPayments} pending Venmo review`
          : 'Dues, fines & transactions',
      icon: 'card',
      color: '#ec4899',
      alert: (badges.pendingPayments ?? 0) > 0,
      stat: (badges.pendingPayments ?? 0) > 0 ? String(badges.pendingPayments) : undefined,
    },
    {
      id: 'Community',
      title: 'Community',
      subtitle:
        (badges.complaints ?? 0) > 0 || (badges.pendingDamage ?? 0) > 0
          ? [
              (badges.complaints ?? 0) > 0
                ? `${badges.complaints} complaint${badges.complaints === 1 ? '' : 's'}`
                : null,
              (badges.pendingDamage ?? 0) > 0
                ? `${badges.pendingDamage} damage report${badges.pendingDamage === 1 ? '' : 's'}`
                : null,
            ]
              .filter(Boolean)
              .join(' · ')
          : 'Damage, posts, polls, pets & moderation',
      icon: 'chatbubbles',
      color: '#3b82f6',
      alert: (badges.complaints ?? 0) > 0 || (badges.pendingDamage ?? 0) > 0,
      stat:
        (badges.complaints ?? 0) > 0 || (badges.pendingDamage ?? 0) > 0
          ? String((badges.complaints ?? 0) + (badges.pendingDamage ?? 0))
          : undefined,
    },
    {
      id: 'board',
      title: 'Board',
      subtitle: 'Manage officers & roles',
      icon: 'shield',
      color: '#f59e0b',
      stat: String(badges.board ?? 0),
    },
    {
      id: 'covenants',
      title: 'Covenants',
      subtitle: 'Rules & document library',
      icon: 'document-text',
      color: '#22c55e',
    },
    {
      id: 'SheltonHOA',
      title: 'HOA Settings',
      subtitle: 'Contact info, events & share links',
      icon: 'business',
      color: '#6366f1',
    },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Admin overview</Text>
      <Text style={styles.subheading}>Quick access to the areas you manage most often.</Text>

      <View style={styles.alertRow}>
        {blockedCount > 0 ? (
          <View style={[styles.alertChip, styles.alertChipDanger]}>
            <Ionicons name="ban" size={14} color="#ef4444" />
            <Text style={styles.alertChipTextDanger}>{blockedCount} blocked account(s)</Text>
          </View>
        ) : null}
        {(badges.pendingPayments ?? 0) > 0 ? (
          <TouchableOpacity style={[styles.alertChip, styles.alertChipWarn]} onPress={() => onNavigate('fees')}>
            <Ionicons name="time" size={14} color="#d97706" />
            <Text style={styles.alertChipTextWarn}>{badges.pendingPayments} payment(s) to review</Text>
          </TouchableOpacity>
        ) : null}
        {(badges.complaints ?? 0) > 0 ? (
          <TouchableOpacity
            style={[styles.alertChip, styles.alertChipInfo]}
            onPress={() => onNavigate('Community')}
          >
            <Ionicons name="warning" size={14} color="#2563eb" />
            <Text style={styles.alertChipTextInfo}>{badges.complaints} complaint(s)</Text>
          </TouchableOpacity>
        ) : null}
        {(badges.pendingDamage ?? 0) > 0 ? (
          <TouchableOpacity
            style={[styles.alertChip, styles.alertChipWarn]}
            onPress={() => onNavigate('Community', 'damage')}
          >
            <Ionicons name="construct" size={14} color="#d97706" />
            <Text style={styles.alertChipTextWarn}>{badges.pendingDamage} damage report(s)</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.cardGrid}>
        {cards.map((card) => (
          <View key={card.id} style={[styles.card, { width: `${cardWidthPercent}%` as any }]}>
            <TouchableOpacity
              style={[styles.cardInner, card.alert && styles.cardInnerAlert]}
              onPress={() => onNavigate(card.id)}
              activeOpacity={0.85}
            >
              <View style={styles.cardBody}>
                <View style={[styles.cardIcon, { backgroundColor: card.color + '18' }]}>
                  <Ionicons name={card.icon as any} size={22} color={card.color} />
                </View>
                <Text style={styles.cardTitle}>{card.title}</Text>
                <Text style={styles.cardSubtitle} numberOfLines={2}>
                  {card.subtitle}
                </Text>
              </View>
              <View style={styles.cardFooter}>
                {card.stat ? (
                  <Text style={[styles.cardStat, { color: card.color }]}>{card.stat}</Text>
                ) : (
                  <View style={styles.cardStatPlaceholder} />
                )}
              </View>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
    paddingBottom: 24,
    width: '100%',
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subheading: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 14,
    lineHeight: 20,
  },
  alertRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  alertChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  alertChipDanger: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  alertChipWarn: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  alertChipInfo: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  alertChipTextDanger: { fontSize: 12, fontWeight: '600', color: '#b91c1c' },
  alertChipTextWarn: { fontSize: 12, fontWeight: '600', color: '#b45309' },
  alertChipTextInfo: { fontSize: 12, fontWeight: '600', color: '#1d4ed8' },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    marginHorizontal: -6,
    width: '100%',
  },
  card: {
    padding: 6,
    alignSelf: 'stretch',
  },
  cardInner: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    minHeight: 164,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  cardInnerAlert: {
    borderColor: '#bfdbfe',
    backgroundColor: '#f8fbff',
  },
  cardBody: {
    flex: 1,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 17,
    minHeight: 34,
  },
  cardFooter: {
    minHeight: 32,
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  cardStat: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
  cardStatPlaceholder: {
    minHeight: 28,
  },
});
