/** Preset decline reasons for comment moderation. */
export const COMMENT_DECLINE_REASONS = [
  {
    key: 'inappropriate',
    label: 'Inappropriate / offensive language',
    message: 'Your comment was declined because it contained inappropriate or offensive language.',
  },
  {
    key: 'off_topic',
    label: 'Off-topic / not community-related',
    message: 'Your comment was declined because it was off-topic or not community-related.',
  },
  {
    key: 'spam',
    label: 'Spam or advertising',
    message: 'Your comment was declined because it appeared to be spam or advertising.',
  },
  {
    key: 'personal_attack',
    label: 'Personal attack / conflict',
    message: 'Your comment was declined because it involved a personal attack or conflict.',
  },
  {
    key: 'guidelines',
    label: 'Violates community guidelines',
    message: 'Your comment was declined because it violates community guidelines.',
  },
  {
    key: 'no_reason',
    label: 'No reason',
    message: 'Your comment was not approved by the board.',
  },
  {
    key: 'custom',
    label: 'Custom…',
    message: '',
  },
] as const;

export type CommentDeclineReasonKey = (typeof COMMENT_DECLINE_REASONS)[number]['key'];

export const GENERIC_DECLINE_MESSAGE = 'Your comment was not approved by the board.';

export function resolveDeclineMessage(
  key: string,
  customText?: string,
): string {
  if (key === 'custom') {
    const trimmed = (customText ?? '').trim();
    return trimmed || GENERIC_DECLINE_MESSAGE;
  }
  const preset = COMMENT_DECLINE_REASONS.find((r) => r.key === key);
  return preset?.message || GENERIC_DECLINE_MESSAGE;
}

export function getCommentStatus(
  comment: { status?: string | null },
): 'pending' | 'approved' | 'declined' {
  if (comment.status === 'pending' || comment.status === 'declined') {
    return comment.status;
  }
  return 'approved';
}
