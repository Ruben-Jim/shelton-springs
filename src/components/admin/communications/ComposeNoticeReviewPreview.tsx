import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { IOS_FORM_THEME as theme } from '../../ios/iosFormTheme';
import NoticeTicketLetterPreview from './NoticeTicketLetterPreview';
import { NoticeTemplateType, ResidentOption } from './types';

type TemplateMeta = {
  type: string;
  pushTitle: string;
  pushBody: string;
  emailBody: string;
  badgeLabel: string;
};

type ComposeNoticeReviewPreviewProps = {
  templateType: NoticeTemplateType;
  template: TemplateMeta | undefined;
  previewResident: ResidentOption | null;
  createdByName: string;
  noticeNumber?: number;
  selectedViolations?: string[];
};

function formatAddress(resident: ResidentOption): string {
  return `${resident.address}${resident.unitNumber ? `, Unit ${resident.unitNumber}` : ''}`;
}

export default function ComposeNoticeReviewPreview({
  templateType,
  template,
  previewResident,
  createdByName,
  noticeNumber,
  selectedViolations,
}: ComposeNoticeReviewPreviewProps) {
  const noticeDateMs = useMemo(() => Date.now(), []);
  const previewAddress = previewResident
    ? formatAddress(previewResident)
    : 'Sample property address';

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Notice letter preview</Text>
      {previewResident ? (
        <Text style={styles.previewNote}>
          Preview for {previewResident.firstName} {previewResident.lastName} · {previewAddress}.
          Each recipient receives their own property address.
        </Text>
      ) : (
        <Text style={styles.previewNote}>
          Select a recipient to preview with a real address on file.
        </Text>
      )}
      {template ? (
        <NoticeTicketLetterPreview
          templateType={templateType}
          address={previewAddress}
          noticeDateMs={noticeDateMs}
          noticeNumber={noticeNumber}
          title={template.pushTitle}
          body={template.pushBody}
          emailBody={template.emailBody}
          badgeLabel={template.badgeLabel}
          createdByName={createdByName}
          selectedViolations={selectedViolations}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  previewNote: {
    fontSize: 12,
    lineHeight: 17,
    color: theme.textTertiary,
    marginBottom: 4,
  },
});
