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
import TestUserIndicator from './TestUserIndicator';
import TestUserReadOnlyBanner from './TestUserReadOnlyBanner';
import MessagingButton from './MessagingButton';
import {
  getHeroImage,
  HERO_READ_ONLY_BANNER_HEIGHT,
  useHeroHeaderLayout,
} from '../hooks/useHeroHeaderPadding';
import { useIsTestUserReadOnly } from '../hooks/useGuardedMutation';
import Reanimated from 'react-native-reanimated';
import { useHeroHeightStyle, useTabEntranceStyle } from './motion/TabEntrance';

type TabHeroHeaderProps = {
  screenWidth: number;
  showMobileNav: boolean;
  hasBoardAccess: boolean;
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
  hasBoardAccess,
  onOpenMenu,
  onOpenMessaging,
  title,
  subtitle,
  showIndicators = true,
  animatedOpacity,
  footer,
}: TabHeroHeaderProps) {
  const { paddingTop, height: compactHeight } = useHeroHeaderLayout({ compact: true });
  // Draw the photo at Home's full hero size so framing matches Home; the shorter header trims the bottom
  const { imageHeight } = useHeroHeaderLayout();
  const { isReadOnly } = useIsTestUserReadOnly();
  const height = compactHeight + (isReadOnly ? HERO_READ_ONLY_BANNER_HEIGHT : 0);
  // Header frame morphs from the previous tab's height; the title cross-dissolves in
  const heightStyle = useHeroHeightStyle(height);
  const titleStyle = useTabEntranceStyle(0, 6);
  const heroImage = getHeroImage(screenWidth);
  const fullHeight = Math.max(height, imageHeight);

  const header = (
    <Reanimated.View style={[styles.headerContainer, { width: screenWidth }, heightStyle]}>
      <ImageBackground
        source={heroImage.source}
        // Full photo height; the animated container clips it to the current header height
        style={[styles.header, { paddingTop, height: fullHeight }]}
        imageStyle={[
          styles.headerImage,
          // Desktop: cover the visible header so the wide crop centers on the mountains and lake
          { width: screenWidth, height: heroImage.isDesktop ? height : imageHeight },
        ]}
        resizeMode={heroImage.resizeMode}
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

          <Reanimated.View style={[styles.headerLeft, titleStyle]}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={2}>
              {subtitle}
            </Text>
            {showIndicators ? (
              <View style={styles.indicatorsContainer}>
                <TestUserIndicator />
                <DeveloperIndicator />
                <BoardMemberIndicator />
              </View>
            ) : null}
            {isReadOnly ? <TestUserReadOnlyBanner /> : null}
          </Reanimated.View>

          {hasBoardAccess && onOpenMessaging ? (
            <View style={styles.headerRight}>
              <MessagingButton onPress={onOpenMessaging} />
            </View>
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>
        {footer}
      </ImageBackground>
    </Reanimated.View>
  );

  if (animatedOpacity) {
    return (
      <Animated.View style={{ opacity: animatedOpacity }}>
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
