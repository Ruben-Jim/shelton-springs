import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, Platform, Pressable, LayoutChangeEvent } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import {
  getMainTabs,
  isMainTabRoute,
  switchMainTab,
  MAIN_TAB_SUBTABS,
  MainTabItem,
  MainTabRoute,
  SubTabItem,
} from '../navigation/mainTabs';
import { SECTION_ACCENTS, DESKTOP_CONTENT_MAX_WIDTH } from '../constants/hoaTheme';
import { renderInBodyPortal } from './webPortal';

const INACTIVE_COLOR = '#6b7280';
const INDICATOR_SPRING = { damping: 22, stiffness: 260 };
/** Grace period so the pointer can travel from a tab into its dropdown. */
const DROPDOWN_CLOSE_DELAY = 150;

/**
 * Each focused screen mounts its own bar, so remember where the underline last sat.
 * The next bar starts there and slides to its own tab.
 */
let lastIndicator: { x: number; width: number } | null = null;

interface CustomTabBarViewProps {
  routeName: string;
  activeSubTab?: string;
  onNavigate: (routeName: string) => void;
  onNavigateSubTab?: (routeName: MainTabRoute, subTabId: string) => void;
  embedded?: boolean;
}

function CustomTabBarView({
  routeName,
  activeSubTab,
  onNavigate,
  onNavigateSubTab,
  embedded = false,
}: CustomTabBarViewProps) {
  const { user } = useAuth();
  const tabs = getMainTabs(user);
  const activeTab = tabs.find((t) => t.name === routeName);
  const activeColor = activeTab ? SECTION_ACCENTS[activeTab.name] : 'transparent';

  const layouts = useRef<Partial<Record<string, { x: number; width: number }>>>({});
  const indicatorX = useSharedValue(lastIndicator?.x ?? 0);
  const indicatorWidth = useSharedValue(lastIndicator?.width ?? 0);

  const placeIndicator = useCallback(() => {
    const layout = layouts.current[routeName];
    if (!layout) return;
    const hadPrevious = lastIndicator != null;
    if (hadPrevious) {
      indicatorX.value = withSpring(layout.x, INDICATOR_SPRING);
      indicatorWidth.value = withSpring(layout.width, INDICATOR_SPRING);
    } else {
      indicatorX.value = layout.x;
      indicatorWidth.value = layout.width;
    }
    lastIndicator = layout;
  }, [routeName, indicatorX, indicatorWidth]);

  useEffect(() => {
    placeIndicator();
  }, [placeIndicator]);

  const indicatorStyle = useAnimatedStyle(() => ({
    width: indicatorWidth.value,
    transform: [{ translateX: indicatorX.value }],
  }));

  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpenMenu(null), DROPDOWN_CLOSE_DELAY);
  }, [cancelClose]);

  useEffect(() => cancelClose, [cancelClose]);

  // The dropdown is fixed-positioned in a portal, so close it if the page moves under it
  useEffect(() => {
    if (!openMenu || Platform.OS !== 'web') return;
    const close = () => setOpenMenu(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [openMenu]);

  const handleTabLayout = (name: string) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    layouts.current[name] = { x, width };
    if (name === routeName) placeIndicator();
  };

  return (
    <View style={[styles.container, embedded && styles.containerEmbedded]}>
      <View style={styles.row}>
        {tabs.map((tab) => (
          <TabButton
            key={tab.name}
            tab={tab}
            isActive={routeName === tab.name}
            activeSubTab={routeName === tab.name ? activeSubTab : undefined}
            subTabs={MAIN_TAB_SUBTABS[tab.name]}
            isMenuOpen={openMenu === tab.name}
            onLayout={handleTabLayout(tab.name)}
            onHoverIn={() => {
              cancelClose();
              setOpenMenu(MAIN_TAB_SUBTABS[tab.name] ? tab.name : null);
            }}
            onHoverOut={scheduleClose}
            onPress={() => {
              setOpenMenu(null);
              if (routeName !== tab.name) onNavigate(tab.name);
            }}
            onPressSubTab={(subTabId) => {
              setOpenMenu(null);
              if (onNavigateSubTab) onNavigateSubTab(tab.name, subTabId);
              else if (routeName !== tab.name) onNavigate(tab.name);
            }}
          />
        ))}
        <Animated.View
          pointerEvents="none"
          style={[styles.indicator, { backgroundColor: activeColor }, indicatorStyle]}
        />
      </View>
    </View>
  );
}

interface CustomTabBarEmbeddedProps {
  routeName: string;
  onNavigate: (routeName: string) => void;
}

export function CustomTabBarEmbedded({ routeName, onNavigate }: CustomTabBarEmbeddedProps) {
  return <CustomTabBarView routeName={routeName} onNavigate={onNavigate} embedded />;
}

function CustomTabBarWithNavigation() {
  const navigation = useNavigation();
  const routeName = useNavigationState((state) => {
    if (!state || state.index == null) return 'Home';
    return state.routes[state.index]?.name ?? 'Home';
  });
  const activeSubTab = useNavigationState((state) => {
    if (!state || state.index == null) return undefined;
    const params = state.routes[state.index]?.params as { activeSubTab?: string } | undefined;
    return params?.activeSubTab;
  });

  return (
    <CustomTabBarView
      routeName={routeName}
      activeSubTab={activeSubTab}
      onNavigate={(name) => {
        if (isMainTabRoute(name)) switchMainTab(navigation, name);
      }}
      onNavigateSubTab={(name, subTabId) => {
        // Nonce re-applies the subtab even if the params already hold this id
        switchMainTab(navigation, name, { activeSubTab: subTabId, subTabNonce: Date.now() });
      }}
    />
  );
}

interface TabButtonProps {
  tab: MainTabItem;
  isActive: boolean;
  activeSubTab?: string;
  subTabs?: ReadonlyArray<SubTabItem>;
  isMenuOpen: boolean;
  onLayout: (e: LayoutChangeEvent) => void;
  onHoverIn: () => void;
  onHoverOut: () => void;
  onPress: () => void;
  onPressSubTab: (subTabId: string) => void;
}

const TabButton = ({
  tab,
  isActive,
  activeSubTab,
  subTabs,
  isMenuOpen,
  onLayout,
  onHoverIn,
  onHoverOut,
  onPress,
  onPressSubTab,
}: TabButtonProps) => {
  const [hovered, setHovered] = useState(false);
  const accent = SECTION_ACCENTS[tab.name];
  const color = isActive ? accent : INACTIVE_COLOR;
  const wrapRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);

  // Place the portaled dropdown under this tab (react-native-web refs are DOM elements)
  useLayoutEffect(() => {
    if (!isMenuOpen || Platform.OS !== 'web') return;
    const rect = (wrapRef.current as unknown as HTMLElement | null)?.getBoundingClientRect?.();
    if (rect) setAnchor({ top: rect.bottom, left: rect.left + rect.width / 2 });
  }, [isMenuOpen]);

  const hoverHandlers =
    Platform.OS === 'web' ? ({ onMouseEnter: onHoverIn, onMouseLeave: onHoverOut } as object) : null;

  const dropdown =
    subTabs && isMenuOpen ? (
      <View
        style={[
          styles.dropdown,
          Platform.OS === 'web' && anchor
            ? ({ position: 'fixed', top: anchor.top, left: anchor.left } as any)
            : null,
        ]}
        accessibilityRole="menu"
        // Portaled out of the tab, so it needs its own hover handlers to stay open
        {...hoverHandlers}
      >
        {subTabs.map((item) => (
          <SubTabMenuItem
            key={item.id}
            item={item}
            accent={accent}
            isActive={item.id === activeSubTab}
            onPress={() => onPressSubTab(item.id)}
          />
        ))}
      </View>
    ) : null;

  return (
    <View
      ref={wrapRef}
      style={[styles.tabWrap, isMenuOpen && styles.tabWrapOpen]}
      onLayout={onLayout}
      {...hoverHandlers}
    >
      <Pressable
        onPress={onPress}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        style={[styles.tab, (hovered || isMenuOpen) && { backgroundColor: `${accent}14` }]}
        accessibilityRole="tab"
        accessibilityState={{ selected: isActive }}
      >
        <Ionicons name={tab.icon} size={20} color={color} />
        <Text style={[styles.tabLabel, { color }, isActive && styles.tabLabelActive]}>
          {tab.label}
        </Text>
        {subTabs ? (
          <Ionicons
            name={isMenuOpen ? 'chevron-up' : 'chevron-down'}
            size={12}
            color={color}
          />
        ) : null}
      </Pressable>

      {/* Web: render at the page root so no screen wrapper or later sibling can cover it */}
      {Platform.OS === 'web'
        ? dropdown && anchor
          ? renderInBodyPortal(dropdown)
          : null
        : dropdown}
    </View>
  );
};

const SubTabMenuItem = ({
  item,
  accent,
  isActive,
  onPress,
}: {
  item: SubTabItem;
  accent: string;
  isActive: boolean;
  onPress: () => void;
}) => {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="menuitem"
      style={[
        styles.menuItem,
        { borderLeftColor: accent },
        (isActive || hovered) && { backgroundColor: `${accent}14` },
      ]}
    >
      <Ionicons name={item.icon} size={18} color={isActive || hovered ? accent : INACTIVE_COLOR} />
      <Text style={[styles.menuItemText, isActive && { color: accent, fontWeight: '600' }]}>
        {item.label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    // Dropdowns must draw over the in-page subtab strip (zIndex 10)
    zIndex: 20,
    paddingHorizontal: 16,
  },
  containerEmbedded: {
    flex: 1,
    paddingHorizontal: 0,
  },
  row: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: DESKTOP_CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    position: 'relative',
  },
  tabWrap: {
    flex: 1,
    position: 'relative',
  },
  tabWrapOpen: {
    zIndex: 2,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginVertical: 4,
    borderRadius: 10,
    ...Platform.select({ web: { cursor: 'pointer', transition: 'background-color 120ms ease' } as any }),
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  tabLabelActive: {
    fontWeight: '600',
  },
  indicator: {
    position: 'absolute',
    left: 0,
    bottom: -1,
    height: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: '50%',
    minWidth: 220,
    // Center under the tab (half of minWidth)
    marginLeft: -110,
    marginTop: 2,
    zIndex: 1000,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0 12px 32px rgba(15,23,42,0.12), 0 2px 6px rgba(15,23,42,0.06)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 8,
      },
    }),
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderLeftWidth: 4,
    ...Platform.select({ web: { cursor: 'pointer' } as any }),
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
});

export default React.memo(CustomTabBarWithNavigation);
