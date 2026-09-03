export const YARD_MAINTENANCE_CHECKLIST = [
  'Lawn needs mowing',
  'Weeds need to be removed',
  'Flower beds need maintenance/manicuring',
  'Trees or shrubs need trimming',
  'Yard or driveway contains debris, trash, or other accumulated materials',
  'Other: __________',
] as const;

export const YARD_MAINTENANCE_OTHER_VIOLATION = YARD_MAINTENANCE_CHECKLIST[5];

export function isOtherViolationItem(item: string): boolean {
  return item === YARD_MAINTENANCE_OTHER_VIOLATION || item.startsWith('Other: ');
}

export function formatOtherViolationDetail(detail: string): string {
  const trimmed = detail.trim();
  return trimmed ? `Other: ${trimmed}` : YARD_MAINTENANCE_OTHER_VIOLATION;
}

/** Standard checklist keys plus resolved "Other: …" lines for send/preview. */
export function resolveSelectedViolations(
  selected: string[],
  otherDetail: string
): string[] {
  return selected.flatMap((item) => {
    if (item === YARD_MAINTENANCE_OTHER_VIOLATION) {
      const trimmed = otherDetail.trim();
      return trimmed ? [`Other: ${trimmed}`] : [];
    }
    return [item];
  });
}

export function violationsStepIsValid(selected: string[], otherDetail: string): boolean {
  const resolved = resolveSelectedViolations(selected, otherDetail);
  if (resolved.length === 0) return false;
  if (
    selected.includes(YARD_MAINTENANCE_OTHER_VIOLATION) &&
    otherDetail.trim().length === 0
  ) {
    return false;
  }
  return true;
}

export function formatNoticeNumber(noticeNumber: number): string {
  return `#${String(noticeNumber).padStart(4, '0')}`;
}

export function sortViolationsForDisplay(items: string[]): string[] {
  const otherItems = items.filter(
    (item) => item.startsWith('Other: ') && item !== YARD_MAINTENANCE_OTHER_VIOLATION
  );
  const standardItems = items.filter(
    (item) => !item.startsWith('Other: ') && item !== YARD_MAINTENANCE_OTHER_VIOLATION
  );
  return [...otherItems, ...standardItems];
}

export function formatNoticeDate(noticeDateMs?: number): string {
  const date = noticeDateMs ? new Date(noticeDateMs) : new Date();
  return date.toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: '2-digit',
  });
}
