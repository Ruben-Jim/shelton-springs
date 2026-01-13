import { Platform } from 'react-native';
import enhancedNotificationService, { EnhancedNotificationData, NotificationSettings } from './EnhancedNotificationService';
import enhancedWebNotificationService, { EnhancedWebNotificationData, WebNotificationSettings } from './EnhancedWebNotificationService';

export interface UnifiedNotificationData {
  title: string;
  body: string;
  priority?: 'High' | 'Medium' | 'Low';
  type?: 'Emergency' | 'Alert' | 'Info';
  category?: string;
  data?: any;
  sound?: boolean;
  vibrate?: boolean;
  badge?: number;
}

export interface UnifiedNotificationSettings {
  emergency: boolean;
  alerts: boolean;
  info: boolean;
  sound: boolean;
  vibrate: boolean;
  badge: boolean;
  requireInteraction?: boolean; // Web only
}

class EnhancedUnifiedNotificationManager {
  private static instance: EnhancedUnifiedNotificationManager;
  private isInitialized = false;
  private initializationPromise: Promise<boolean> | null = null;

  private constructor() {}

  public static getInstance(): EnhancedUnifiedNotificationManager {
    if (!EnhancedUnifiedNotificationManager.instance) {
      EnhancedUnifiedNotificationManager.instance = new EnhancedUnifiedNotificationManager();
    }
    return EnhancedUnifiedNotificationManager.instance;
  }

  /**
   * Initialize the enhanced unified notification manager
   */
  public async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    // Prevent multiple simultaneous initializations
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.performInitialization();
    const result = await this.initializationPromise;
    this.initializationPromise = null;
    return result;
  }

  private async performInitialization(): Promise<boolean> {
    try {
      let mobileEnabled = false;
      let webEnabled = false;

      // Initialize mobile notifications
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        mobileEnabled = await enhancedNotificationService.initialize();
      }

      // Initialize web notifications
      if (Platform.OS === 'web') {
        webEnabled = await enhancedWebNotificationService.initialize();
      }

      this.isInitialized = true;
      const success = mobileEnabled || webEnabled;


      // Log web-specific information

      return success;
    } catch (error) {
      console.error('Failed to initialize EnhancedUnifiedNotificationManager:', error);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Check if notifications are enabled for the current platform
   */
  public isEnabled(): boolean {
    if (Platform.OS === 'web') {
      return enhancedWebNotificationService.isEnabled();
    } else {
      return enhancedNotificationService.isEnabled();
    }
  }

  /**
   * Get permission status for the current platform
   */
  public getPermissionStatus(): string {
    if (Platform.OS === 'web') {
      return enhancedWebNotificationService.getPermissionStatus();
    } else {
      return enhancedNotificationService.getPermissionStatus() || 'denied';
    }
  }

  /**
   * Get push token (mobile only)
   */
  public getPushToken(): string | null {
    if (Platform.OS === 'web') {
      return null;
    }
    return enhancedNotificationService.getPushTokenValue();
  }

  /**
   * Request notification permissions for the current platform
   */
  public async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'web') {
      return enhancedWebNotificationService.requestPermissions();
    } else {
      return enhancedNotificationService.requestPermissions();
    }
  }

  /**
   * Get notification settings
   */
  public getSettings(): UnifiedNotificationSettings | null {
    if (Platform.OS === 'web') {
      const webSettings = enhancedWebNotificationService.getSettings();
      if (!webSettings) return null;
      
      return {
        emergency: webSettings.emergency,
        alerts: webSettings.alerts,
        info: webSettings.info,
        sound: webSettings.sound,
        vibrate: true, // Web doesn't have vibrate
        badge: true,   // Web doesn't have badge
        requireInteraction: webSettings.requireInteraction,
      };
    } else {
      const mobileSettings = enhancedNotificationService.getSettings();
      if (!mobileSettings) return null;
      
      return {
        emergency: mobileSettings.emergency,
        alerts: mobileSettings.alerts,
        info: mobileSettings.info,
        sound: mobileSettings.sound,
        vibrate: mobileSettings.vibrate,
        badge: mobileSettings.badge,
      };
    }
  }

  /**
   * Update notification settings
   */
  public async updateSettings(settings: Partial<UnifiedNotificationSettings>): Promise<void> {
    if (Platform.OS === 'web') {
      const webSettings: Partial<WebNotificationSettings> = {
        emergency: settings.emergency,
        alerts: settings.alerts,
        info: settings.info,
        sound: settings.sound,
        requireInteraction: settings.requireInteraction,
      };
      await enhancedWebNotificationService.updateSettings(webSettings);
    } else {
      const mobileSettings: Partial<NotificationSettings> = {
        emergency: settings.emergency,
        alerts: settings.alerts,
        info: settings.info,
        sound: settings.sound,
        vibrate: settings.vibrate,
        badge: settings.badge,
      };
      await enhancedNotificationService.updateSettings(mobileSettings);
    }
  }

  /**
   * Send a notification (platform-appropriate)
   */
  public async sendNotification(notificationData: UnifiedNotificationData): Promise<string | null> {
    if (!this.isEnabled()) {
      console.warn('Notifications not enabled, cannot send notification');
      return null;
    }

    try {
      if (Platform.OS === 'web') {
        const webNotification = await enhancedWebNotificationService.sendNotification({
          title: notificationData.title,
          body: notificationData.body,
          data: notificationData.data,
          requireInteraction: notificationData.priority === 'High',
          tag: `${notificationData.type?.toLowerCase() || 'info'}-${Date.now()}`,
          silent: !notificationData.sound,
        });
        return webNotification ? 'web-notification' : null;
      } else {
        const mobileNotification = await enhancedNotificationService.sendLocalNotification({
          title: notificationData.title,
          body: notificationData.body,
          priority: this.mapPriority(notificationData.priority),
          category: notificationData.category || notificationData.type?.toLowerCase() || 'info',
          data: notificationData.data,
          sound: notificationData.sound,
          vibrate: notificationData.vibrate,
          badge: notificationData.badge,
        });
        return mobileNotification;
      }
    } catch (error) {
      console.error('Failed to send notification:', error);
      return null;
    }
  }

  /**
   * Send emergency alert notification
   */
  public async sendEmergencyAlert(
    title: string,
    content: string,
    priority: 'High' | 'Medium' | 'Low' = 'High'
  ): Promise<string | null> {
    if (!this.isEnabled()) {
      console.warn('Notifications not enabled, cannot send emergency alert');
      return null;
    }

    try {
      if (Platform.OS === 'web') {
        const webNotification = await enhancedWebNotificationService.sendEmergencyAlert(title, content, priority);
        return webNotification ? 'web-emergency' : null;
      } else {
        const mobileNotification = await enhancedNotificationService.sendEmergencyAlert(title, content, priority);
        return mobileNotification;
      }
    } catch (error) {
      console.error('Failed to send emergency alert:', error);
      return null;
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
    if (!this.isEnabled()) {
      console.warn('Notifications not enabled, cannot send alert');
      return null;
    }

    try {
      if (Platform.OS === 'web') {
        const webNotification = await enhancedWebNotificationService.sendAlert(title, content, priority);
        return webNotification ? 'web-alert' : null;
      } else {
        const mobileNotification = await enhancedNotificationService.sendAlert(title, content, priority);
        return mobileNotification;
      }
    } catch (error) {
      console.error('Failed to send alert:', error);
      return null;
    }
  }

  /**
   * Send info notification
   */
  public async sendInfo(
    title: string,
    content: string
  ): Promise<string | null> {
    if (!this.isEnabled()) {
      console.warn('Notifications not enabled, cannot send info notification');
      return null;
    }

    try {
      if (Platform.OS === 'web') {
        const webNotification = await enhancedWebNotificationService.sendInfo(title, content);
        return webNotification ? 'web-info' : null;
      } else {
        const mobileNotification = await enhancedNotificationService.sendInfo(title, content);
        return mobileNotification;
      }
    } catch (error) {
      console.error('Failed to send info notification:', error);
      return null;
    }
  }

  /**
   * Cancel a specific notification
   */
  public async cancelNotification(notificationId: string): Promise<void> {
    if (Platform.OS === 'web') {
      enhancedWebNotificationService.closeNotification(notificationId);
    } else {
      await enhancedNotificationService.cancelNotification(notificationId);
    }
  }

  /**
   * Cancel all notifications
   */
  public async cancelAllNotifications(): Promise<void> {
    if (Platform.OS === 'web') {
      enhancedWebNotificationService.closeAllNotifications();
    } else {
      await enhancedNotificationService.cancelAllNotifications();
    }
  }

  /**
   * Setup notification handlers
   */
  public setupNotificationHandlers(
    onNotificationReceived?: (notification: any) => void,
    onNotificationResponse?: (response: any) => void
  ): void {
    if (Platform.OS === 'web') {
      // Web notification event listeners are set up during initialization
      console.log('Web notification event listeners are handled during initialization');
    } else {
      if (onNotificationReceived) {
        enhancedNotificationService.addNotificationReceivedListener(onNotificationReceived);
      }
      if (onNotificationResponse) {
        enhancedNotificationService.addNotificationResponseListener(onNotificationResponse);
      }
    }
  }

  /**
   * Map priority levels for mobile notifications
   */
  private mapPriority(priority?: 'High' | 'Medium' | 'Low'): 'high' | 'normal' | 'low' {
    switch (priority) {
      case 'High':
        return 'high';
      case 'Medium':
        return 'normal';
      case 'Low':
        return 'low';
      default:
        return 'normal';
    }
  }

  /**
   * Get comprehensive notification statistics
   */
  public async getNotificationStats(): Promise<{
    enabled: boolean;
    platform: string;
    permissionStatus: string;
    pushToken: string | null;
    scheduledCount: number;
    activeCount: number;
    settings: UnifiedNotificationSettings | null;
    supported: boolean;
  }> {
    const enabled = this.isEnabled();
    const permissionStatus = this.getPermissionStatus();
    const pushToken = this.getPushToken();
    const settings = this.getSettings();
    
    let scheduledCount = 0;
    let activeCount = 0;
    let supported = true;

    if (Platform.OS === 'web') {
      const webStats = enhancedWebNotificationService.getNotificationStats();
      activeCount = webStats.activeCount;
      supported = webStats.supported;
    } else {
      const mobileStats = await enhancedNotificationService.getNotificationStats();
      scheduledCount = mobileStats.scheduledCount;
    }

    return {
      enabled,
      platform: Platform.OS,
      permissionStatus,
      pushToken,
      scheduledCount,
      activeCount,
      settings,
      supported,
    };
  }

  /**
   * Test notification system
   */
  public async testNotificationSystem(): Promise<{
    success: boolean;
    results: {
      emergency: boolean;
      alert: boolean;
      info: boolean;
    };
  }> {
    const results = {
      emergency: false,
      alert: false,
      info: false,
    };

    try {
      // Test emergency notification
      const emergencyResult = await this.sendEmergencyAlert('Test Emergency', 'This is a test emergency notification', 'High');
      results.emergency = emergencyResult !== null;

      // Wait a bit between tests
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Test alert notification
      const alertResult = await this.sendAlert('Test Alert', 'This is a test alert notification', 'Medium');
      results.alert = alertResult !== null;

      // Wait a bit between tests
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Test info notification
      const infoResult = await this.sendInfo('Test Info', 'This is a test info notification');
      results.info = infoResult !== null;

      const success = results.emergency && results.alert && results.info;

      return { success, results };
    } catch (error) {
      console.error('Failed to test notification system:', error);
      return { success: false, results };
    }
  }
}

// Export singleton instance
export const enhancedUnifiedNotificationManager = EnhancedUnifiedNotificationManager.getInstance();
export default enhancedUnifiedNotificationManager;
