import { useEffect, useState } from 'react';
import { Dimensions, Platform } from 'react-native';

const DESKTOP_BREAKPOINT = 1024;
const TABLET_BREAKPOINT = 640;
const ADMIN_CONTENT_MAX_WIDTH = 1280;
const SIDEBAR_WIDTH = 248;

function getColumnCount(screenWidth: number, useSidebar: boolean) {
  const contentWidth = useSidebar ? screenWidth - SIDEBAR_WIDTH : screenWidth;
  if (contentWidth >= 1400) return 4;
  if (contentWidth >= 1000) return 3;
  if (contentWidth >= 640) return 2;
  return 1;
}

export function useAdminLayout() {
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
    });
    return () => subscription?.remove();
  }, []);

  const isMobileDevice = Platform.OS === 'ios' || Platform.OS === 'android';
  const isDesktop = !isMobileDevice && screenWidth >= DESKTOP_BREAKPOINT;
  const isTablet = !isMobileDevice && screenWidth >= TABLET_BREAKPOINT && screenWidth < DESKTOP_BREAKPOINT;
  const isPhone = isMobileDevice || screenWidth < TABLET_BREAKPOINT;
  const showMobileNav = isMobileDevice || screenWidth < DESKTOP_BREAKPOINT;
  const useSidebar = isDesktop;

  const columns = isDesktop || isTablet ? getColumnCount(screenWidth, useSidebar) : 1;
  const columnWidthPercent = 100 / columns;

  return {
    screenWidth,
    isMobileDevice,
    isDesktop,
    isTablet,
    isPhone,
    showMobileNav,
    useSidebar,
    columns,
    columnWidthPercent,
    contentMaxWidth: isDesktop && !useSidebar ? ADMIN_CONTENT_MAX_WIDTH : undefined,
    sidebarWidth: SIDEBAR_WIDTH,
  };
}
