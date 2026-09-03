import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import {
  YARD_MAINTENANCE_CHECKLIST,
  formatNoticeDate,
  formatNoticeNumber,
  sortViolationsForDisplay,
} from '../../constants/yardMaintenanceNotice';

type YardMaintenanceNoticeLetterProps = {
  address: string;
  noticeDateMs: number;
  noticeNumber?: number;
  isReminder?: boolean;
  /** When set, only these items appear (marked as requiring attention). */
  selectedViolations?: string[];
};

export default function YardMaintenanceNoticeLetter({
  address,
  noticeDateMs,
  noticeNumber,
  isReminder = false,
  selectedViolations,
}: YardMaintenanceNoticeLetterProps) {
  const checklistItems = sortViolationsForDisplay(
    selectedViolations && selectedViolations.length > 0
      ? selectedViolations
      : [...YARD_MAINTENANCE_CHECKLIST]
  );
  const showAsChecked = Boolean(selectedViolations && selectedViolations.length > 0);
  return (
    <View style={styles.paper}>
      <Text style={styles.orgName}>Shelton Springs Homeowners Association</Text>
      <Text style={styles.docTitle}>Yard Maintenance Compliance Notice</Text>

      <Text style={styles.meta}>
        <Text style={styles.metaLabel}>Date: </Text>
        {formatNoticeDate(noticeDateMs)}
      </Text>
      {noticeNumber != null && noticeNumber > 0 ? (
        <Text style={styles.meta}>
          <Text style={styles.metaLabel}>Notice No.: </Text>
          {formatNoticeNumber(noticeNumber)}
        </Text>
      ) : null}
      <Text style={[styles.meta, styles.metaSpaced]}>
        <Text style={styles.metaLabel}>Property Address: </Text>
        {address}
      </Text>

      <Text style={styles.paragraph}>Dear Homeowner,</Text>

      {isReminder ? (
        <View style={styles.reminderBanner}>
          <Text style={styles.reminderText}>
            REMINDER — PRIOR COMPLIANCE NOTICE STILL OPEN
          </Text>
        </View>
      ) : null}

      <Text style={styles.paragraph}>
        The purpose of routine maintenance is to ensure all properties continue to meet
        community standards for appearance, safety, and upkeep, which benefits all
        homeowners by preserving property values and the overall quality of our
        neighborhood.
      </Text>

      <Text style={styles.paragraph}>
        It is important to note that the homeowner is responsible for all yard maintenance
        including, but not limited to, mowing, weed removal, manicuring and edging flower
        beds, and trimming bushes, shrubs and trees.
      </Text>

      <Text style={styles.paragraph}>
        During our monthly community inspection, your property was found{' '}
        <Text style={styles.bold}>not in compliance</Text> with the Association's yard
        maintenance standards.
      </Text>

      <View style={styles.walkthroughBanner}>
        <Text style={styles.walkthroughText}>
          THE HOA WALK THROUGH IS LAST WEEK OF EVERY MONTH
        </Text>
      </View>

      <Text style={styles.checklistHeading}>The following items require attention:</Text>
      {checklistItems.map((item) => (
        <View key={item} style={styles.checklistRow}>
          <Text style={styles.checkbox}>{showAsChecked ? '☑' : '☐'}</Text>
          <Text style={styles.checklistItem}>{item}</Text>
        </View>
      ))}

      <Text style={styles.paragraph}>
        Please ensure the noted maintenance is completed{' '}
        <Text style={styles.emphasisRed}>within 30 days</Text> from the date of this
        notice.
      </Text>

      <Text style={styles.paragraph}>
        Failure to comply within this timeframe may result in the Association contracting
        the required work to remedy the violation, and the{' '}
        <Text style={styles.emphasisRed}>
          full cost of such work will be billed directly to the homeowner
        </Text>
        . Additionally, a{' '}
        <Text style={styles.emphasisRed}>
          fine of $50.00 will be assessed for each month the violation remains unresolved
        </Text>
        .
      </Text>

      <Text style={styles.paragraph}>
        As outlined in the community guidelines, maintaining your yard helps keep Shelton
        Springs a clean and welcoming community for everyone.
      </Text>

      <Text style={styles.paragraph}>
        Thank you for your attention to this matter and for helping keep Shelton Springs a
        clean and welcoming community.
      </Text>

      <Text style={styles.paragraph}>
        If you believe this notice was sent in error, please contact the HOA Board so we
        can review the matter with you.
      </Text>

      <Text style={styles.paragraph}>Sincerely,</Text>
      <Text style={styles.signature}>Shelton Springs Homeowners Association</Text>
      <Text style={styles.signature}>Board of Directors</Text>

      <Text style={styles.footer}>
        Shelton Springs HOA Community · sheltonsprings.homes
      </Text>
    </View>
  );
}

const serif = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: undefined,
});

const styles = StyleSheet.create({
  paper: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 4,
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  orgName: {
    fontFamily: serif,
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  docTitle: {
    fontFamily: serif,
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 20,
  },
  meta: {
    fontSize: 15,
    color: '#111827',
    lineHeight: 22,
  },
  metaLabel: {
    fontWeight: '700',
  },
  metaSpaced: {
    marginBottom: 18,
  },
  paragraph: {
    fontSize: 15,
    color: '#111827',
    lineHeight: 23,
    marginBottom: 14,
  },
  bold: {
    fontWeight: '700',
  },
  reminderBanner: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    borderRadius: 4,
  },
  reminderText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400e',
  },
  walkthroughBanner: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    borderRadius: 4,
  },
  walkthroughText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#166534',
  },
  checklistHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  checkbox: {
    fontSize: 15,
    color: '#111827',
    lineHeight: 22,
    width: 20,
  },
  checklistItem: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    lineHeight: 22,
  },
  emphasisRed: {
    color: '#dc2626',
    fontWeight: '700',
  },
  signature: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginTop: 4,
  },
  footer: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
});
