import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import enhancedUnifiedNotificationManager from '../services/EnhancedUnifiedNotificationManager';
import {
  flushPendingNoticeNavigation,
  navigateToResidentNotice,
  parseNoticeNavigationData,
} from '../navigation/notificationNavigation';

function handleNotificationResponse(response: Notifications.NotificationResponse | null) {
  if (!response) return;

  const data = response.notification.request.content.data as Record<string, unknown>;
  const ticketId = parseNoticeNavigationData(data);
  if (ticketId) {
    navigateToResidentNotice(ticketId);
  }
}

export function useNotificationNavigation(isAuthenticated: boolean) {
  const handledColdStart = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || Platform.OS === 'web') return;

    enhancedUnifiedNotificationManager.initialize().catch(() => undefined);

    enhancedUnifiedNotificationManager.setupNotificationHandlers(
      undefined,
      (response) => handleNotificationResponse(response)
    );

    if (!handledColdStart.current) {
      handledColdStart.current = true;
      void Notifications.getLastNotificationResponseAsync().then(handleNotificationResponse);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    flushPendingNoticeNavigation();
  }, [isAuthenticated]);
}

export function onNavigationReadyForNotifications() {
  flushPendingNoticeNavigation();
}
