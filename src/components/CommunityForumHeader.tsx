import React, { memo } from 'react';
import { Animated } from 'react-native';
import TabHeroHeader from './TabHeroHeader';

type CommunityForumHeaderProps = {
  screenWidth: number;
  showMobileNav: boolean;
  isBoardMember: boolean;
  onOpenMenu: () => void;
  onOpenMessaging: () => void;
  animatedOpacity?: Animated.Value;
};

function CommunityForumHeader({
  screenWidth,
  showMobileNav,
  isBoardMember,
  onOpenMenu,
  onOpenMessaging,
  animatedOpacity,
}: CommunityForumHeaderProps) {
  return (
    <TabHeroHeader
      screenWidth={screenWidth}
      showMobileNav={showMobileNav}
      isBoardMember={isBoardMember}
      onOpenMenu={onOpenMenu}
      onOpenMessaging={onOpenMessaging}
      title="Community Forum"
      subtitle="Connect with your neighbors and stay informed"
      animatedOpacity={animatedOpacity}
    />
  );
}

export default memo(CommunityForumHeader);
