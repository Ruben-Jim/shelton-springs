import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../context/AuthContext';
import enhancedUnifiedNotificationManager from '../services/EnhancedUnifiedNotificationManager';
import { isDemoBuild } from '../config/isDemoBuild';
import { useDemoQuery } from './useDemoQuery';
import { useDemoMutation } from './useDemoMutation';

/**
 * Hook to reactively get user notifications and trigger local push notifications
 * when new unread notifications are detected
 */
export const useUserNotifications = () => {
  const { user } = useAuth();
  const userId = user?._id ? String(user._id) : undefined;

  const unreadNotifications = useDemoQuery(
    api.notifications.getUnreadNotifications,
    userId ? { userId } : 'skip',
    (s, args) => s.unreadNotificationsByUserId[String(args.userId)] ?? []
  );

  const unreadCount = useDemoQuery(
    api.notifications.getUnreadCount,
    userId ? { userId } : 'skip',
    (s, args) => s.unreadCountByUserId[String(args.userId)] ?? 0
  );

  const markNotificationAsRead = useDemoMutation(api.notifications.markNotificationAsRead);
  const markAllNotificationsAsRead = useDemoMutation(api.notifications.markAllNotificationsAsRead);
  const updatePushToken = useDemoMutation(api.residents.updatePushToken);

  // Sync Expo push token to server (mobile only) for server-side push notifications
  useEffect(() => {
    if (isDemoBuild() || !user?._id || Platform.OS === 'web') return;

    const syncToken = async () => {
      const token = enhancedUnifiedNotificationManager.getPushToken();
      if (token) {
        try {
          await updatePushToken({
            userId: user!._id,
            expoPushToken: token,
          });
        } catch (error) {
          console.warn('Failed to sync push token:', error);
        }
      }
    };

    // Sync immediately and retry after delay (token may not be ready yet)
    syncToken();
    const retryTimer = setTimeout(syncToken, 3000);
    return () => clearTimeout(retryTimer);
  }, [user, updatePushToken]);

  // Track which notifications we've already shown to avoid duplicates
  const shownNotificationIds = useRef<Set<string>>(new Set());
  // On app restart, don't re-show existing unread; only show notifications that arrive while app is open
  const hasCompletedInitialLoad = useRef(false);

  // Watch for new notifications and trigger local push notifications
  useEffect(() => {
    if (!unreadNotifications || !userId) return;

    const alreadyShown = shownNotificationIds.current;

    // Initial load: mark all existing unread as "shown" without triggering local notifications
    if (!hasCompletedInitialLoad.current) {
      hasCompletedInitialLoad.current = true;
      unreadNotifications.forEach((n) => alreadyShown.add(n._id));
      return;
    }

    // Subsequent updates: only show local for notifications that arrived after initial load
    const newNotifications = unreadNotifications.filter(
      (notification) => !alreadyShown.has(notification._id)
    );

    // Show local push notification for each new unread notification
    newNotifications.forEach(async (notification) => {
      // Mark as shown
      shownNotificationIds.current.add(notification._id);

      // Determine notification type and priority based on notification.type
      let notificationType: 'Emergency' | 'Alert' | 'Info' = 'Info';
      let priority: 'High' | 'Medium' | 'Low' = 'Medium';

      switch (notification.type) {
        case 'fine':
        case 'fee':
        case 'payment_pending':
          notificationType = 'Alert';
          priority = 'High';
          break;
        case 'board_update':
          notificationType = 'Alert';
          priority = 'Medium';
          break;
        case 'message':
          notificationType = 'Alert';
          priority = 'High';
          break;
        case 'poll':
        case 'community_post':
        case 'resident_notification':
        case 'document':
          notificationType = 'Info';
          priority = 'Medium';
          break;
      }

      // Trigger local push notification
      try {
        await enhancedUnifiedNotificationManager.sendNotification({
          title: notification.title,
          body: notification.body,
          priority,
          type: notificationType,
          category: notification.type,
          data: {
            ...notification.data,
            notificationId: notification._id,
            notificationType: notification.type,
            timestamp: notification.createdAt,
          },
          sound: true,
          vibrate: true,
        });
      } catch (error) {
        console.error('Failed to send local notification:', error);
      }
    });
  }, [unreadNotifications, userId]);

  // Clean up when user changes
  useEffect(() => {
    shownNotificationIds.current.clear();
    hasCompletedInitialLoad.current = false;
  }, [userId]);

  const markOne = useCallback(
    async (notificationId: string) => {
      await markNotificationAsRead({ notificationId: notificationId as any });
    },
    [markNotificationAsRead]
  );

  const markAll = useCallback(async () => {
    if (userId) {
      await markAllNotificationsAsRead({ userId });
    }
  }, [markAllNotificationsAsRead, userId]);

  return {
    unreadNotifications: unreadNotifications || [],
    unreadCount: unreadCount ?? 0,
    markNotificationAsRead: markOne,
    markAllNotificationsAsRead: markAll,
  };
};
