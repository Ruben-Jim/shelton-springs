import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import DeveloperIndicator from './DeveloperIndicator';
import BoardMemberIndicator from './BoardMemberIndicator';
import MessagingButton from './MessagingButton';

const HEADER_IMAGE =
  Platform.OS === 'ios'
    ? require('../../assets/hoa-1k.jpg')
    : require('../../assets/hoa-2k.jpg');

type CommunityForumHeaderProps = {
  screenWidth: number;
  showMobileNav: boolean;
  isBoardMember: boolean;
  onOpenMenu: () => void;
  onOpenMessaging: () => void;
};

function CommunityForumHeader({
  screenWidth,
  showMobileNav,
  isBoardMember,
  onOpenMenu,
  onOpenMessaging,
}: CommunityForumHeaderProps) {
  return (
    <View style={[styles.headerContainer, { width: screenWidth }]}>
        <View style={[styles.header, !isBoardMember && styles.headerNonMember]}>
          <Image
            source={HEADER_IMAGE}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            cachePolicy="memory-disk"
            priority="high"
            transition={0}
          />
          <View style={styles.headerOverlay} />
          <View style={styles.headerTop}>
            {showMobileNav && (
              <TouchableOpacity style={styles.menuButton} onPress={onOpenMenu}>
                <Ionicons name="menu" size={24} color="#ffffff" />
              </TouchableOpacity>
            )}
            <View style={styles.headerLeft}>
              <View style={styles.titleContainer}>
                <Text style={styles.headerTitle}>Community Forum</Text>
              </View>
              <Text style={styles.headerSubtitle}>
                Connect with your neighbors and stay informed
              </Text>
              <View style={styles.indicatorsContainer}>
                <DeveloperIndicator />
                <BoardMemberIndicator />
              </View>
            </View>
            {!isBoardMember && <View style={styles.headerSpacer} />}
            {isBoardMember && (
              <View style={styles.headerRight}>
                <MessagingButton onPress={onOpenMessaging} />
              </View>
            )}
          </View>
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    alignSelf: 'stretch',
    overflow: 'hidden',
    zIndex: 1,
    elevation: 1,
  },
  header: {
    height: 180,
    padding: 20,
    paddingTop: 40,
    paddingBottom: 20,
    position: 'relative',
    justifyContent: 'space-between',
    width: '100%',
    overflow: 'hidden',
  },
  headerNonMember: {
    height: 170,
    padding: 20,
    paddingTop: 40,
    paddingBottom: 20,
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 1,
  },
  menuButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    marginRight: 12,
  },
  headerLeft: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  headerTitle: ({
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    textShadow: '2px 2px 4px rgba(0, 0, 0, 0.9)' as any,
    textAlign: 'center',
  } as any),
  headerSubtitle: ({
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '400',
    opacity: 0.9,
    marginTop: 8,
    textShadow: '2px 2px 4px rgba(0, 0, 0, 0.9)' as any,
    textAlign: 'center',
  } as any),
  indicatorsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  headerSpacer: {
    width: 44,
  },
  headerRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default memo(CommunityForumHeader);
