import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import BrandSplashScreen, {
  BrandSplashStatus,
} from '../components/BrandSplashScreen';
import { useAuth } from './AuthContext';

const SUCCESS_MS = 900;
const LOADING_MS = 700;
const NO_SESSION_MS = 650;
const MIN_SIGNING_MS = 700;

type BrandSplashContextValue = {
  visible: boolean;
  status: BrandSplashStatus;
  progress: number;
  beginSigningIn: () => void;
  finishSignIn: () => Promise<void>;
  cancelSigningIn: () => void;
};

const BrandSplashContext = createContext<BrandSplashContextValue | undefined>(undefined);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const useBrandSplash = () => {
  const context = useContext(BrandSplashContext);
  if (context === undefined) {
    throw new Error('useBrandSplash must be used within a BrandSplashProvider');
  }
  return context;
};

export const BrandSplashProvider = ({ children }: { children: ReactNode }) => {
  const [visible, setVisible] = useState(Platform.OS !== 'web');
  const [status, setStatus] = useState<BrandSplashStatus>('loading');
  const [progress, setProgress] = useState(0.22);
  const signingStartedAt = useRef(Date.now());

  const beginSigningIn = useCallback(() => {
    if (Platform.OS === 'web') return;
    signingStartedAt.current = Date.now();
    setStatus('signing');
    setProgress(0.38);
    setVisible(true);
  }, []);

  const finishSignIn = useCallback(async () => {
    if (Platform.OS === 'web') {
      setVisible(false);
      return;
    }

    const remainingSigning = Math.max(
      0,
      MIN_SIGNING_MS - (Date.now() - signingStartedAt.current)
    );
    if (remainingSigning > 0) {
      await wait(remainingSigning);
    }

    setStatus('success');
    setProgress(0.72);
    await wait(SUCCESS_MS);
    setStatus('loading');
    setProgress(1);
    await wait(LOADING_MS);
    setVisible(false);
  }, []);

  const cancelSigningIn = useCallback(() => {
    setVisible(false);
  }, []);

  const showLoadingThenHide = useCallback(async () => {
    if (Platform.OS === 'web') {
      setVisible(false);
      return;
    }
    setStatus('loading');
    setProgress(0.85);
    setVisible(true);
    await wait(NO_SESSION_MS);
    setProgress(1);
    await wait(250);
    setVisible(false);
  }, []);

  const launchHandled = useRef(false);
  const { isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (Platform.OS === 'web') {
      setVisible(false);
      return;
    }
    if (launchHandled.current) return;

    if (isLoading) {
      setStatus('loading');
      setProgress(0.28);
      setVisible(true);
      return;
    }

    launchHandled.current = true;
    if (isAuthenticated) {
      beginSigningIn();
      void finishSignIn();
    } else {
      void showLoadingThenHide();
    }
  }, [isLoading, isAuthenticated, beginSigningIn, finishSignIn, showLoadingThenHide]);

  const value = useMemo(
    () => ({
      visible,
      status,
      progress,
      beginSigningIn,
      finishSignIn,
      cancelSigningIn,
    }),
    [visible, status, progress, beginSigningIn, finishSignIn, cancelSigningIn]
  );

  return (
    <BrandSplashContext.Provider value={value}>
      <View style={styles.root}>
        {children}
        {visible && Platform.OS !== 'web' ? (
          <View style={styles.overlay} pointerEvents="auto">
            <BrandSplashScreen status={status} progress={progress} />
          </View>
        ) : null}
      </View>
    </BrandSplashContext.Provider>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
});
