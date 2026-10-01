import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface LoadingStateProps {
  /** e.g. "Loading covenants…" */
  message?: string;
}

const RING_SIZE = 56;

/**
 * Shelton Springs branded loading indicator: a leaf inside a spinning green ring.
 * Use in place of an empty state while a list query is still undefined.
 */
const LoadingState = ({ message = 'Loading…' }: LoadingStateProps) => {
  const spin = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Short fade-in so very fast loads don't flash the spinner
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 250,
      delay: 120,
      useNativeDriver: true,
    }).start();

    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [spin, fadeIn]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View
      style={[styles.container, { opacity: fadeIn }]}
      accessibilityRole="progressbar"
      accessibilityLabel={message}
    >
      <View style={styles.ringWrap}>
        <Animated.View style={[styles.ring, { transform: [{ rotate }] }]} />
        <Ionicons name="leaf" size={22} color="#16a34a" />
      </View>
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RING_SIZE / 2,
    backgroundColor: '#f0fdf4',
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 3,
    borderColor: '#dcfce7',
    borderTopColor: '#22c55e',
  },
  message: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
});

export default LoadingState;
