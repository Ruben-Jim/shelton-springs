import { NavigationContainerRef } from '@react-navigation/native';

type AppParamList = {
  ResidentNotice: { ticketId: string };
  [key: string]: object | undefined;
};

type PendingNoticeNavigation = {
  ticketId: string;
};

let navigationRef: NavigationContainerRef<AppParamList> | null = null;
let pendingNotice: PendingNoticeNavigation | null = null;

export function registerNotificationNavigationRef(
  ref: NavigationContainerRef<any> | null
) {
  navigationRef = ref as NavigationContainerRef<AppParamList> | null;
}

export function navigateToResidentNotice(ticketId: string) {
  if (!ticketId) return;

  if (navigationRef?.isReady()) {
    navigationRef.navigate('ResidentNotice', { ticketId });
    pendingNotice = null;
    return;
  }

  pendingNotice = { ticketId };
}

export function flushPendingNoticeNavigation() {
  if (!pendingNotice || !navigationRef?.isReady()) return;
  navigationRef.navigate('ResidentNotice', {
    ticketId: pendingNotice.ticketId,
  });
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
