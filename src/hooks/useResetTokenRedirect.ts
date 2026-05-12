import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { useNavigation } from '@react-navigation/native';

/**
 * When mounted on an auth screen, checks for resetToken in the URL and
 * navigates to ResetPassword if present. Handles both web (?resetToken=xxx)
 * and mobile deep links.
 */
export function useResetTokenRedirect() {
  const navigation = useNavigation();

  useEffect(() => {
    let cancelled = false;

    const checkAndRedirect = async () => {
      let token: string | null = null;

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        token = params.get('resetToken');
      } else {
        const url = await Linking.getInitialURL();
        if (url) {
          const parsed = Linking.parse(url);
          const q = parsed.queryParams as Record<string, string> | undefined;
          token = q?.resetToken ?? null;
        }
      }

      if (cancelled || !token) return;

      // Clear token from URL immediately to prevent this hook from firing again
      // when LoginScreen (now in stack) mounts - avoids infinite redirect loop
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('resetToken');
        window.history.replaceState({}, '', url.pathname + url.search);
      }

      navigation.reset({
        index: 1,
        routes: [
          { name: 'Login' },
          { name: 'ResetPassword', params: { resetToken: token } },
        ],
      });
    };

    checkAndRedirect();
    return () => {
      cancelled = true;
    };
  }, [navigation]);
}
