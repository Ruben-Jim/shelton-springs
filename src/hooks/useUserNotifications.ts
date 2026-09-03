import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../context/AuthContext';
import { useBrandSplash } from '../context/BrandSplashContext';
import { usePostLoginPrompts } from '../context/PostLoginPromptsContext';
import enhancedUnifiedNotificationManager from '../services/EnhancedUnifiedNotificationManager';
import { askForNotificationPermissionIfNeeded } from '../utils/ensureNotificationAccess';

/**
 * Hook to reactively get user notifications and trigger local push notifications
 * when new unread notifications are detected
 */
export const useUserNotifications = () => {
  const { user } = useAuth();
  const { visible: splashVisible } = useBrandSplash();
  const { isPromptBlocked, setNotificationPromptHandled } = usePostLoginPrompts();
  const userId = user?._id ? String(user._id) : undefined;
  const didAskThisSession = useRef(false);

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
  const updatePushToken = useMutation(api.residents.updatePushToken);

  // After splash, ask for notifications once per session — before other post-login modals.
  useEffect(() => {
    if (!user?._id || Platform.OS === 'web') {
      setNotificationPromptHandled(true);
      return;
    }
    if (splashVisible || isPromptBlocked) return;
    if (didAskThisSession.current) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled || isPromptBlocked) return;
      didAskThisSession.current = true;

      try {
        const result = await askForNotificationPermissionIfNeeded();
        if (cancelled) return;
        const token = result.token ?? enhancedUnifiedNotificationManager.getPushToken();
        if (token) {
          await updatePushToken({
            userId: user._id,
            expoPushToken: token,
          });
        }
      } catch (error) {
        console.warn('Failed to request or sync push token:', error);
      } finally {
        if (!cancelled) {
          setNotificationPromptHandled(true);
        }
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    user?._id,
    splashVisible,
    isPromptBlocked,
    updatePushToken,
    setNotificationPromptHandled,
  ]);

  // Unread notifications are delivered via server-scheduled Expo push.
  // Do not mirror them with local scheduleNotificationAsync — that caused duplicates.

  // Clean up when user changes
  useEffect(() => {
    didAskThisSession.current = false;
    setNotificationPromptHandled(false);
  }, [userId, setNotificationPromptHandled]);

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
