import type { NavigationState, PartialState } from '@react-navigation/native';

export function getActiveRouteName(
  state: NavigationState | PartialState<NavigationState> | undefined
): string {
  if (!state) return 'Home';

  const index = state.index ?? 0;
  const route = state.routes[index];
  if (!route) return 'Home';

  if (route.state) {
    return getActiveRouteName(route.state);
  }

  return route.name;
}
