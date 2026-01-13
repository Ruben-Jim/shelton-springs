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
 * Notification triggers for specific app events
 */

export const notifyNewCommunityPost = async (
  author: string,
  title: string,
  category: string,
  convex?: ConvexReactClient
): Promise<void> => {
  // Send local notification for immediate feedback (post author)
  await triggerNotification({
    type: 'community_post',
    title: 'New Community Post',
    body: `${author} posted: ${title}`,
    priority: 'Medium',
    data: {
      author,
      title,
      category,
    },
  });

  // Create notification records for all residents
  if (convex) {
    try {
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
    } catch (error) {
      console.error('Failed to create notification records for residents:', error);
      // Don't throw - notification records are non-critical
    }
  }
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
  // Send local notification for immediate feedback (poll creator)
  await triggerNotification({
    type: 'poll',
    title: 'New Poll',
    body: `${createdBy} created a poll: ${title}`,
    priority: 'Medium',
    data: {
      title,
      createdBy,
    },
  });

  // Create notification records for all residents
  if (convex) {
    try {
      await convex.mutation(api.notifications.createNotificationForAllResidents, {
        type: 'poll',
        title: 'New Poll',
        body: `${createdBy} created a poll: ${title}`,
        data: {
          title,
          createdBy,
        },
      });
    } catch (error) {
      console.error('Failed to create notification records for residents:', error);
      // Don't throw - notification records are non-critical
    }
  }
};

export const notifyNewFee = async (feeName: string, amount: number, dueDate: string): Promise<void> => {
  await triggerNotification({
    type: 'fee',
    title: 'New Fee',
    body: `New fee: ${feeName} - $${amount.toFixed(2)} (Due: ${dueDate})`,
    priority: 'High',
    data: {
      feeName,
      amount,
      dueDate,
    },
  });
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

export const notifyNewFine = async (violation: string, amount: number, dueDate: string): Promise<void> => {
  await triggerNotification({
    type: 'fine',
    title: 'New Fine',
    body: `Fine issued: ${violation} - $${amount.toFixed(2)} (Due: ${dueDate})`,
    priority: 'High',
    data: {
      violation,
      amount,
      dueDate,
    },
  });
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
  // Send local notification for immediate feedback (notification creator)
  await triggerNotification({
    type: 'resident_notification',
    title: `Resident ${type}`,
    body: `${residentName} at ${address} is ${type.toLowerCase()}`,
    priority: 'Medium',
    data: {
      type,
      residentName,
      address,
    },
  });

  // Create notification records for all residents
  if (convex) {
    try {
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
    } catch (error) {
      console.error('Failed to create notification records for residents:', error);
      // Don't throw - notification records are non-critical
    }
  }
};

export const notifyBoardUpdate = async (updateType: string, details: string): Promise<void> => {
  await triggerNotification({
    type: 'board_update',
    title: 'Board Update',
    body: `${updateType}: ${details}`,
    priority: 'Medium',
    data: {
      updateType,
      details,
    },
  });
};

export const notifyPendingVenmoPayment = async (
  homeownerName: string,
  amount: number,
  feeType: string,
  convex?: ConvexReactClient
): Promise<void> => {
  // Send local notification for immediate feedback (homeowner)
  await triggerNotification({
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
  });

  // Create notification records for all board members
  if (convex) {
    try {
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
    } catch (error) {
      console.error('Failed to create notification records for board members:', error);
      // Don't throw - notification records are non-critical
    }
  }
};

export const notifyNewDocument = async (title: string, type: 'Minutes' | 'Financial', uploadedBy: string): Promise<void> => {
  await triggerNotification({
    type: 'document',
    title: `New ${type} Document`,
    body: `${uploadedBy} uploaded: ${title}`,
    priority: 'Medium',
    data: {
      title,
      type,
      uploadedBy,
    },
  });
};

