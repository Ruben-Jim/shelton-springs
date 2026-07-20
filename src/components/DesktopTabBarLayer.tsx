import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { View, Platform, Dimensions, StyleSheet } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import CustomTabBar from './CustomTabBar';

const DESKTOP_BREAKPOINT = 1024;
const { width: initialWidth } = Dimensions.get('window');

/** Routes that should show the public desktop navbar. Admin uses its own sidebar. */
const PUBLIC_TAB_BAR_ROUTES = new Set([
  'Home',
  'Board',
  'Community',
  'Fees',
  'Documents',
  'Covenants',
]);

const ShowPublicTabBarContext = createContext(true);

/** Kept for call-site compatibility after removing the overlay positioning system. */
export function useDesktopTabBarScrollSync() {
  return useCallback(() => {}, []);
}

export function DesktopTabBarProvider({
  children,
  activeRouteName,
}: {
  children: React.ReactNode;
  activeRouteName: string;
  onNavigate: (routeName: string) => void;
}) {
  const [screenWidth, setScreenWidth] = useState(initialWidth);

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
    });
    return () => sub?.remove();
  }, []);

  const showPublicTabBar =
    Platform.OS === 'web' &&
    screenWidth >= DESKTOP_BREAKPOINT &&
    PUBLIC_TAB_BAR_ROUTES.has(activeRouteName);

  return (
    <ShowPublicTabBarContext.Provider value={showPublicTabBar}>
      <View style={styles.providerRoot}>{children}</View>
    </ShowPublicTabBarContext.Provider>
  );
}

export function DesktopTabBarSlot() {
  const showPublicTabBar = useContext(ShowPublicTabBarContext);
  const isFocused = useIsFocused();

  // Only the focused public screen renders the navbar. Admin never shows it.
  if (!showPublicTabBar || !isFocused) {
    return null;
  }

  return <CustomTabBar />;
}

const styles = StyleSheet.create({
  providerRoot: {
    flex: 1,
  },
});
