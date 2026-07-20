import { Platform } from 'react-native';
import {
  CardStyleInterpolators,
  StackNavigationOptions,
} from '@react-navigation/stack';

export const defaultStackScreenOptions: StackNavigationOptions = {
  headerShown: false,
  animationEnabled: Platform.OS !== 'web',
  gestureEnabled: Platform.OS !== 'web',
  gestureDirection: 'horizontal',
  cardOverlayEnabled: Platform.OS !== 'web',
  cardStyle: { backgroundColor: '#f3f4f6' },
  cardStyleInterpolator:
    Platform.OS === 'web'
      ? CardStyleInterpolators.forNoAnimation
      : CardStyleInterpolators.forHorizontalIOS,
  transitionSpec:
    Platform.OS === 'web'
      ? {
          open: { animation: 'timing', config: { duration: 0 } },
          close: { animation: 'timing', config: { duration: 0 } },
        }
      : {
          open: {
            animation: 'spring',
            config: {
              stiffness: 420,
              damping: 38,
              mass: 0.95,
              overshootClamping: true,
              restDisplacementThreshold: 0.01,
              restSpeedThreshold: 0.01,
            },
          },
          close: {
            animation: 'spring',
            config: {
              stiffness: 420,
              damping: 38,
              mass: 0.95,
              overshootClamping: true,
              restDisplacementThreshold: 0.01,
              restSpeedThreshold: 0.01,
            },
          },
        },
};
