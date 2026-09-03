import React from 'react';
import { View, StyleSheet } from 'react-native';
import YardMaintenanceNoticeLetter from '../../notices/YardMaintenanceNoticeLetter';
import CommunityNoticeLetter from '../../notices/CommunityNoticeLetter';
import { NoticeTemplateType } from './types';

type NoticeTicketLetterPreviewProps = {
  templateType: NoticeTemplateType;
  address: string;
  noticeDateMs: number;
  noticeNumber?: number;
  title: string;
  body: string;
  emailBody: string;
  badgeLabel: string;
  createdByName: string;
  selectedViolations?: string[];
};

export default function NoticeTicketLetterPreview({
  templateType,
  address,
  noticeDateMs,
  noticeNumber,
  title,
  body,
  emailBody,
  badgeLabel,
  createdByName,
  selectedViolations,
}: NoticeTicketLetterPreviewProps) {
  const isCompliance = templateType === 'action_request' || templateType === 'reminder';

  return (
    <View style={styles.wrap}>
      {isCompliance ? (
        <YardMaintenanceNoticeLetter
          address={address}
          noticeDateMs={noticeDateMs}
          noticeNumber={noticeNumber}
          isReminder={templateType === 'reminder'}
          selectedViolations={selectedViolations}
        />
      ) : (
        <CommunityNoticeLetter
          address={address}
          noticeDateMs={noticeDateMs}
          badgeLabel={badgeLabel}
          title={title}
          body={body}
          emailBody={emailBody}
          createdByName={createdByName}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
});
