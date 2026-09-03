import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
import { useAuth } from '../../../context/AuthContext';
import { triggerLightImpact } from '../../../utils/safeHaptics';
import IosFormSheet from '../../ios/IosFormSheet';
import IosNavBar from '../../ios/IosNavBar';
import { IOS_FORM_THEME as theme } from '../../ios/iosFormTheme';
import {
  resolveSelectedViolations,
  violationsStepIsValid,
} from '../../../constants/yardMaintenanceNotice';
import ComposeNoticeReviewPreview from './ComposeNoticeReviewPreview';
import RecipientPicker from './RecipientPicker';
import ViolationPicker from './ViolationPicker';
import {
  CHANNEL_LABELS,
  NoticeChannel,
  NoticeTemplateType,
  ResidentOption,
  TEMPLATE_LABELS,
  getDeliveryFooterText,
  isComplianceTemplate,
} from './types';

type ComposeNoticeSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSent?: (ticketId: string) => void;
  residents: ResidentOption[];
  useDesktopModal?: boolean;
};

type ComposeStep = 'template' | 'violations' | 'recipients' | 'delivery' | 'review';

const STEP_TITLES: Record<ComposeStep, string> = {
  template: 'Choose template',
  violations: 'Select violations',
  recipients: 'Select recipients',
  delivery: 'Delivery method',
  review: 'Review & send',
};

function buildSteps(templateType: NoticeTemplateType): ComposeStep[] {
  if (isComplianceTemplate(templateType)) {
    return ['template', 'violations', 'recipients', 'delivery', 'review'];
  }
  return ['template', 'recipients', 'delivery', 'review'];
}

const TEMPLATE_OPTIONS: NoticeTemplateType[] = ['action_request', 'notice', 'reminder'];
const CHANNEL_OPTIONS: NoticeChannel[] = ['push', 'email', 'both'];

const TEMPLATE_ICONS: Record<NoticeTemplateType, keyof typeof Ionicons.glyphMap> = {
  action_request: 'leaf-outline',
  notice: 'megaphone-outline',
  reminder: 'alarm-outline',
};

const CHANNEL_ICONS: Record<NoticeChannel, keyof typeof Ionicons.glyphMap> = {
  push: 'notifications-outline',
  email: 'mail-outline',
  both: 'paper-plane-outline',
};

function StepDots({ steps, stepIndex }: { steps: ComposeStep[]; stepIndex: number }) {
  return (
    <View style={styles.stepDots}>
      {steps.map((step, index) => (
        <View
          key={step}
          style={[
            styles.stepDot,
            index === stepIndex && styles.stepDotActive,
            index < stepIndex && styles.stepDotComplete,
          ]}
        />
      ))}
    </View>
  );
}

export default function ComposeNoticeSheet({
  visible,
  onClose,
  onSent,
  residents,
  useDesktopModal = false,
}: ComposeNoticeSheetProps) {
  const { user } = useAuth();
  const templates = useQuery(api.adminNotices.getTemplates) ?? [];
  const nextNoticeNumber = useQuery(api.adminNotices.getNextNoticeNumber);
  const sendNotice = useMutation(api.adminNotices.send);

  const [stepIndex, setStepIndex] = useState(0);
  const [templateType, setTemplateType] = useState<NoticeTemplateType>('action_request');
  const [channels, setChannels] = useState<NoticeChannel>('both');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedViolations, setSelectedViolations] = useState<string[]>([]);
  const [otherViolationDetail, setOtherViolationDetail] = useState('');
  const [sending, setSending] = useState(false);

  const steps = useMemo(() => buildSteps(templateType), [templateType]);
  const step = steps[stepIndex] ?? steps[0];

  useEffect(() => {
    if (!visible) return;
    setStepIndex(0);
    setSelectedIds([]);
    setSelectedViolations([]);
    setOtherViolationDetail('');
    setTemplateType('action_request');
    setChannels('both');
  }, [visible]);

  useEffect(() => {
    if (stepIndex >= steps.length) {
      setStepIndex(Math.max(0, steps.length - 1));
    }
  }, [stepIndex, steps.length]);

  const selectedTemplate = useMemo(
    () => templates.find((t: any) => t.type === templateType),
    [templates, templateType]
  );

  const selectedResidents = useMemo(
    () => residents.filter((r) => selectedIds.includes(r._id)),
    [residents, selectedIds]
  );

  const resolvedViolations = useMemo(
    () => resolveSelectedViolations(selectedViolations, otherViolationDetail),
    [selectedViolations, otherViolationDetail]
  );

  const previewResident = selectedResidents[0] ?? null;
  const createdByName = user
    ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'HOA Board'
    : 'HOA Board';

  const canProceed =
    step === 'template' ||
    (step === 'violations' &&
      violationsStepIsValid(selectedViolations, otherViolationDetail)) ||
    (step === 'recipients' && selectedIds.length > 0) ||
    step === 'delivery' ||
    (step === 'review' &&
      Boolean(
        user?._id &&
          selectedIds.length > 0 &&
          selectedTemplate &&
          (!isComplianceTemplate(templateType) || resolvedViolations.length > 0)
      ));

  const deliveryFooterText = useMemo(
    () => getDeliveryFooterText(templateType, channels),
    [templateType, channels]
  );

  const goBack = () => {
    if (stepIndex === 0) {
      onClose();
      return;
    }
    setStepIndex((current) => Math.max(0, current - 1));
  };

  const goNext = () => {
    if (step === 'review') {
      void handleSend();
      return;
    }
    if (!canProceed) return;
    setStepIndex((current) => Math.min(steps.length - 1, current + 1));
  };

  const handleSend = async () => {
    if (!user?._id || selectedIds.length === 0 || !selectedTemplate) return;
    if (isComplianceTemplate(templateType) && resolvedViolations.length === 0) return;

    Alert.alert(
      'Send notice?',
      `Send "${TEMPLATE_LABELS[templateType]}" to ${selectedIds.length} resident(s) via ${CHANNEL_LABELS[channels].toLowerCase()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          style: 'default',
          onPress: async () => {
            try {
              setSending(true);
              await triggerLightImpact();
              const ticketId = await sendNotice({
                requesterId: user._id as Id<'residents'>,
                templateType,
                audienceType: 'custom',
                customRecipientIds: selectedIds as Id<'residents'>[],
                channels,
                selectedViolations: isComplianceTemplate(templateType)
                  ? resolvedViolations
                  : undefined,
              });
              onSent?.(String(ticketId));
              onClose();
              Alert.alert('Sent', 'Your notice has been queued for delivery.');
            } catch (error) {
              Alert.alert(
                'Send failed',
                error instanceof Error ? error.message : 'Unable to send notice.'
              );
            } finally {
              setSending(false);
            }
          },
        },
      ]
    );
  };

  const renderTemplateStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepLead}>What type of notice are you sending?</Text>
      <View style={styles.optionList}>
        {TEMPLATE_OPTIONS.map((option) => {
          const template = templates.find((t: any) => t.type === option);
          const selected = templateType === option;
          return (
            <TouchableOpacity
              key={option}
              style={[styles.optionCard, selected && styles.optionCardSelected]}
              onPress={() => setTemplateType(option)}
              activeOpacity={0.85}
            >
              <View style={[styles.optionIconWrap, selected && styles.optionIconWrapSelected]}>
                <Ionicons
                  name={TEMPLATE_ICONS[option]}
                  size={22}
                  color={selected ? theme.accent : theme.textSecondary}
                />
              </View>
              <View style={styles.optionTextWrap}>
                <Text style={styles.optionTitle}>{TEMPLATE_LABELS[option]}</Text>
                <Text style={styles.optionSubtitle} numberOfLines={2}>
                  {template?.pushTitle ?? ''}
                </Text>
              </View>
              {selected ? (
                <Ionicons name="checkmark-circle" size={22} color={theme.accent} />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderViolationsStep = () => (
    <ViolationPicker
      selectedViolations={selectedViolations}
      otherViolationDetail={otherViolationDetail}
      onSelectionChange={setSelectedViolations}
      onOtherViolationDetailChange={setOtherViolationDetail}
    />
  );

  const renderRecipientsStep = () => (
    <RecipientPicker
      residents={residents}
      selectedIds={selectedIds}
      onSelectionChange={setSelectedIds}
    />
  );

  const renderDeliveryStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepLead}>How should this notice be delivered?</Text>
      <View style={styles.optionList}>
        {CHANNEL_OPTIONS.map((option) => {
          const selected = channels === option;
          return (
            <TouchableOpacity
              key={option}
              style={[styles.optionCard, selected && styles.optionCardSelected]}
              onPress={() => setChannels(option)}
              activeOpacity={0.85}
            >
              <View style={[styles.optionIconWrap, selected && styles.optionIconWrapSelected]}>
                <Ionicons
                  name={CHANNEL_ICONS[option]}
                  size={22}
                  color={selected ? theme.accent : theme.textSecondary}
                />
              </View>
              <View style={styles.optionTextWrap}>
                <Text style={styles.optionTitle}>{CHANNEL_LABELS[option]}</Text>
                {option === 'push' ? (
                  <Text style={styles.optionSubtitle}>In-app alert and device push</Text>
                ) : option === 'email' ? (
                  <Text style={styles.optionSubtitle}>Formal HOA email to each recipient</Text>
                ) : (
                  <Text style={styles.optionSubtitle}>Push alert and email together</Text>
                )}
              </View>
              {selected ? (
                <Ionicons name="checkmark-circle" size={22} color={theme.accent} />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
      {deliveryFooterText ? (
        <Text style={styles.stepFooter}>{deliveryFooterText}</Text>
      ) : null}
    </View>
  );

  const renderReviewStep = () => (
    <ScrollView
      style={styles.reviewScroll}
      contentContainerStyle={styles.reviewScrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.stepLead}>Confirm before sending</Text>
      <View style={styles.reviewSummaryCard}>
        <ReviewRow label="Template" value={TEMPLATE_LABELS[templateType]} />
        {isComplianceTemplate(templateType) ? (
          <ReviewRow
            label="Violations"
            value={`${resolvedViolations.length} selected`}
          />
        ) : null}
        <ReviewRow label="Delivery" value={CHANNEL_LABELS[channels]} />
        <ReviewRow label="Recipients" value={`${selectedIds.length} selected`} />
        {selectedResidents.length > 0 ? (
          <View style={styles.reviewRecipientList}>
            {selectedResidents.slice(0, 6).map((resident) => (
              <Text key={resident._id} style={styles.reviewRecipient}>
                · {resident.firstName} {resident.lastName} — {resident.address}
              </Text>
            ))}
            {selectedResidents.length > 6 ? (
              <Text style={styles.reviewRecipientMore}>
                + {selectedResidents.length - 6} more
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
      <ComposeNoticeReviewPreview
        templateType={templateType}
        template={selectedTemplate}
        previewResident={previewResident}
        createdByName={createdByName}
        noticeNumber={nextNoticeNumber ?? undefined}
        selectedViolations={
          isComplianceTemplate(templateType) ? resolvedViolations : undefined
        }
      />
    </ScrollView>
  );

  const body = (
    <View style={styles.sheetBody}>
      <IosNavBar
        title={STEP_TITLES[step]}
        cancelLabel={stepIndex === 0 ? 'Cancel' : 'Back'}
        onCancel={goBack}
        onConfirm={goNext}
        confirmLabel={step === 'review' ? 'Send' : 'Next'}
        confirmDisabled={!canProceed}
        loading={sending}
      />
      <StepDots steps={steps} stepIndex={stepIndex} />
      <View style={styles.stepPane}>
        {step === 'template' && renderTemplateStep()}
        {step === 'violations' && renderViolationsStep()}
        {step === 'recipients' && renderRecipientsStep()}
        {step === 'delivery' && renderDeliveryStep()}
        {step === 'review' && renderReviewStep()}
      </View>
    </View>
  );

  if (useDesktopModal) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.desktopOverlay}>
          <TouchableOpacity style={styles.desktopBackdrop} activeOpacity={1} onPress={onClose} />
          <View style={styles.desktopCard}>{body}</View>
        </View>
      </Modal>
    );
  }

  return (
    <IosFormSheet visible={visible} onClose={onClose}>
      {body}
    </IosFormSheet>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetBody: {
    flex: 1,
  },
  stepDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 12,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.separator,
  },
  stepDotActive: {
    width: 22,
    backgroundColor: theme.accent,
  },
  stepDotComplete: {
    backgroundColor: `${theme.accent}55`,
  },
  stepPane: {
    flex: 1,
    minHeight: 0,
  },
  stepContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  stepLead: {
    fontSize: 15,
    color: theme.textSecondary,
    marginBottom: 16,
    lineHeight: 21,
  },
  stepFooter: {
    marginTop: 14,
    fontSize: 13,
    lineHeight: 18,
    color: theme.textTertiary,
  },
  optionList: {
    gap: 10,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.separator,
  },
  optionCardSelected: {
    borderColor: theme.accent,
    backgroundColor: `${theme.accent}08`,
  },
  optionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.groupedBackground,
  },
  optionIconWrapSelected: {
    backgroundColor: `${theme.accent}14`,
  },
  optionTextWrap: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 18,
  },
  reviewScroll: {
    flex: 1,
  },
  reviewScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 16,
  },
  reviewSummaryCard: {
    borderRadius: 14,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.separator,
    padding: 16,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  reviewLabel: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  reviewValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
    textAlign: 'right',
    flexShrink: 1,
  },
  reviewRecipientList: {
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.separator,
  },
  reviewRecipient: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 18,
  },
  reviewRecipientMore: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textTertiary,
    marginTop: 4,
  },
  desktopOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    padding: 24,
  },
  desktopBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  desktopCard: {
    width: '100%',
    maxWidth: 560,
    height: '88%',
    maxHeight: '88%',
    backgroundColor: theme.groupedBackground,
    borderRadius: 16,
    overflow: 'hidden',
  },
});
