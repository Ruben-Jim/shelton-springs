import React from 'react';
import { View } from 'react-native';
import { DESKTOP_CONTENT_STYLE } from '../constants/hoaTheme';

/**
 * Desktop web: caps page content at DESKTOP_CONTENT_MAX_WIDTH so it lines up with the nav.
 * Always the same View (only the style changes) so crossing the breakpoint never remounts
 * the page; an unstyled View in a column is layout-neutral on mobile.
 */
export default function DesktopContentWidth({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  return <View style={enabled ? DESKTOP_CONTENT_STYLE : undefined}>{children}</View>;
}
