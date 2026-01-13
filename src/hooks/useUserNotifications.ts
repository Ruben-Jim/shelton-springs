import { useEffect, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../context/AuthContext';
import enhancedUnifiedNotificationManager from '../services/EnhancedUnifiedNotificationManager';

/**
 * Hook to reactively get user notifications and trigger local push notifications
 * when new unread notifications are detected
 */
export const useUserNotifications = () => {
  const { user } = useAuth();
  const userId = user?._id ? String(user._id) : undefined;

  // Get unread notifications reactively
  const unreadNotifications = useQuery(
    api.notifications.getUnreadNotifications,
    userId ? { userId } : 'skip'
  );

  // Get unread count
  const unreadCount = useQuery(
    api.notifications.getUnreadCount,
    userId ? { userId } : 'skip'
  );

  // Mutations
  const markNotificationAsRead = useMutation(api.notifications.markNotificationAsRead);
  const markAllNotificationsAsRead = useMutation(api.notifications.markAllNotificationsAsRead);

  // Track which notifications we've already shown to avoid duplicates
  const shownNotificationIds = useRef<Set<string>>(new Set());

  // Watch for new notifications and trigger local push notifications
  useEffect(() => {
    if (!unreadNotifications || !userId) return;

    // Filter out notifications we've already shown
    const newNotifications = unreadNotifications.filter(
      (notification) => !shownNotificationIds.current.has(notification._id)
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

  // Clean up shown notification IDs when user changes
  useEffect(() => {
    shownNotificationIds.current.clear();
  }, [userId]);

  return {
    unreadNotifications: unreadNotifications || [],
    unreadCount: unreadCount ?? 0,
    markNotificationAsRead: async (notificationId: string) => {
      await markNotificationAsRead({ notificationId: notificationId as any });
    },
    markAllNotificationsAsRead: async () => {
      if (userId) {
        await markAllNotificationsAsRead({ userId });
      }
    },
  };
};
