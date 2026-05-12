import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  Dimensions,
  Platform,
  Pressable,
  LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';

const { width: screenWidth } = Dimensions.get('window');
const isMobile = screenWidth < 768;

const springConfig = {
  damping: 20,
  stiffness: 300,
};

const springConfigSoft = {
  damping: 18,
  stiffness: 180,
};

interface TabItem {
  name: string;
  icon: string;
  label: string;
  color: string;
}

const CustomTabBar = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();

  const isBoardMember = user?.isBoardMember && user?.isActive;
  const isRenter = user?.isRenter;
  const isDev = user?.isDev ?? false;

  const tabs: TabItem[] = [
    { name: 'Home', icon: 'home', label: 'Home', color: '#6b7280' },
    { name: 'Board', icon: 'people', label: 'Board', color: '#6b7280' },
    { name: 'Community', icon: 'chatbubbles', label: 'Community', color: '#6b7280' },
    { name: 'Covenants', icon: 'document-text', label: 'Covenants', color: '#6b7280' },
    { name: 'Documents', icon: 'folder', label: 'Documents', color: '#6b7280' },
    ...(isBoardMember || !isRenter ? [{ name: 'Fees', icon: 'card', label: 'Fees', color: '#6b7280' }] : []),
    ...(isBoardMember || isDev ? [{ name: 'Admin', icon: 'settings', label: 'Admin', color: '#6b7280' }] : []),
  ];

  const activeIndex = tabs.findIndex((t) => t.name === route.name);
  const safeActiveIndex = activeIndex >= 0 ? activeIndex : 0;

  const pillPosition = useSharedValue(safeActiveIndex);
  const containerOpacity = useSharedValue(0);
  const containerTranslateY = useSharedValue(-8);

  useEffect(() => {
    pillPosition.value = withSpring(safeActiveIndex, springConfig);
  }, [safeActiveIndex, pillPosition]);

  useEffect(() => {
    containerOpacity.value = withTiming(1, { duration: 280 });
    containerTranslateY.value = withSpring(0, springConfigSoft);
  }, [containerOpacity, containerTranslateY]);

  const handleTabPress = (tabName: string) => {
    navigation.navigate(tabName as never);
  };

  const onContainerLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    containerWidth.value = width;
  };

  const containerWidth = useSharedValue(screenWidth - 30);

  if (isMobile) {
    return null;
  }

  const tabCount = tabs.length;

  const pillAnimatedStyle = useAnimatedStyle(() => {
    const totalWidth = containerWidth.value - 16;
    const tabWidth = totalWidth / tabCount;
    const translateX = pillPosition.value * tabWidth + 4;
    return {
      transform: [{ translateX }],
      width: tabWidth - 8,
    };
  }, [tabCount]);

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
    transform: [{ translateY: containerTranslateY.value }],
  }));

  return (
    <Animated.View
      style={[styles.container, containerAnimatedStyle]}
      onLayout={onContainerLayout}
    >
      <View style={styles.pillTrack}>
        <Animated.View style={[styles.pill, pillAnimatedStyle]} />
      </View>
      {tabs.map((tab, index) => (
        <TabButton
          key={tab.name}
          tab={tab}
          isActive={route.name === tab.name}
          onPress={() => handleTabPress(tab.name)}
        />
      ))}
    </Animated.View>
  );
};

interface TabButtonProps {
  tab: TabItem;
  isActive: boolean;
  onPress: () => void;
}

const TabButton = ({ tab, isActive, onPress }: TabButtonProps) => {
  const scale = useSharedValue(1);
  const iconScale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, springConfigSoft);
    iconScale.value = withSpring(0.92, springConfigSoft);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, springConfigSoft);
    iconScale.value = withSpring(1, springConfigSoft);
  };

  const handleMouseEnter = () => {
    if (Platform.OS === 'web' && !isActive) {
      scale.value = withSpring(1.03, springConfigSoft);
    }
  };

  const handleMouseLeave = () => {
    if (Platform.OS === 'web') {
      scale.value = withSpring(1, springConfigSoft);
    }
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={styles.tabPressable}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
    >
      <Animated.View style={[styles.tab, animatedStyle]}>
        <Animated.View style={iconAnimatedStyle}>
          <Ionicons
            name={tab.icon as any}
            size={20}
            color={isActive ? '#0f172a' : tab.color}
          />
        </Animated.View>
        <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]}>
          {tab.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    marginHorizontal: 15,
    marginTop: 10,
    borderRadius: 16,
    padding: 6,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: 'rgba(241, 245, 249, 1)',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
      } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 4,
      },
    }),
  },
  pillTrack: {
    ...StyleSheet.absoluteFillObject,
    left: 8,
    right: 8,
    top: 8,
    bottom: 8,
    borderRadius: 12,
    pointerEvents: 'none',
  },
  pill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: 12,
    backgroundColor: 'rgba(241, 245, 249, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
      },
    }),
  },
  tabPressable: {
    flex: 1,
    zIndex: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    marginHorizontal: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },
  activeTabLabel: {
    color: '#0f172a',
    fontWeight: '600',
  },
});

export default CustomTabBar;
