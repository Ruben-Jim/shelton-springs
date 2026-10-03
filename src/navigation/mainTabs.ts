import { Dimensions, Easing, Platform } from 'react-native';
import { CommonActions, NavigationState } from '@react-navigation/native';
import type { Ionicons } from '@expo/vector-icons';
import type {
  StackCardStyleInterpolator,
  StackNavigationOptions,
} from '@react-navigation/stack';

/** Top-level sections reachable from the nav menu / desktop tab bar. */
export const MAIN_TAB_ROUTES = ['Home', 'Board', 'Community', 'Fees', 'Admin'] as const;
export type MainTabRoute = (typeof MAIN_TAB_ROUTES)[number];

export const isMainTabRoute = (name: string): name is MainTabRoute =>
  (MAIN_TAB_ROUTES as readonly string[]).includes(name);

type IoniconName = keyof typeof Ionicons.glyphMap;

export type MainTabItem = { name: MainTabRoute; icon: IoniconName; label: string };

type MainTabUser = {
  isBoardMember?: boolean;
  isActive?: boolean;
  isRenter?: boolean;
  isDev?: boolean;
  isTestUser?: boolean;
} | null | undefined;

/** Main tabs the user can see, in nav order (same rules as the mobile menu). */
export function getMainTabs(user: MainTabUser): MainTabItem[] {
  const isBoardMember = !!(user?.isBoardMember && user?.isActive);
  const showFees = isBoardMember || (!user?.isRenter && user?.isTestUser !== true);
  const showAdmin = isBoardMember || (user?.isDev ?? false);
  return [
    { name: 'Home', icon: 'home', label: 'Home' },
    { name: 'Board', icon: 'business', label: 'HOA' },
    { name: 'Community', icon: 'chatbubbles', label: 'Community' },
    ...(showFees ? [{ name: 'Fees', icon: 'card', label: 'Fees' } as MainTabItem] : []),
    ...(showAdmin ? [{ name: 'Admin', icon: 'settings', label: 'Admin' } as MainTabItem] : []),
  ];
}

export type BoardSubTabId = 'board' | 'covenants' | 'documents';
export type CommunitySubTabId = 'posts' | 'polls' | 'notifications' | 'pets' | 'damage';

export type SubTabItem<Id extends string = string> = { id: Id; label: string; icon: IoniconName };

export const BOARD_SUB_TABS: ReadonlyArray<SubTabItem<BoardSubTabId>> = [
  { id: 'board', label: 'Board Members', icon: 'people' },
  { id: 'covenants', label: 'Covenants', icon: 'document-text' },
  { id: 'documents', label: 'Documents', icon: 'folder' },
];

/** Tab bar order only; default subtab when opening Community is still Posts. */
export const COMMUNITY_SUB_TABS: ReadonlyArray<SubTabItem<CommunitySubTabId>> = [
  { id: 'damage', label: 'Damage Report', icon: 'construct' },
  { id: 'posts', label: 'Posts', icon: 'chatbubbles' },
  { id: 'polls', label: 'Polls', icon: 'bar-chart' },
  { id: 'notifications', label: 'Moving/Leaving', icon: 'home' },
  { id: 'pets', label: 'Pet Registration', icon: 'paw' },
];

/** Subtabs reachable from the desktop nav's hover dropdowns. */
export const MAIN_TAB_SUBTABS: Partial<Record<MainTabRoute, ReadonlyArray<SubTabItem>>> = {
  Board: BOARD_SUB_TABS,
  Community: COMMUNITY_SUB_TABS,
};

type NavigationLike = {
  dispatch: (action: any) => void;
  getState: () => NavigationState | undefined;
};

/**
 * Switch to a main tab without building back history between tabs (like iOS tab bars).
 * - Tab already in the stack (e.g. a sub-page is open on top of it): go back to it.
 * - Otherwise: replace the whole stack with the tab.
 */
export function switchMainTab(navigation: NavigationLike, name: MainTabRoute, params?: object) {
  const state = navigation.getState();
  if (state?.routes.some((route) => route.name === name)) {
    navigation.dispatch(CommonActions.navigate({ name, params, merge: true }));
    return;
  }
  navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name, params }] }));
}

/**
 * Main tabs: the new page fades in over the old one in a few frames. The old page stays
 * fully drawn underneath, so the screen never blinks while the new page renders its first
 * frame. Headers line up exactly (see useHeroHeightStyle), so this reads as a seamless swap
 * and the visible motion comes from the content entrance (motion/TabEntrance).
 */
const forTabSwap: StackCardStyleInterpolator = ({ current, next }) =>
  next ? {} : { cardStyle: { opacity: current.progress } };

const TAB_SWAP_SPEC = {
  animation: 'timing' as const,
  config: { duration: 180, easing: Easing.out(Easing.quad) },
};

// Matches the desktop nav breakpoint; desktop web keeps instant switching
const DESKTOP_MIN_WIDTH = 1024;

export const mainTabScreenOptions = (): StackNavigationOptions => {
  if (Platform.OS === 'web' && Dimensions.get('window').width >= DESKTOP_MIN_WIDTH) {
    return { animation: 'none', gestureEnabled: false };
  }
  return {
    animation: 'default',
    gestureEnabled: false,
    cardOverlayEnabled: false,
    cardStyleInterpolator: forTabSwap,
    transitionSpec: { open: TAB_SWAP_SPEC, close: TAB_SWAP_SPEC },
  };
};
