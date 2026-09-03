import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ProfileImage from '../ProfileImage';
import { PROFILE_SECTION_FOOTER, PROFILE_SETTINGS_THEME as theme } from './profileSettingsTheme';

type ProfileSettingsSheetProps = {
  onClose: () => void;
  modalOpacity: Animated.Value;
  modalTranslateY: Animated.Value;
  currentUser?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    address?: string;
    unitNumber?: string;
    profileImage?: string | null;
    isDev?: boolean;
    isBoardMember?: boolean;
    isRenter?: boolean;
  };
  profileImage: string | null;
  displayImage?: string | null;
  uploading: boolean;
  removing: boolean;
  deleting: boolean;
  notificationsEnabled: boolean;
  requestingNotifications: boolean;
  onPickImage: () => void;
  onTakePhoto: () => void;
  onRemoveProfileImage: () => void;
  onSaveProfileImage: () => void;
  onCancelProfileImage: () => void;
  onEnableNotifications: () => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
};

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function SectionFooter({ text }: { text: string }) {
  return <Text style={styles.sectionFooter}>{text}</Text>;
}

function GroupedCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.groupedCard}>{children}</View>;
}

function SettingsRow({
  icon,
  iconColor = theme.accent,
  label,
  onPress,
  disabled,
  destructive,
  trailing,
  showChevron,
  isLast,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  trailing?: React.ReactNode;
  showChevron?: boolean;
  isLast?: boolean;
}) {
  const content = (
    <View style={[styles.row, isLast && styles.rowLast]}>
      <View style={[styles.rowIconWrap, { backgroundColor: `${iconColor}14` }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>{label}</Text>
      <View style={styles.rowTrailing}>
        {trailing}
        {showChevron ? <Ionicons name="chevron-forward" size={18} color="#C7C7CC" /> : null}
      </View>
    </View>
  );

  if (!onPress) return content;

  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.65}>
      {content}
    </TouchableOpacity>
  );
}

export default function ProfileSettingsSheet({
  onClose,
  modalOpacity,
  modalTranslateY,
  currentUser,
  profileImage,
  displayImage,
  uploading,
  removing,
  deleting,
  notificationsEnabled,
  requestingNotifications,
  onPickImage,
  onTakePhoto,
  onRemoveProfileImage,
  onSaveProfileImage,
  onCancelProfileImage,
  onEnableNotifications,
  onSignOut,
  onDeleteAccount,
}: ProfileSettingsSheetProps) {
  const insets = useSafeAreaInsets();
  const busy = uploading || removing || deleting;
  const initials = currentUser
    ? `${currentUser.firstName?.[0] || ''}${currentUser.lastName?.[0] || ''}`
    : undefined;
  const fullName = currentUser
    ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim()
    : 'Resident';
  const roleLabel = currentUser?.isDev
    ? 'Developer'
    : currentUser?.isBoardMember
      ? 'Board Member'
      : currentUser?.isRenter
        ? 'Renter'
        : 'Homeowner';
  const addressLine = currentUser
    ? `${currentUser.address || ''}${currentUser.unitNumber ? `, Unit ${currentUser.unitNumber}` : ''}`
    : '';

  return (
    <Animated.View
      style={[
        styles.sheet,
        Platform.OS !== 'web' && styles.sheetMobile,
        {
          opacity: modalOpacity,
          transform: [{ translateY: modalTranslateY }],
          paddingBottom: Math.max(insets.bottom, 12),
        },
      ]}
      pointerEvents="box-none"
    >
      {Platform.OS !== 'web' ? <View style={styles.grabber} /> : null}

      <View style={styles.sheetHeader}>
        <View style={styles.sheetHeaderSide} />
        <Text style={styles.sheetTitle}>Account</Text>
        <TouchableOpacity
          style={styles.doneButton}
          onPress={onClose}
          disabled={busy}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces
      >
        <View style={styles.heroCard}>
          <ProfileImage
            source={profileImage ? profileImage : currentUser?.profileImage}
            size={88}
            style={styles.avatar}
            initials={initials}
          />
          <Text style={styles.heroName}>{fullName}</Text>
          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>{roleLabel}</Text>
          </View>
          {currentUser?.email ? <Text style={styles.heroMeta}>{currentUser.email}</Text> : null}
          {addressLine ? <Text style={styles.heroMeta}>{addressLine}</Text> : null}
        </View>

        {profileImage ? (
          <>
            <SectionHeader title="PHOTO" />
            <GroupedCard>
              <SettingsRow
                icon="checkmark-circle"
                iconColor={theme.accentGreen}
                label="Save new profile photo"
                onPress={onSaveProfileImage}
                disabled={uploading}
                trailing={uploading ? <ActivityIndicator size="small" color={theme.accent} /> : null}
                isLast
              />
            </GroupedCard>
            <GroupedCard>
              <SettingsRow
                icon="close-circle"
                iconColor={theme.textSecondary}
                label="Cancel"
                onPress={onCancelProfileImage}
                disabled={uploading}
                isLast
              />
            </GroupedCard>
          </>
        ) : displayImage ? (
          <>
            <SectionHeader title="PHOTO" />
            <GroupedCard>
              <SettingsRow
                icon="trash-outline"
                iconColor={theme.destructive}
                label="Remove Profile Photo"
                onPress={onRemoveProfileImage}
                disabled={busy}
                destructive
                trailing={removing || uploading ? <ActivityIndicator size="small" color={theme.destructive} /> : null}
                isLast
              />
            </GroupedCard>
          </>
        ) : (
          <>
            <SectionHeader title="PHOTO" />
            <GroupedCard>
              <SettingsRow
                icon="images-outline"
                label="Choose from Gallery"
                onPress={onPickImage}
                disabled={busy}
                showChevron
              />
              <SettingsRow
                icon="camera-outline"
                label="Take Photo"
                onPress={onTakePhoto}
                disabled={busy}
                showChevron
                isLast
              />
            </GroupedCard>
          </>
        )}

        {Platform.OS !== 'web' ? (
          <>
            <SectionHeader title="NOTIFICATIONS" />
            <SectionFooter text={PROFILE_SECTION_FOOTER} />
            <GroupedCard>
              <SettingsRow
                icon={notificationsEnabled ? 'checkmark-circle' : 'notifications-outline'}
                iconColor={notificationsEnabled ? theme.accentGreen : theme.accent}
                label={notificationsEnabled ? 'Notifications Enabled' : 'Enable Notifications'}
                onPress={onEnableNotifications}
                disabled={requestingNotifications || busy}
                trailing={
                  requestingNotifications ? (
                    <ActivityIndicator size="small" color={theme.accent} />
                  ) : notificationsEnabled ? (
                    <Text style={styles.statusOn}>On</Text>
                  ) : null
                }
                showChevron={!notificationsEnabled && !requestingNotifications}
                isLast
              />
            </GroupedCard>
          </>
        ) : null}

        <SectionHeader title="ACCOUNT" />
        <GroupedCard>
          <SettingsRow
            icon="log-out-outline"
            iconColor={theme.destructive}
            label="Sign Out"
            onPress={onSignOut}
            disabled={busy}
            destructive
          />
          <SettingsRow
            icon="trash-outline"
            iconColor={theme.destructive}
            label="Delete Account"
            onPress={onDeleteAccount}
            disabled={busy}
            destructive
            isLast
          />
        </GroupedCard>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: theme.groupedBackground,
    borderRadius: theme.sheetRadius,
    overflow: 'hidden',
    width: '90%',
    maxHeight: '90%',
    minHeight: '76%',
  },
  sheetMobile: {
    width: '100%',
    maxHeight: '92%',
    minHeight: '68%',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.grabber,
    marginTop: 8,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  sheetHeaderSide: {
    width: 56,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.textPrimary,
    textAlign: 'center',
  },
  doneButton: {
    width: 56,
    alignItems: 'flex-end',
  },
  doneButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.accent,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  heroCard: {
    backgroundColor: theme.card,
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    borderWidth: 3,
    borderColor: '#E5E7EB',
  },
  heroName: {
    marginTop: 12,
    fontSize: 22,
    fontWeight: '700',
    color: theme.textPrimary,
    letterSpacing: -0.3,
  },
  rolePill: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: `${theme.brand}12`,
  },
  rolePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.brand,
    letterSpacing: 0.2,
  },
  heroMeta: {
    marginTop: 6,
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  sectionHeader: {
    marginTop: 18,
    marginBottom: 6,
    marginLeft: 16,
    fontSize: 13,
    fontWeight: '400',
    color: theme.textSecondary,
    letterSpacing: 0.2,
  },
  sectionFooter: {
    marginBottom: 8,
    marginHorizontal: 16,
    fontSize: 13,
    lineHeight: 18,
    color: theme.textSecondary,
  },
  groupedCard: {
    backgroundColor: theme.card,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  row: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.separator,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowLabel: {
    flex: 1,
    fontSize: 16,
    color: theme.textPrimary,
  },
  rowLabelDestructive: {
    color: theme.destructive,
  },
  rowTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusOn: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.accentGreen,
  },
});
