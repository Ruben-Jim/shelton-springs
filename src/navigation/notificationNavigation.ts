import { NavigationContainerRef } from '@react-navigation/native';

type PendingNoticeNavigation = {
  ticketId: string;
};

let navigationRef: NavigationContainerRef<any> | null = null;
let pendingNotice: PendingNoticeNavigation | null = null;

export function registerNotificationNavigationRef(
  ref: NavigationContainerRef<any> | null
) {
  navigationRef = ref;
}

export function navigateToResidentNotice(ticketId: string) {
  if (!ticketId) return;

  if (navigationRef?.isReady()) {
    navigationRef.navigate('ResidentNotice' as never, { ticketId } as never);
    pendingNotice = null;
    return;
  }

  pendingNotice = { ticketId };
}

export function flushPendingNoticeNavigation() {
  if (!pendingNotice || !navigationRef?.isReady()) return;
  navigationRef.navigate(
    'ResidentNotice' as never,
    { ticketId: pendingNotice.ticketId } as never
  );
  pendingNotice = null;
}

export function parseNoticeNavigationData(
  data: Record<string, unknown> | undefined | null
): string | null {
  if (!data) return null;

  const ticketId = data.ticketId;
  if (typeof ticketId === 'string' && ticketId.length > 0) {
    return ticketId;
  }

  return null;
}
