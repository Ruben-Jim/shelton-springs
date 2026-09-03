import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Text,
  Animated,
  Dimensions,
  Modal,
  Platform,
  Image,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  ActivityIndicator,
  AppState,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../context/AuthContext';
import { useCachedResidents } from '../context/QueryCacheContext';
import CustomAlert from './CustomAlert';
import { useCustomAlert } from '../hooks/useCustomAlert';
import { confirmAlert } from '../utils/webCompatibleAlert';
import ProfileImage from './ProfileImage';
import { getUploadReadyImage } from '../utils/imageUpload';
import { ensurePhotoLibraryAccess } from '../utils/ensurePhotoLibraryAccess';
import { promptForNotificationAccess, openNotificationSettings } from '../utils/ensureNotificationAccess';
import enhancedUnifiedNotificationManager from '../services/EnhancedUnifiedNotificationManager';
import ProfileSettingsSheet from './profile/ProfileSettingsSheet';

interface TabItem {
  name: string;
  icon: string;
  label: string;
  color: string;
}

interface MobileTabBarProps {
  isMenuOpen?: boolean;
  onMenuClose?: () => void;
}

const MobileTabBar = ({ isMenuOpen: externalIsMenuOpen, onMenuClose }: MobileTabBarProps) => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { alertState, showAlert, hideAlert } = useCustomAlert();
  const [internalMenuOpen, setInternalMenuOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [requestingNotifications, setRequestingNotifications] = useState(false);
  
  // Get user's profile image from residents table - use cached to prevent duplicates
  const residents = useCachedResidents();
  const currentUser = residents.find(resident => resident.email === user?.email);
  const displayImage = currentUser?.profileImage;
  
  // Convex mutations
  const updateResident = useMutation(api.residents.update);
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const deleteStorageFile = useMutation(api.storage.deleteStorageFile);
  const deleteResident = useMutation(api.residents.remove);
  const updatePushToken = useMutation(api.residents.updatePushToken);
  
  // Account deletion state
  const [deleting, setDeleting] = useState(false);
  
  const isMenuOpen = externalIsMenuOpen !== undefined ? externalIsMenuOpen : internalMenuOpen;
  
  const slideAnim = useRef(new Animated.Value(-300)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const profileModalOpacity = useRef(new Animated.Value(0)).current;
  const profileModalTranslateY = useRef(new Animated.Value(300)).current;

  const syncNotificationStatus = useCallback(async (shouldSyncToken = false) => {
    if (Platform.OS === 'web') return;
    try {
      await enhancedUnifiedNotificationManager.initialize();
      const status = await enhancedUnifiedNotificationManager.refreshPermissionStatus();
      const granted = status === 'granted';
      setNotificationsEnabled(granted);
      if (shouldSyncToken && granted && user?._id) {
        const token = enhancedUnifiedNotificationManager.getPushToken();
        if (token && token !== currentUser?.expoPushToken) {
          await updatePushToken({
            userId: user._id as any,
            expoPushToken: token,
          });
        }
      }
    } catch (error) {
      console.warn('Failed to refresh notification status:', error);
    }
  }, [user?._id, updatePushToken, currentUser?.expoPushToken]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    syncNotificationStatus(false);
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        syncNotificationStatus(true);
      }
    });
    return () => subscription.remove();
  }, [syncNotificationStatus]);

  const isBoardMember = user?.isBoardMember && user?.isActive;
  const isRenter = user?.isRenter;
  const isDev = user?.isDev ?? false;

  // Handle external menu state changes
  useEffect(() => {
    if (externalIsMenuOpen !== undefined) {
      if (externalIsMenuOpen) {
        openMenu();
      } else {
        closeMenu();
      }
    }
  }, [externalIsMenuOpen]);

  // Handle profile modal animation when visibility changes
  useEffect(() => {
    if (showProfileModal) {
      // Make content visible immediately
      profileModalOpacity.setValue(1);
      profileModalTranslateY.setValue(0);
      // Optional: Add a subtle animation
      profileModalTranslateY.setValue(50);
      Animated.spring(profileModalTranslateY, {
        toValue: 0,
        tension: 100,
        friction: 8,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    } else {
      // Reset animation values when closing
      profileModalOpacity.setValue(0);
      profileModalTranslateY.setValue(300);
    }
  }, [showProfileModal]);

  // Rainbow colors for tabs
  const borderColors = [
    '#ef4444', // Red
    '#f97316', // Orange
    '#eab308', // Yellow
    '#22c55e', // Green
    '#3b82f6', // Blue
    '#6366f1', // Indigo
    '#8b5cf6', // Violet
    '#ec4899', // Pink
  ];

  const tabs: TabItem[] = [
    { name: 'Home', icon: 'home', label: 'Home', color: '#6b7280' },
    { name: 'Board', icon: 'business', label: 'HOA', color: '#6b7280' },
    { name: 'Community', icon: 'chatbubbles', label: 'Community', color: '#6b7280' },
    ...(isBoardMember || !isRenter ? [{ name: 'Fees', icon: 'card', label: 'Fees', color: '#6b7280' }] : []),
    ...(isBoardMember || isDev ? [{ name: 'Admin', icon: 'settings', label: 'Admin', color: '#6b7280' }] : []),
  ];

  const handleTabPress = (tabName: string) => {
    navigation.navigate(tabName as never);
    closeMenu();
  };

  const openMenu = () => {
    if (externalIsMenuOpen === undefined) {
      setInternalMenuOpen(true);
    }
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  };

  const closeMenu = (callback?: () => void) => {
    // Ensure callback is actually a function, not an event object
    const safeCallback = typeof callback === 'function' ? callback : undefined;
    
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -300,
        duration: 250,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      if (externalIsMenuOpen === undefined) {
        setInternalMenuOpen(false);
      } else if (onMenuClose) {
        onMenuClose();
      }
      // Execute callback after menu is fully closed
      if (safeCallback) {
        safeCallback();
      }
    });
  };

  const pickImage = async () => {
    try {
      const allowed = await ensurePhotoLibraryAccess(
        'Permission to access camera roll is required!'
      );
      if (!allowed) return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images' as any,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
      });

      if (!result.canceled && result.assets[0]) {
        setProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Permission to access camera is required!');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
      });

      if (!result.canceled && result.assets[0]) {
        setProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const uploadImage = async (imageUri: string): Promise<string> => {
    try {
      const uploadUrl = await generateUploadUrl();
      const { blob, mimeType } = await getUploadReadyImage(imageUri);
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': mimeType },
        body: blob,
      });
      const { storageId } = await uploadResponse.json();
      return storageId;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw new Error('Failed to upload image');
    }
  };

  const animateProfileModalIn = () => {
    Animated.parallel([
      Animated.timing(profileModalOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(profileModalTranslateY, {
        toValue: 0,
        tension: 100,
        friction: 8,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  };

  const animateProfileModalOut = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(profileModalOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(profileModalTranslateY, {
        toValue: 300,
        duration: 250,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      if (callback && typeof callback === 'function') {
        callback();
      }
    });
  };

  const handleRemoveProfileImage = async () => {
    if (!currentUser || !currentUser.profileImage) {
      return;
    }

    try {
      setRemoving(true);
      
      // Delete the image from Convex storage
      if (!currentUser.profileImage.startsWith('http')) {
        await deleteStorageFile({ storageId: currentUser.profileImage as any });
      }
      
      // Update the resident to remove the profile image reference
      await updateResident({
        id: currentUser._id as any,
        profileImage: undefined,
      });

      showAlert({
        title: 'Success',
        message: 'Profile image removed successfully!',
        type: 'success'
      });

      setTimeout(() => {
        hideAlert();
      }, 2000);

      // Don't close the modal - let user choose a new image or close manually
    } catch (error) {
      console.error('Error removing profile image:', error);
      showAlert({
        title: 'Error',
        message: 'Failed to remove profile image. Please try again.',
        type: 'error'
      });
      setTimeout(() => {
        hideAlert();
      }, 3000);
    } finally {
      setRemoving(false);
    }
  };

  const handleSaveProfileImage = async () => {
    if (!profileImage || !currentUser) {
      return;
    }

    try {
      setUploading(true);
      
      // Delete old image from storage if it exists
      if (currentUser.profileImage && !currentUser.profileImage.startsWith('http')) {
        await deleteStorageFile({ storageId: currentUser.profileImage as any });
      }
      
      // Upload new image
      const storageId = await uploadImage(profileImage);
      await updateResident({
        id: currentUser._id as any,
        profileImage: storageId,
      });

      showAlert({
        title: 'Success',
        message: 'Profile image updated successfully!',
        type: 'success'
      });

      setTimeout(() => {
        hideAlert();
      }, 2000);

      animateProfileModalOut(() => {
        setShowProfileModal(false);
        setProfileImage(null);
      });
    } catch (error) {
      console.error('Error updating profile image:', error);
      showAlert({
        title: 'Error',
        message: 'Failed to update profile image. Please try again.',
        type: 'error'
      });
      setTimeout(() => {
        hideAlert();
      }, 3000);
    } finally {
      setUploading(false);
    }
  };

  const performSignOut = async () => {
    try {
      // Close profile modal first
      setShowProfileModal(false);
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleSignOut = () => {
    if (Platform.OS === 'web') {
      // Use CustomAlert on web
      showAlert({
        title: 'Sign Out',
        message: 'Are you sure you want to sign out?',
        type: 'warning',
        buttons: [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign Out', style: 'destructive', onPress: performSignOut }
        ]
      });
    } else {
      // Use webCompatibleAlert (which uses Alert.alert) on mobile
      confirmAlert(
        'Are you sure you want to sign out?',
        'Sign Out',
        performSignOut
      );
    }
  };
  
const handleDeleteAccount = () => {
  if (Platform.OS === 'web') {
    // Use CustomAlert on web
    showAlert({
      title: 'Delete Account',
      message: 'Are you sure you want to permanently delete your account? This action cannot be undone and all your data will be lost.',
      type: 'error',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: confirmDeleteAccount,
        }
      ]
    });
  } else {
    // Use webCompatibleAlert (which uses Alert.alert) on mobile
    confirmAlert(
      'Are you sure you want to permanently delete your account? This action cannot be undone and all your data will be lost.',
      'Delete Account',
      confirmDeleteAccount
    );
  }
};

  const confirmDeleteAccount = async () => {
    if (!currentUser) {
      Alert.alert('Error', 'Unable to find your account. Please try again.');
      return;
    }

    try {
      setDeleting(true);
      
      // Close the profile modal first
      setShowProfileModal(false);
      setProfileImage(null);
      
      // Delete profile image from storage if exists
      if (currentUser.profileImage && !currentUser.profileImage.startsWith('http')) {
        try {
          await deleteStorageFile({ storageId: currentUser.profileImage as any });
        } catch (error) {
          console.log('Error deleting profile image (continuing with account deletion):', error);
        }
      }
      
      // Delete the resident from Convex
      await deleteResident({ id: currentUser._id as any });
      
      // Sign out and clear local storage
      await signOut();
      
      // Show success message using native Alert
      Alert.alert('Account Deleted', 'Your account has been permanently deleted.');
    } catch (error: any) {
      console.error('Error deleting account:', error);
      Alert.alert(
        'Error',
        error?.message || 'Failed to delete account. Please try again or contact support.'
      );
    } finally {
      setDeleting(false);
    }
  };

  const offerNotificationSettings = () => {
    Alert.alert(
      'Enable Notifications',
      'Notifications are turned off for Shelton Springs. Open Settings and turn Notifications on for this app.',
      [
        { text: 'Not Now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => { openNotificationSettings(); } },
      ]
    );
  };

  const handleEnableNotifications = async () => {
    if (Platform.OS === 'web' || requestingNotifications) return;

    try {
      setRequestingNotifications(true);
      const result = await promptForNotificationAccess();

      if (result.granted) {
        const token = result.token ?? enhancedUnifiedNotificationManager.getPushToken();
        if (token && user?._id) {
          try {
            await updatePushToken({
              userId: user._id as any,
              expoPushToken: token,
            });
          } catch (error) {
            console.warn('Failed to save push token:', error);
          }
        }
        setNotificationsEnabled(true);
        showAlert({
          title: 'Notifications Enabled',
          message: 'You will receive community alerts and important updates on this device.',
          type: 'success',
        });
        setTimeout(() => hideAlert(), 2500);
        return;
      }

      setNotificationsEnabled(false);
      if (result.needsSettings) {
        if (showProfileModal) {
          animateProfileModalOut(() => {
            setShowProfileModal(false);
            setProfileImage(null);
            setTimeout(offerNotificationSettings, 300);
          });
        } else {
          offerNotificationSettings();
        }
      }
    } catch (error) {
      console.error('Failed to enable notifications:', error);
      showAlert({
        title: 'Error',
        message: 'Could not update notification settings. Please try again.',
        type: 'error',
      });
      setTimeout(() => hideAlert(), 3000);
    } finally {
      setRequestingNotifications(false);
    }
  };

  return (
    <>
      {/* Mobile Navigation Modal */}
      <Modal
        visible={isMenuOpen}
        transparent={true}
        animationType="none"
        onRequestClose={() => closeMenu()}
      >
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
          <TouchableOpacity 
            style={styles.overlayTouchable}
            activeOpacity={1}
            onPress={() => closeMenu()}
          />
          <Animated.View style={[styles.sideMenu, { transform: [{ translateX: slideAnim }] }]}>
            {/* Menu Header */}
            <View style={[styles.menuHeader, { paddingTop: Math.max(insets.top, 16) + 20 }]}>
              <View style={styles.menuHeaderLeft}>
                <Image 
                  source={require('../../assets/favicon.jpg')} 
                  style={styles.favicon}
                  resizeMode="cover"
                />
                <Text style={styles.menuTitle}>Shelton Springs</Text>
              </View>
              <TouchableOpacity onPress={() => closeMenu()}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            {/* Menu Items */}
            <ScrollView 
              style={styles.menuItems}
              contentContainerStyle={styles.menuItemsContent}
              showsVerticalScrollIndicator={true}
              scrollEnabled={true}
              bounces={true}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
            >
              {tabs.map((tab, index) => {
                const isActive = route.name === tab.name;
                return (
                  <TouchableOpacity
                    key={tab.name}
                    style={[
                      styles.menuItem, 
                      isActive && styles.activeMenuItem,
                      {
                        borderLeftColor: borderColors[index % borderColors.length],
                        borderLeftWidth: 4,
                      }
                    ]}
                    onPress={() => handleTabPress(tab.name)}
                  >
                    <View style={styles.menuItemContent}>
                      <Ionicons
                        name={tab.icon as any}
                        size={24}
                        color={isActive ? borderColors[index % borderColors.length] : tab.color}
                      />
                      <Text style={[
                        styles.menuItemText, 
                        isActive && [styles.activeMenuItemText, { color: borderColors[index % borderColors.length] }]
                      ]}>
                        {tab.label}
                      </Text>
                    </View>
                    {isActive && (
                      <View style={[styles.activeIndicator, { backgroundColor: borderColors[index % borderColors.length] }]} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* User Info — pad for Android 3-button / gesture nav when edge-to-edge */}
            {user && (
              <View
                style={[
                  styles.userSection,
                  { paddingBottom: Math.max(insets.bottom, 16) + 12 },
                ]}
                pointerEvents="box-none"
              >
                <View style={styles.userInfo} pointerEvents="box-none">
                  <ProfileImage 
                    source={currentUser?.profileImage} 
                    size={40}
                    style={{ marginRight: 12 }}
                  />
                  <View style={styles.userDetails} pointerEvents="none">
                    <Text style={styles.userName}>
                      {user.firstName} {user.lastName}
                    </Text>
                    <Text style={styles.userRole}>
                      {(user.isDev ?? false) ? 'Developer' : user.isBoardMember ? 'Board Member' : user.isRenter ? 'Renter' : 'Resident'}
                    </Text>
                  </View>
                  <View style={styles.userActions}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.settingsButton,
                        pressed && styles.settingsButtonPressed
                      ]}
                      onPress={() => {
                        // Close the side menu first, then open profile modal when closed
                        closeMenu(() => {
                          // Wait longer for iOS to fully close the first modal and cleanup
                          setTimeout(() => {
                            setShowProfileModal(true);
                          }, 500);
                        });
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="settings-outline" size={20} color="#6b7280" />
                    </Pressable>
                  </View>
                </View>
              </View>
            )}
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Profile Image Edit Modal */}
      <Modal
        key={`profile-modal-${showProfileModal ? 'open' : 'closed'}`}
        visible={showProfileModal}
        transparent={true}
        animationType="none"
        onRequestClose={() => {
          if (!uploading && !removing) {
            animateProfileModalOut(() => {
              setShowProfileModal(false);
              setProfileImage(null);
            });
          }
        }}
        presentationStyle="overFullScreen"
        statusBarTranslucent={true}
      >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.profileModalKeyboardView}
          >
            <View
              style={[
                styles.profileModalOverlay,
                Platform.OS !== 'web' && styles.profileModalOverlayMobile,
              ]}
              pointerEvents="auto"
            >
              <TouchableOpacity
                style={styles.profileModalOverlayTouchable}
                activeOpacity={1}
                onPress={() => {
                  if (!uploading && !removing) {
                    animateProfileModalOut(() => {
                      setShowProfileModal(false);
                      setProfileImage(null);
                    });
                  }
                }}
                disabled={uploading || removing}
              />
              <ProfileSettingsSheet
                onClose={() => {
                  if (!uploading && !removing) {
                    animateProfileModalOut(() => {
                      setShowProfileModal(false);
                      setProfileImage(null);
                    });
                  }
                }}
                modalOpacity={profileModalOpacity}
                modalTranslateY={profileModalTranslateY}
                currentUser={currentUser}
                profileImage={profileImage}
                displayImage={displayImage}
                uploading={uploading}
                removing={removing}
                deleting={deleting}
                notificationsEnabled={notificationsEnabled}
                requestingNotifications={requestingNotifications}
                onPickImage={pickImage}
                onTakePhoto={takePhoto}
                onRemoveProfileImage={handleRemoveProfileImage}
                onSaveProfileImage={handleSaveProfileImage}
                onCancelProfileImage={() => setProfileImage(null)}
                onEnableNotifications={handleEnableNotifications}
                onSignOut={handleSignOut}
                onDeleteAccount={handleDeleteAccount}
              />
            </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Custom Alert - kept for other potential uses */}
      <CustomAlert
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        buttons={alertState.buttons}
        type={alertState.type}
        onClose={hideAlert}
      />
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  overlayTouchable: {
    flex: 1,
  },
  sideMenu: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 280,
    backgroundColor: '#ffffff',
    // Use web-compatible shadow to avoid deprecation warnings
    boxShadow: '0px 0px 10px rgba(0,0,0,0.25)' as any,
    elevation: 10,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  menuHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  favicon: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  menuItems: {
    flex: 1,
  },
  menuItemsContent: {
    paddingTop: 20,
    paddingBottom: 20,
    flexGrow: 1,
  },
  menuItem: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    position: 'relative',
    ...(Platform.OS === 'ios' && {
      justifyContent: 'center',
    }),
  },
  activeMenuItem: {
    backgroundColor: '#f0f9ff',
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginLeft: 16,
  },
  activeMenuItemText: {
    color: '#2563eb',
    fontWeight: '600',
  },
  activeIndicator: {
    position: 'absolute',
    right: 20,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563eb',
    ...(Platform.OS === 'ios' 
      ? {
          top: 24, // 16px padding + 8px to center the 8px dot
        }
      : {
          top: 24, // 16px padding + 6px to center the 8px dot
        }
    ),
  },
  userSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#f8fafc',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  userRole: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  userActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  settingsButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    elevation: 10,
  },
  settingsButtonPressed: {
    backgroundColor: '#e5e7eb',
    opacity: 0.8,
  },
  profileModalKeyboardView: {
    flex: 1,
  },
  profileModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileModalOverlayMobile: {
    justifyContent: 'flex-end',
    alignItems: 'stretch',
  },
  profileModalOverlayTouchable: {
    flex: 1,
  },
  profileModalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 0,
    width: '90%',
    maxHeight: '90%',
    minHeight: '76%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
    overflow: 'hidden',
  },
  profileModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    paddingTop: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f8fafc',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  profileModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    flex: 1,
    textAlign: 'center',
    marginRight: 24,
  },
  profileModalBody: {
    flex: 1,
  },
  profileModalBodyContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
    flexGrow: 1,
  },
  profileImageDisplayContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    marginBottom: 16,
  },
  largeProfileImage: {
    borderWidth: 4,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  imagePickerContainer: {
    gap: 16,
    marginBottom: 20,
  },
  imagePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    borderRadius: 12,
    gap: 12,
    backgroundColor: '#f9fafb',
  },
  cameraButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    borderRadius: 12,
    gap: 12,
    backgroundColor: '#f9fafb',
  },
  imagePickerText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  imagePreviewContainer: {
    position: 'relative',
    width: '100%',
    height: 250,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 4,
  },
  emptyImageContainer: {
    width: '100%',
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
  },
  emptyImageText: {
    marginTop: 12,
    fontSize: 16,
    color: '#9ca3af',
    fontWeight: '500',
  },
  removeButton: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  removeButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  removeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flex: 1,
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    flex: 1,
    marginRight: 8,
  },
  cancelButtonDisabled: {
    opacity: 0.6,
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  accountActionsSection: {
    marginTop: 24,
    paddingTop: 20,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 12,
  },
  notificationsSection: {
    marginTop: 8,
    paddingTop: 20,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 12,
  },
  notificationsHint: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  notificationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  notificationButtonEnabled: {
    backgroundColor: '#059669',
  },
  notificationButtonDisabled: {
    opacity: 0.7,
  },
  notificationButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  accountActionsSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  logoutButtonText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  deleteAccountButtonText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MobileTabBar;
