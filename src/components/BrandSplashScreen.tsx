import React, { useEffect, useRef } from 'react';
import { View, Text, Image, StyleSheet, Animated, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';

export type BrandSplashStatus = 'signing' | 'success' | 'loading';

export const BRAND_SPLASH_BACKGROUND = '#0B1A12';
const PROGRESS_GREEN = '#4ADE80';
const BAR_WIDTH = 148;

const STATUS_TEXT: Record<BrandSplashStatus, string> = {
  signing: 'SIGNING YOU IN...',
  success: 'SUCCESSFULLY SIGNED IN',
  loading: 'LOADING',
};

if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

type BrandSplashScreenProps = {
  status: BrandSplashStatus;
  progress: number;
};

export default function BrandSplashScreen({ status, progress }: BrandSplashScreenProps) {
  const fillAnim = useRef(new Animated.Value(Math.max(0, Math.min(progress, 1)))).current;

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: Math.max(0, Math.min(progress, 1)),
      duration: 450,
      useNativeDriver: false,
    }).start();
  }, [fillAnim, progress]);

  const fillWidth = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, BAR_WIDTH],
  });

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.center}>
        <View style={styles.logoFrame}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: fillWidth }]} />
        </View>

        <Text style={styles.title}>Shelton Springs HOA</Text>
        <Text style={styles.status}>{STATUS_TEXT[status]}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND_SPLASH_BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  logoFrame: {
    width: 196,
    height: 196,
    borderRadius: 40,
    backgroundColor: '#F3F7EE',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 196,
    height: 196,
  },
  progressTrack: {
    width: BAR_WIDTH,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(74, 222, 128, 0.18)',
    overflow: 'hidden',
    marginTop: 28,
  },
  progressFill: {
    height: 3,
    borderRadius: 2,
    backgroundColor: PROGRESS_GREEN,
  },
  title: {
    marginTop: 22,
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  status: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.55)',
    letterSpacing: 1.6,
    textAlign: 'center',
  },
});
