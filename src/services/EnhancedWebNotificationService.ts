import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface EnhancedWebNotificationData {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  requireInteraction?: boolean;
  silent?: boolean;
  timestamp?: number;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

export interface WebNotificationSettings {
  emergency: boolean;
  alerts: boolean;
  info: boolean;
  sound: boolean;
  requireInteraction: boolean;
}

class EnhancedWebNotificationService {
  private static instance: EnhancedWebNotificationService;
  private isSupported = false;
  private permission: NotificationPermission = 'default';
  private notificationSettings: WebNotificationSettings | null = null;
  private activeNotifications: Map<string, Notification> = new Map();
  private maxNotifications = 5; // Limit concurrent notifications

  private constructor() {
    this.isSupported = Platform.OS === 'web' && 'Notification' in window;
    this.permission = this.isSupported ? Notification.permission : 'denied';
  }

  public static getInstance(): EnhancedWebNotificationService {
    if (!EnhancedWebNotificationService.instance) {
      EnhancedWebNotificationService.instance = new EnhancedWebNotificationService();
    }
    return EnhancedWebNotificationService.instance;
  }

  /**
   * Initialize the enhanced web notification service
   */
  public async initialize(): Promise<boolean> {
    if (!this.isSupported) {
      console.warn('Web notifications not supported in this browser');
      return false;
    }

    try {
      await this.loadSettings();
      await this.setupEventListeners();
      return true;
    } catch (error) {
      console.error('Failed to initialize EnhancedWebNotificationService:', error);
      return false;
    }
  }

  /**
   * Load notification settings from storage
   */
  private async loadSettings(): Promise<void> {
    try {
      const savedSettings = await AsyncStorage.getItem('webNotificationSettings');
      if (savedSettings) {
        this.notificationSettings = JSON.parse(savedSettings);
      } else {
        // Default settings
        this.notificationSettings = {
          emergency: true,
          alerts: true,
          info: true,
          sound: true,
          requireInteraction: false,
        };
        await this.saveSettings();
      }
    } catch (error) {
      console.error('Failed to load web notification settings:', error);
      this.notificationSettings = {
        emergency: true,
        alerts: true,
        info: true,
        sound: true,
        requireInteraction: false,
      };
    }
  }

  /**
   * Save notification settings to storage
   */
  private async saveSettings(): Promise<void> {
    try {
      if (this.notificationSettings) {
        await AsyncStorage.setItem('webNotificationSettings', JSON.stringify(this.notificationSettings));
      }
    } catch (error) {
      console.error('Failed to save web notification settings:', error);
    }
  }

  /**
   * Setup event listeners for notification interactions
   */
  private async setupEventListeners(): Promise<void> {
    if (!this.isSupported) return;

    // Handle notification click
    window.addEventListener('notificationclick', (event: any) => {
      event.preventDefault();
      const notification = event.notification;
      
      // Close the notification
      notification.close();
      
      // Focus the window if it's not already focused
      if (window.focus) {
        window.focus();
      }
      
      // Handle notification data
      if (notification.data?.url) {
        window.open(notification.data.url, '_blank');
      }
      
      console.log('Notification clicked:', notification.data);
    });

    // Handle notification close
    window.addEventListener('notificationclose', (event: any) => {
      const notification = event.notification;
      this.activeNotifications.delete(notification.tag || '');
      console.log('Notification closed:', notification.data);
    });

    // Handle notification error
    window.addEventListener('notificationerror', (event) => {
      console.error('Notification error:', event);
    });
  }

  /**
   * Check if web notifications are supported
   */
  public isWebNotificationsSupported(): boolean {
    return this.isSupported;
  }

  /**
   * Check if notifications are enabled
   */
  public isEnabled(): boolean {
    return this.permission === 'granted';
  }

  /**
   * Get current permission status
   */
  public getPermissionStatus(): NotificationPermission {
    return this.permission;
  }

  /**
   * Get notification settings
   */
  public getSettings(): WebNotificationSettings | null {
    return this.notificationSettings;
  }

  /**
   * Update notification settings
   */
  public async updateSettings(settings: Partial<WebNotificationSettings>): Promise<void> {
    if (this.notificationSettings) {
      this.notificationSettings = { ...this.notificationSettings, ...settings };
      await this.saveSettings();
    }
  }

  /**
   * Request notification permissions with better UX
   */
  public async requestPermissions(): Promise<boolean> {
    if (!this.isSupported) {
      console.warn('Web notifications not supported in this browser');
      return false;
    }

    try {
      // Check if we can request permission
      if (Notification.permission === 'denied') {
        console.warn('Notification permission denied by user');
        return false;
      }

      const permission = await Notification.requestPermission();
      this.permission = permission;
      
      if (permission === 'granted') {
        console.log('Web notification permission granted');
      }
      
      return permission === 'granted';
    } catch (error) {
      console.error('Failed to request notification permissions:', error);
      return false;
    }
  }

  /**
   * Send a web notification with enhanced features
   */
  public async sendNotification(notificationData: EnhancedWebNotificationData): Promise<Notification | null> {
    if (!this.isEnabled()) {
      console.warn('Web notifications not enabled, cannot send notification');
      return null;
    }

    // Check if user has enabled this type of notification
    if (!this.shouldSendNotification(notificationData.data?.type)) {
      console.log('Notification type disabled by user settings');
      return null;
    }

    try {
      // Clean up old notifications if we have too many
      if (this.activeNotifications.size >= this.maxNotifications) {
        const oldestNotification = this.activeNotifications.values().next().value;
        if (oldestNotification) {
          oldestNotification.close();
        }
      }

      const notification = new Notification(notificationData.title, {
        body: notificationData.body,
        icon: notificationData.icon || '/icon.png',
        badge: notificationData.badge || '/icon.png',
        tag: notificationData.tag || `notification-${Date.now()}`,
        data: {
          ...notificationData.data,
          timestamp: notificationData.timestamp || Date.now(),
        },
        requireInteraction: this.getRequireInteraction(notificationData.data?.type),
        silent: notificationData.silent || false,
        // actions: notificationData.actions || this.getDefaultActions(notificationData.data?.type), // Not supported in all browsers
      });

      // Store the notification for management
      this.activeNotifications.set(notification.tag || '', notification);

      // Auto-close notification after a delay unless it requires interaction
      if (!notification.requireInteraction) {
        const autoCloseDelay = this.getAutoCloseDelay(notificationData.data?.type);
        setTimeout(() => {
          if (notification && !notification.requireInteraction) {
            notification.close();
          }
        }, autoCloseDelay);
      }

      console.log('Web notification sent:', notificationData.title);
      return notification;
    } catch (error) {
      console.error('Failed to send web notification:', error);
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
   * Get requireInteraction setting based on notification type
   */
  private getRequireInteraction(type?: string): boolean {
    if (!this.notificationSettings) return false;
    
    if (type === 'emergency') {
      return true; // Always require interaction for emergencies
    }
    
    return this.notificationSettings.requireInteraction;
  }

  /**
   * Get auto-close delay based on notification type
   */
  private getAutoCloseDelay(type?: string): number {
    switch (type) {
      case 'emergency':
        return 10000; // 10 seconds for emergencies
      case 'alert':
        return 8000;  // 8 seconds for alerts
      case 'info':
        return 5000;  // 5 seconds for info
      default:
        return 5000;
    }
  }

  /**
   * Get default actions for notification type
   */
  private getDefaultActions(type?: string): NotificationAction[] {
    switch (type) {
      case 'emergency':
        return [
          { action: 'view', title: 'View Alert' },
          { action: 'dismiss', title: 'Dismiss' },
        ];
      case 'alert':
        return [
          { action: 'view', title: 'View Alert' },
          { action: 'dismiss', title: 'Dismiss' },
        ];
      case 'info':
        return [
          { action: 'view', title: 'View Info' },
        ];
      default:
        return [];
    }
  }

  /**
   * Send emergency alert notification
   */
  public async sendEmergencyAlert(
    title: string,
    content: string,
    priority: 'High' | 'Medium' | 'Low' = 'High'
  ): Promise<Notification | null> {
    const emoji = priority === 'High' ? '🚨' : priority === 'Medium' ? '⚠️' : 'ℹ️';
    
    return this.sendNotification({
      title: `${emoji} ${title}`,
      body: content,
      tag: `emergency-${Date.now()}`,
      requireInteraction: true,
      data: {
        type: 'emergency',
        priority,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Send regular alert notification
   */
  public async sendAlert(
    title: string,
    content: string,
    priority: 'High' | 'Medium' | 'Low' = 'Medium'
  ): Promise<Notification | null> {
    const emoji = priority === 'High' ? '⚠️' : priority === 'Medium' ? 'ℹ️' : '📢';
    
    return this.sendNotification({
      title: `${emoji} ${title}`,
      body: content,
      tag: `alert-${Date.now()}`,
      requireInteraction: priority === 'High',
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
  ): Promise<Notification | null> {
    return this.sendNotification({
      title: `ℹ️ ${title}`,
      body: content,
      tag: `info-${Date.now()}`,
      data: {
        type: 'info',
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Close a specific notification
   */
  public closeNotification(tag: string): void {
    const notification = this.activeNotifications.get(tag);
    if (notification) {
      notification.close();
      this.activeNotifications.delete(tag);
    }
  }

  /**
   * Close all notifications
   */
  public closeAllNotifications(): void {
    this.activeNotifications.forEach((notification) => {
      notification.close();
    });
    this.activeNotifications.clear();
  }

  /**
   * Get active notifications count
   */
  public getActiveNotificationsCount(): number {
    return this.activeNotifications.size;
  }

  /**
   * Get notification statistics
   */
  public getNotificationStats(): {
    enabled: boolean;
    supported: boolean;
    permissionStatus: string;
    activeCount: number;
    settings: WebNotificationSettings | null;
  } {
    return {
      enabled: this.isEnabled(),
      supported: this.isWebNotificationsSupported(),
      permissionStatus: this.permission,
      activeCount: this.activeNotifications.size,
      settings: this.notificationSettings,
    };
  }
}

// Export singleton instance
export const enhancedWebNotificationService = EnhancedWebNotificationService.getInstance();
export default enhancedWebNotificationService;
