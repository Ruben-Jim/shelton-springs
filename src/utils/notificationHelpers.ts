import { Platform } from 'react-native';
import enhancedUnifiedNotificationManager from '../services/EnhancedUnifiedNotificationManager';
import { ConvexReactClient } from 'convex/react';
import { api } from '../../convex/_generated/api';

/**
 * Notification helper utilities for app-wide notification triggers
 * Works on both mobile (native push) and web (browser notifications)
 */

export interface NotificationTriggerData {
  type: 'community_post' | 'poll' | 'fee' | 'fine' | 'message' | 'resident_notification' | 'board_update' | 'document' | 'payment_pending';
  title: string;
  body: string;
  priority?: 'High' | 'Medium' | 'Low';
  data?: any;
}

/**
 * Request permission for web browser notifications
 */
const requestWebNotificationPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'web') return false;
  
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      return true;
    }
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
  }
  return false;
};

/**
 * Send a web browser notification
 */
const sendWebNotification = async (title: string, body: string, icon?: string): Promise<void> => {
  if (Platform.OS !== 'web') return;
  
  const hasPermission = await requestWebNotificationPermission();
  if (!hasPermission) {
    return;
  }

  try {
    // Create the notification
    const notification = new Notification(title, {
      body,
      icon: icon || '/favicon.ico',
      badge: '/favicon.ico',
      tag: `shelton-springs-${Date.now()}`,
      requireInteraction: false,
    });

    // Auto close after 5 seconds
    setTimeout(() => {
      notification.close();
    }, 5000);

    // Handle notification click
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch (error) {
    console.error('Failed to send web notification:', error);
  }
};

/**
 * Send a notification based on the trigger type
 * Works on mobile (native push) and web (browser notifications)
 */
export const triggerNotification = async (data: NotificationTriggerData): Promise<void> => {
  // Handle web notifications
  if (Platform.OS === 'web') {
    await sendWebNotification(data.title, data.body);
    return;
  }

  try {
    // Determine notification type based on trigger type
    let notificationType: 'Emergency' | 'Alert' | 'Info' = 'Info';
    let priority: 'High' | 'Medium' | 'Low' = data.priority || 'Medium';

    switch (data.type) {
      case 'fine':
      case 'fee':
      case 'payment_pending':
        // Fees, fines, and pending payments are alerts
        notificationType = 'Alert';
        priority = data.priority || 'High';
        break;
      case 'board_update':
        // Board updates are alerts
        notificationType = 'Alert';
        priority = data.priority || 'Medium';
        break;
      case 'message':
        // Messages are alerts
        notificationType = 'Alert';
        priority = data.priority || 'High';
        break;
      case 'poll':
      case 'community_post':
      case 'resident_notification':
      case 'document':
        // These are info notifications
        notificationType = 'Info';
        priority = data.priority || 'Medium';
        break;
    }

    await enhancedUnifiedNotificationManager.sendNotification({
      title: data.title,
      body: data.body,
      priority,
      type: notificationType,
      category: data.type,
      data: {
        ...data.data,
        notificationType: data.type,
        timestamp: Date.now(),
      },
      sound: true,
      vibrate: true,
    });
  } catch (error) {
    console.error(`Failed to send ${data.type} notification:`, error);
    // Don't throw - notifications are non-critical
  }
};

/**
 * Persist notification records (and server Expo push on mobile) when available.
 * Only show an immediate local/browser notification on web or when no server path exists.
 */
async function deliverNotification(
  data: NotificationTriggerData,
  persist?: () => Promise<void>
): Promise<void> {
  if (persist) {
    try {
      await persist();
    } catch (error) {
      console.error('Failed to create notification records:', error);
    }
    if (Platform.OS !== 'web') {
      return;
    }
  }

  await triggerNotification(data);
}

/**
 * Notification triggers for specific app events
 */

export const notifyNewCommunityPost = async (
  author: string,
  title: string,
  category: string,
  convex?: ConvexReactClient
): Promise<void> => {
  await deliverNotification(
    {
      type: 'community_post',
      title: 'New Community Post',
      body: `${author} posted: ${title}`,
      priority: 'Medium',
      data: {
        author,
        title,
        category,
      },
    },
    convex
      ? async () => {
          await convex.mutation(api.notifications.createNotificationForAllResidents, {
            type: 'community_post',
            title: 'New Community Post',
            body: `${author} posted: ${title}`,
            data: {
              author,
              title,
              category,
            },
          });
        }
      : undefined
  );
};

export const notifyNewComment = async (author: string, postTitle: string): Promise<void> => {
  await triggerNotification({
    type: 'community_post',
    title: 'New Comment',
    body: `${author} commented on: ${postTitle}`,
    priority: 'Medium',
    data: {
      author,
      postTitle,
    },
  });
};

export const notifyNewPoll = async (
  title: string,
  createdBy: string,
  convex?: ConvexReactClient
): Promise<void> => {
  await deliverNotification(
    {
      type: 'poll',
      title: 'New Poll',
      body: `${createdBy} created a poll: ${title}`,
      priority: 'Medium',
      data: {
        title,
        createdBy,
      },
    },
    convex
      ? async () => {
          await convex.mutation(api.notifications.createNotificationForAllResidents, {
            type: 'poll',
            title: 'New Poll',
            body: `${createdBy} created a poll: ${title}`,
            data: {
              title,
              createdBy,
            },
          });
        }
      : undefined
  );
};

export const notifyNewFee = async (
  feeName: string,
  amount: number,
  dueDate: string,
  convex?: ConvexReactClient,
  notifyAllResidents?: boolean
): Promise<void> => {
  await deliverNotification(
    {
      type: 'fee',
      title: 'New Fee',
      body: `New fee: ${feeName} - $${amount.toFixed(2)} (Due: ${dueDate})`,
      priority: 'High',
      data: {
        feeName,
        amount,
        dueDate,
      },
    },
    convex && notifyAllResidents
      ? async () => {
          await convex.mutation(api.notifications.createNotificationForAllResidents, {
            type: 'fee',
            title: 'New Fee',
            body: `New fee: ${feeName} - $${amount.toFixed(2)} (Due: ${dueDate})`,
            data: { feeName, amount, dueDate },
          });
        }
      : undefined
  );
};

export const notifyOverdueFee = async (feeName: string, amount: number): Promise<void> => {
  await triggerNotification({
    type: 'fee',
    title: 'Overdue Fee',
    body: `Overdue: ${feeName} - $${amount.toFixed(2)}`,
    priority: 'High',
    data: {
      feeName,
      amount,
      isOverdue: true,
    },
  });
};

export const notifyNewFine = async (
  violation: string,
  amount: number,
  dueDate: string,
  residentId?: string,
  convex?: ConvexReactClient
): Promise<void> => {
  await deliverNotification(
    {
      type: 'fine',
      title: 'New Fine',
      body: `Fine issued: ${violation} - $${amount.toFixed(2)} (Due: ${dueDate})`,
      priority: 'High',
      data: {
        violation,
        amount,
        dueDate,
      },
    },
    convex && residentId
      ? async () => {
          await convex.mutation(api.notifications.createNotificationForUsers, {
            userIds: [residentId],
            type: 'fine',
            title: 'New Fine',
            body: `Fine issued: ${violation} - $${amount.toFixed(2)} (Due: ${dueDate})`,
            data: { violation, amount, dueDate },
          });
        }
      : undefined
  );
};

export const notifyOverdueFine = async (violation: string, amount: number): Promise<void> => {
  await triggerNotification({
    type: 'fine',
    title: 'Overdue Fine',
    body: `Overdue fine: ${violation} - $${amount.toFixed(2)}`,
    priority: 'High',
    data: {
      violation,
      amount,
      isOverdue: true,
    },
  });
};

export const notifyNewMessage = async (senderName: string, content: string, isBoardMember: boolean): Promise<void> => {
  const senderLabel = isBoardMember ? 'Board Member' : senderName;
  await triggerNotification({
    type: 'message',
    title: `New Message from ${senderLabel}`,
    body: content.length > 50 ? `${content.substring(0, 50)}...` : content,
    priority: 'High',
    data: {
      senderName,
      content,
      isBoardMember,
    },
  });
};

export const notifyResidentNotification = async (
  type: 'Selling' | 'Moving',
  residentName: string,
  address: string,
  convex?: ConvexReactClient
): Promise<void> => {
  await deliverNotification(
    {
      type: 'resident_notification',
      title: `Resident ${type}`,
      body: `${residentName} at ${address} is ${type.toLowerCase()}`,
      priority: 'Medium',
      data: {
        type,
        residentName,
        address,
      },
    },
    convex
      ? async () => {
          await convex.mutation(api.notifications.createNotificationForAllResidents, {
            type: 'resident_notification',
            title: `Resident ${type}`,
            body: `${residentName} at ${address} is ${type.toLowerCase()}`,
            data: {
              type,
              residentName,
              address,
            },
          });
        }
      : undefined
  );
};

export const notifyBoardUpdate = async (
  updateType: string,
  details: string,
  convex?: ConvexReactClient
): Promise<void> => {
  await deliverNotification(
    {
      type: 'board_update',
      title: 'Board Update',
      body: `${updateType}: ${details}`,
      priority: 'Medium',
      data: {
        updateType,
        details,
      },
    },
    convex
      ? async () => {
          await convex.mutation(api.notifications.createNotificationForAllResidents, {
            type: 'board_update',
            title: 'Board Update',
            body: `${updateType}: ${details}`,
            data: { updateType, details },
          });
        }
      : undefined
  );
};

export const notifyPendingVenmoPayment = async (
  homeownerName: string,
  amount: number,
  feeType: string,
  convex?: ConvexReactClient
): Promise<void> => {
  await deliverNotification(
    {
      type: 'payment_pending',
      title: '💳 Venmo Payment Pending Verification',
      body: `${homeownerName} submitted $${amount.toFixed(2)} for ${feeType} - needs verification`,
      priority: 'High',
      data: {
        homeownerName,
        amount,
        feeType,
        pendingVerification: true,
      },
    },
    convex
      ? async () => {
          await convex.mutation(api.notifications.createNotificationForBoardMembers, {
            type: 'payment_pending',
            title: '💳 Venmo Payment Pending Verification',
            body: `${homeownerName} submitted $${amount.toFixed(2)} for ${feeType} - needs verification`,
            data: {
              homeownerName,
              amount,
              feeType,
              pendingVerification: true,
            },
          });
        }
      : undefined
  );
};

export const notifyNewDocument = async (
  title: string,
  docType: 'Minutes' | 'Financial',
  uploadedBy: string,
  convex?: ConvexReactClient
): Promise<void> => {
  await deliverNotification(
    {
      type: 'document',
      title: `New ${docType} Document`,
      body: `${uploadedBy} uploaded: ${title}`,
      priority: 'Medium',
      data: {
        title,
        type: docType,
        uploadedBy,
      },
    },
    convex
      ? async () => {
          await convex.mutation(api.notifications.createNotificationForAllResidents, {
            type: 'document',
            title: `New ${docType} Document`,
            body: `${uploadedBy} uploaded: ${title}`,
            data: { title, type: docType, uploadedBy },
          });
        }
      : undefined
  );
};

