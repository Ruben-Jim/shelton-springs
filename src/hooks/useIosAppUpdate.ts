import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkIosAppUpdate } from '../services/iosAppStoreVersion';

const DISMISSED_VERSION_KEY = 'ios_app_update_dismissed_version';

export function useIosAppUpdate() {
  const [visible, setVisible] = useState(false);
  const [storeVersion, setStoreVersion] = useState<string | undefined>();
  const [storeUrl, setStoreUrl] = useState<string | undefined>();
  const checkingRef = useRef(false);

  const runCheck = useCallback(async () => {
    if (Platform.OS !== 'ios' || checkingRef.current) return;
    checkingRef.current = true;

    try {
      const result = await checkIosAppUpdate();
      if (!result?.updateAvailable || !result.storeVersion) {
        setVisible(false);
        return;
      }

      const dismissedVersion = await AsyncStorage.getItem(DISMISSED_VERSION_KEY);
      if (dismissedVersion === result.storeVersion) {
        setVisible(false);
        return;
      }

      setStoreVersion(result.storeVersion);
      setStoreUrl(result.storeUrl);
      setVisible(true);
    } catch {
      // Best effort only.
    } finally {
      checkingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    runCheck();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        runCheck();
      }
    });

    return () => subscription.remove();
  }, [runCheck]);

  const dismiss = useCallback(async () => {
    if (storeVersion) {
      try {
        await AsyncStorage.setItem(DISMISSED_VERSION_KEY, storeVersion);
      } catch {
        // Best effort only.
      }
    }
    setVisible(false);
  }, [storeVersion]);

  const openStore = useCallback(async () => {
    if (!storeUrl) return;
    try {
      const canOpen = await Linking.canOpenURL(storeUrl);
      if (canOpen) {
        await Linking.openURL(storeUrl);
      }
    } catch {
      // Best effort only.
    }
  }, [storeUrl]);

  return {
    visible,
    storeVersion,
    dismiss,
    openStore,
  };
}
