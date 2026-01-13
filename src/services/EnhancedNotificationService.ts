import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Enhanced notification configuration with better error handling
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface EnhancedNotificationData {
  title: string;
  body: string;
  data?: any;
  priority?: 'high' | 'normal' | 'low';
  category?: string;
  sound?: boolean;
  vibrate?: boolean;
  badge?: number;
  channelId?: string; // Android specific
}

export interface NotificationSettings {
  emergency: boolean;
  alerts: boolean;
  info: boolean;
  sound: boolean;
  vibrate: boolean;
  badge: boolean;
}

class EnhancedNotificationService {
  private static instance: EnhancedNotificationService;
  private isInitialized = false;
  private permissionStatus: Notifications.PermissionStatus | null = null;
  private pushToken: string | null = null;
  private notificationSettings: NotificationSettings | null = null;
  private retryAttempts = 0;
  private maxRetries = 3;

  private constructor() {}

  public static getInstance(): EnhancedNotificationService {
    if (!EnhancedNotificationService.instance) {
      EnhancedNotificationService.instance = new EnhancedNotificationService();
    }
    return EnhancedNotificationService.instance;
  }

  /**
   * Initialize the enhanced notification service
   */
  public async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    try {
      // Load saved settings
      await this.loadSettings();
      
      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
          },
        });
        finalStatus = status;
      }

      this.permissionStatus = finalStatus;
      this.isInitialized = true;

      // Configure notification categories
      await this.configureNotificationCategories();

      // Get push token for remote notifications (skip on web)
      if (finalStatus === 'granted' && Platform.OS !== 'web') {
        await this.getPushToken();
      }

      return finalStatus === 'granted';
    } catch (error) {
      console.error('Failed to initialize EnhancedNotificationService:', error);
      return false;
    }
  }

  /**
   * Load notification settings from storage
   */
  private async loadSettings(): Promise<void> {
    try {
      const savedSettings = await AsyncStorage.getItem('notificationSettings');
      if (savedSettings) {
        this.notificationSettings = JSON.parse(savedSettings);
      } else {
        // Default settings
        this.notificationSettings = {
          emergency: true,
          alerts: true,
          info: true,
          sound: true,
          vibrate: true,
          badge: true,
        };
        await this.saveSettings();
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
      this.notificationSettings = {
        emergency: true,
        alerts: true,
        info: true,
        sound: true,
        vibrate: true,
        badge: true,
      };
    }
  }

  /**
   * Save notification settings to storage
   */
  private async saveSettings(): Promise<void> {
    try {
      if (this.notificationSettings) {
        await AsyncStorage.setItem('notificationSettings', JSON.stringify(this.notificationSettings));
      }
    } catch (error) {
      console.error('Failed to save notification settings:', error);
    }
  }

  /**
   * Get push token for remote notifications
   */
  private async getPushToken(): Promise<void> {
    try {
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: 'a30576d8-ca43-4d96-8957-d6080ae9076d', // From app.json
      });
      this.pushToken = token.data;
    } catch (error) {
      console.error('Failed to get push token:', error);
    }
  }

  /**
   * Configure notification categories with better organization
   */
  private async configureNotificationCategories(): Promise<void> {
    try {
      // Alert category
      await Notifications.setNotificationCategoryAsync('alert', [
        {
          identifier: 'view_action',
          buttonTitle: 'View Alert',
          options: {
            opensAppToForeground: true,
          },
        },
        {
          identifier: 'dismiss_action',
          buttonTitle: 'Dismiss',
          options: {
            opensAppToForeground: false,
          },
        },
      ]);

      // Info category
      await Notifications.setNotificationCategoryAsync('info', [
        {
          identifier: 'view_action',
          buttonTitle: 'View Info',
          options: {
            opensAppToForeground: true,
          },
        },
      ]);
    } catch (error) {
      console.error('Failed to configure notification categories:', error);
    }
  }

  /**
   * Check if notifications are enabled
   */
  public isEnabled(): boolean {
    return this.permissionStatus === 'granted';
  }

  /**
   * Get current permission status
   */
  public getPermissionStatus(): Notifications.PermissionStatus | null {
    return this.permissionStatus;
  }

  /**
   * Get push token (for server-side notifications)
   */
  public getPushTokenValue(): string | null {
    return this.pushToken;
  }

  /**
   * Get notification settings
   */
  public getSettings(): NotificationSettings | null {
    return this.notificationSettings;
  }

  /**
   * Update notification settings
   */
  public async updateSettings(settings: Partial<NotificationSettings>): Promise<void> {
    if (this.notificationSettings) {
      this.notificationSettings = { ...this.notificationSettings, ...settings };
      await this.saveSettings();
    }
  }

  /**
   * Request notification permissions with better UX
   */
  public async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      
      this.permissionStatus = status;
      
      if (status === 'granted') {
        await this.getPushToken();
      }
      
      return status === 'granted';
    } catch (error) {
      console.error('Failed to request notification permissions:', error);
      return false;
    }
  }

  /**
   * Send a local notification with enhanced features
   */
  public async sendLocalNotification(
    notificationData: EnhancedNotificationData,
    retryCount = 0
  ): Promise<string | null> {
    if (!this.isEnabled()) {
      console.warn('Notifications not enabled, cannot send notification');
      return null;
    }

    // Check if user has enabled this type of notification
    if (!this.shouldSendNotification(notificationData.data?.type)) {
      return null;
    }

    try {
      // Build notification content, only including badge if it has a valid value
      const notificationContent: Notifications.NotificationContentInput = {
        title: notificationData.title,
        body: notificationData.body,
        data: notificationData.data || {},
        categoryIdentifier: notificationData.category || 'info',
        priority: notificationData.priority || 'normal',
        sound: this.notificationSettings?.sound ? notificationData.sound !== false : false,
        vibrate: this.notificationSettings?.vibrate ? (notificationData.vibrate !== false ? [0, 250, 250, 250] : []) : [],
      };
      
      // Only set badge if it's a valid number (iOS crashes with undefined/null badge)
      if (this.notificationSettings?.badge && typeof notificationData.badge === 'number') {
        notificationContent.badge = notificationData.badge;
      }
      
      // Add Android channel ID if specified
      if (Platform.OS === 'android' && notificationData.channelId) {
        notificationContent.channelId = notificationData.channelId;
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: notificationContent,
        trigger: null, // Show immediately
      });

      this.retryAttempts = 0; // Reset retry counter on success
      return notificationId;
    } catch (error) {
      console.error('Failed to send local notification:', error);
      
      // Implement retry logic with exponential backoff
      if (retryCount < this.maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
        setTimeout(() => {
          this.sendLocalNotification(notificationData, retryCount + 1);
        }, delay);
      }
      
      return null;
    }
  }

  /**
   * Check if notification should be sent based on user settings
   */
  private shouldSendNotification(type?: string): boolean {
    if (!this.notificationSettings) return true;
    
    // Map notification types to settings
    switch (type) {
      case 'community_post':
      case 'poll':
      case 'resident_notification':
      case 'document':
        // These are info notifications
        return this.notificationSettings.info;
      case 'payment_pending':
      case 'fee':
      case 'fine':
      case 'board_update':
      case 'message':
        // These are alerts
        return this.notificationSettings.alerts;
      case 'emergency':
        // Emergency notifications are always enabled for safety
        return true;
      default:
        // Default to allowing if type is unknown
        return true;
    }
  }

  /**
   * Send regular alert notification
   */
  public async sendAlert(
    title: string,
    content: string,
    priority: 'High' | 'Medium' | 'Low' = 'Medium'
  ): Promise<string | null> {
    const priorityMap = {
      High: 'high' as const,
      Medium: 'normal' as const,
      Low: 'low' as const,
    };

    return this.sendLocalNotification({
      title: `⚠️ ${title}`,
      body: content,
      priority: priorityMap[priority],
      category: 'alert',
      sound: priority === 'High',
      vibrate: priority === 'High',
      data: {
        type: 'alert',
        priority,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Send info notification
   */
  public async sendInfo(
    title: string,
    content: string
  ): Promise<string | null> {
    return this.sendLocalNotification({
      title: `ℹ️ ${title}`,
      body: content,
      priority: 'normal',
      category: 'info',
      sound: false,
      vibrate: false,
      data: {
        type: 'info',
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Cancel a specific notification
   */
  public async cancelNotification(notificationId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (error) {
      console.error('Failed to cancel notification:', error);
    }
  }

  /**
   * Cancel all notifications
   */
  public async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Failed to cancel all notifications:', error);
    }
  }

  /**
   * Get all scheduled notifications
   */
  public async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    try {
      return await Notifications.getAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Failed to get scheduled notifications:', error);
      return [];
    }
  }

  /**
   * Handle notification response (when user taps notification)
   */
  public addNotificationResponseListener(
    listener: (response: Notifications.NotificationResponse) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationResponseReceivedListener(listener);
  }

  /**
   * Handle notification received (when app is in foreground)
   */
  public addNotificationReceivedListener(
    listener: (notification: Notifications.Notification) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationReceivedListener(listener);
  }

  /**
   * Get notification statistics
   */
  public async getNotificationStats(): Promise<{
    enabled: boolean;
    permissionStatus: string;
    pushToken: string | null;
    scheduledCount: number;
    settings: NotificationSettings | null;
  }> {
    const scheduled = await this.getScheduledNotifications();
    
    return {
      enabled: this.isEnabled(),
      permissionStatus: this.permissionStatus || 'unknown',
      pushToken: this.pushToken,
      scheduledCount: scheduled.length,
      settings: this.notificationSettings,
    };
  }
}

// Export singleton instance
export const enhancedNotificationService = EnhancedNotificationService.getInstance();
export default enhancedNotificationService;
