import { ImageSourcePropType, ImageStyle, Platform } from 'react-native';

/** Pexels — suburban homes at golden hour, pre-cropped for slim desktop headers (3200×420) */
const headerBackgroundDesktop = require('../../assets/header-background-desktop.jpg');

/** Unsplash — modern home exterior (mobile / narrow layouts) */
const headerBackgroundMobile = require('../../assets/header-background-mobile.jpg');

/** Matches app nav breakpoint: desktop tab bar at >= 1024px on web. */
export function getHeaderBackgroundSource(isDesktopView: boolean): ImageSourcePropType {
  return isDesktopView ? headerBackgroundDesktop : headerBackgroundMobile;
}

export function getHeaderBackgroundImageStyle(
  isDesktopView: boolean,
  width: number,
  height: number,
): ImageStyle {
  return {
    width,
    height,
    ...(isDesktopView &&
      Platform.OS === 'web' && {
        objectFit: 'cover',
        objectPosition: 'center 45%',
      }),
  };
}
