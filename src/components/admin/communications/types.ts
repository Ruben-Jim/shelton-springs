export type NoticeTemplateType = 'notice' | 'action_request' | 'reminder';
export type NoticeAudienceType = 'all' | 'homeowners' | 'renters' | 'custom';
export type NoticeChannel = 'push' | 'email' | 'both';

export type ResidentOption = {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  address: string;
  unitNumber?: string;
  isRenter: boolean;
  isResident: boolean;
};

export const TEMPLATE_LABELS: Record<NoticeTemplateType, string> = {
  notice: 'Community Notice',
  action_request: 'Yard Maintenance Compliance',
  reminder: 'Compliance Reminder',
};

export const AUDIENCE_LABELS: Record<NoticeAudienceType, string> = {
  all: 'All residents',
  homeowners: 'Homeowners only',
  renters: 'Renters only',
  custom: 'Selected residents',
};

export const CHANNEL_LABELS: Record<NoticeChannel, string> = {
  push: 'Push notification',
  email: 'Email',
  both: 'Push + Email',
};

export type NoticeTicketStatus = 'sending' | 'sent' | 'partial' | 'failed';

export const STATUS_LABELS: Record<NoticeTicketStatus, string> = {
  sending: 'Sending',
  sent: 'Delivered',
  partial: 'Partial',
  failed: 'Failed',
};

import { formatNoticeNumber } from '../../../constants/yardMaintenanceNotice';

export function formatTicketNumber(ticketId: string, noticeNumber?: number): string {
  if (noticeNumber != null && noticeNumber > 0) {
    return formatNoticeNumber(noticeNumber);
  }
  return `#${ticketId.slice(-6).toUpperCase()}`;
}

export function isComplianceTemplate(templateType: NoticeTemplateType): boolean {
  return templateType === 'action_request' || templateType === 'reminder';
}

export function getDeliveryFooterText(
  templateType: NoticeTemplateType,
  channels: NoticeChannel
): string | null {
  if (channels === 'push') {
    return 'Residents receive a push alert and an in-app notification.';
  }
  if (templateType === 'notice') {
    return 'Email uses the Shelton Springs branded community notice template with the resident\'s property address.';
  }
  return 'Email uses the official Shelton Springs yard maintenance compliance letter with the resident\'s property address and notice date.';
}
