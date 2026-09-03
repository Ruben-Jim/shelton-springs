import type { StatusBarStyle } from 'expo-status-bar';

/** Tab roots with photo heroes — light status bar icons over the image. */
const LIGHT_STATUS_BAR_ROUTES = new Set([
  'Home',
  'Community',
  'Board',
  'Documents',
  'Fees',
  'Covenants',
  'Admin',
]);

/** Forms, admin tools, and auth — dark status bar icons on light backgrounds. */
const DARK_STATUS_BAR_ROUTES = new Set([
  'ResidentNotice',
  'Login',
  'Signup',
  'ForgotPassword',
  'ResetPassword',
]);

export function getStatusBarStyleForRoute(routeName: string): StatusBarStyle {
  if (LIGHT_STATUS_BAR_ROUTES.has(routeName)) return 'light';
  if (DARK_STATUS_BAR_ROUTES.has(routeName)) return 'dark';
  return 'dark';
}

export function routeUsesHeroUnderStatusBar(routeName: string): boolean {
  return LIGHT_STATUS_BAR_ROUTES.has(routeName);
}
