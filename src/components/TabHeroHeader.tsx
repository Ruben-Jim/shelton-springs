import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DeveloperIndicator from './DeveloperIndicator';
import BoardMemberIndicator from './BoardMemberIndicator';
import MessagingButton from './MessagingButton';
import {
  HERO_HEADER_IMAGE,
  useHeroHeaderLayout,
} from '../hooks/useHeroHeaderPadding';

type TabHeroHeaderProps = {
  screenWidth: number;
  showMobileNav: boolean;
  isBoardMember: boolean;
  onOpenMenu: () => void;
  onOpenMessaging?: () => void;
  title: string;
  subtitle: string;
  showIndicators?: boolean;
  animatedOpacity?: Animated.Value;
  footer?: React.ReactNode;
};

export default function TabHeroHeader({
  screenWidth,
  showMobileNav,
  isBoardMember,
  onOpenMenu,
  onOpenMessaging,
  title,
  subtitle,
  showIndicators = true,
  animatedOpacity,
  footer,
}: TabHeroHeaderProps) {
  const { paddingTop, height } = useHeroHeaderLayout();

  const header = (
    <View style={[styles.headerContainer, { width: screenWidth, height }]}>
      <ImageBackground
        source={HERO_HEADER_IMAGE}
        style={[styles.header, { paddingTop, height }]}
        imageStyle={[styles.headerImage, { width: screenWidth, height }]}
        resizeMode="stretch"
      >
        <View style={styles.headerOverlay} />
        <View style={styles.headerTop}>
          {showMobileNav ? (
            <TouchableOpacity style={styles.menuButton} onPress={onOpenMenu}>
              <Ionicons name="menu" size={24} color="#ffffff" />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerSpacer} />
          )}

          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={2}>
              {subtitle}
            </Text>
            {showIndicators ? (
              <View style={styles.indicatorsContainer}>
                <DeveloperIndicator />
                <BoardMemberIndicator />
              </View>
            ) : null}
          </View>

          {isBoardMember && onOpenMessaging ? (
            <View style={styles.headerRight}>
              <MessagingButton onPress={onOpenMessaging} />
            </View>
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>
        {footer}
      </ImageBackground>
    </View>
  );

  if (animatedOpacity) {
    return (
      <Animated.View style={{ opacity: animatedOpacity, height }}>
        {header}
      </Animated.View>
    );
  }

  return header;
}

const styles = StyleSheet.create({
  headerContainer: {
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    position: 'relative',
    justifyContent: 'flex-start',
    width: '100%',
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  headerImage: {
    borderRadius: 0,
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    zIndex: 1,
  },
  menuButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
  },
  headerLeft: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
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
    zIndex: 1,
    width: 44,
  },
});
