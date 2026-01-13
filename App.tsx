import React, { useMemo, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Platform, ScrollView } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { MessagingProvider, useMessaging } from './src/context/MessagingContext';
import AuthNavigator from './src/navigation/AuthNavigator';
import enhancedUnifiedNotificationManager from './src/services/EnhancedUnifiedNotificationManager';
import MessagingOverlay from './src/components/MessagingOverlay';
import MinimizedMessageBubble from './src/components/MinimizedMessageBubble';
import ErrorBoundary from './src/components/ErrorBoundary';
import AnimatedSplashScreen from './src/components/AnimatedSplashScreen';
import { useUserNotifications } from './src/hooks/useUserNotifications';

import HomeScreen from './src/screens/HomeScreen';
import BoardScreen from './src/screens/BoardScreen';
import CommunityScreen from './src/screens/CommunityScreen';
import CovenantsScreen from './src/screens/CovenantsScreen';
import DocumentsScreen from './src/screens/DocumentsScreen';
import FeesScreen from './src/screens/FeesScreen';
import BlockedAccountScreen from './src/screens/BlockedAccountScreen';
import AdminScreen from './src/screens/AdminScreen';

const Stack = createStackNavigator();

const MainAppContent = () => {
  const { isAuthenticated, isLoading, isUserBlocked, user } = useAuth();
  const { showOverlay, setShowOverlay } = useMessaging();
  // Initialize notification hook to reactively get and display notifications
  useUserNotifications();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <AuthNavigator />;
  }

  // Check if user is blocked
  if (isUserBlocked()) {
    return <BlockedAccountScreen />;
  }

  const isBoardMember = user?.isBoardMember && user?.isActive;
  const isDev = user?.isDev ?? false;

  return (
    <>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Board" component={BoardScreen} />
        <Stack.Screen name="Covenants" component={CovenantsScreen} />
        <Stack.Screen name="Community" component={CommunityScreen} />
        <Stack.Screen name="Documents" component={DocumentsScreen} />
        <Stack.Screen name="Fees" component={FeesScreen} />
        {(isBoardMember || isDev) && (
          <Stack.Screen 
            name="Admin" 
            component={AdminScreen}
          />
        )}
      </Stack.Navigator>
      <MessagingOverlay
        visible={showOverlay}
        onClose={() => setShowOverlay(false)}
      />
      <MinimizedMessageBubble
        onPress={() => setShowOverlay(true)}
      />
    </>
  );
};

// Environment variable validation component - updated to show debug info
const EnvironmentErrorScreen = ({ debugInfo }: { debugInfo?: any }) => (
  <View style={styles.setupContainer}>
    <ScrollView contentContainerStyle={styles.scrollContent}>
    <Text style={styles.setupTitle}>Configuration Error</Text>
    <Text style={styles.setupText}>
      The app is missing required configuration. Please ensure EXPO_PUBLIC_CONVEX_URL is set.
    </Text>
      
      {/* Debug Information - shows what values were actually read */}
      {debugInfo && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugTitle}>🔍 Debug Information:</Text>
          <Text style={styles.debugText}>
            Constants.expoConfig?.extra?.convexUrl:{'\n'}
            {String(debugInfo.constantsValue ?? 'undefined')}
          </Text>
          <Text style={styles.debugText}>
            process.env.EXPO_PUBLIC_CONVEX_URL:{'\n'}
            {String(debugInfo.processEnvValue ?? 'undefined')}
          </Text>
          <Text style={styles.debugText}>
            Raw Value:{'\n'}
            {String(debugInfo.rawValue ?? 'undefined')}
          </Text>
          <Text style={styles.debugText}>
            Final Value: {debugInfo.finalValue ? '✅ SET' : '❌ NOT SET'}
          </Text>
        </View>
      )}
      
      <Text style={styles.setupText}>
        For local development, create a .env.local file with:
      </Text>
      <Text style={styles.setupCode}>
        EXPO_PUBLIC_CONVEX_URL=your-convex-url-here
      </Text>
    <Text style={styles.setupText}>
        For EAS builds, set this as an EAS secret:
    </Text>
    <Text style={styles.setupCode}>
      eas secret:create --scope project --name EXPO_PUBLIC_CONVEX_URL --value {'<your-convex-url>'}
    </Text>
    </ScrollView>
  </View>
);

export default function App() {
  // Get Convex URL from Constants.expoConfig.extra (populated from app.json during build)
  // Fallback to process.env for web/development compatibility
  const constantsValue = Constants.expoConfig?.extra?.convexUrl;
  const processEnvValue = process.env.EXPO_PUBLIC_CONVEX_URL;
  
  // Check if constantsValue is a placeholder (not substituted)
  const isPlaceholder = constantsValue &&
    typeof constantsValue === 'string' &&
    (constantsValue.includes('${EXPO_PUBLIC_CONVEX_URL}') || constantsValue.startsWith('${'));

  // Use process.env if constantsValue is a placeholder or empty, otherwise use constantsValue
  let rawConvexUrl = (isPlaceholder || !constantsValue) ? processEnvValue : constantsValue;

  // Normalize the URL - filter out placeholder strings or empty values
  const convexUrl = rawConvexUrl &&
    typeof rawConvexUrl === 'string' &&
    rawConvexUrl.trim() !== '' &&
    !rawConvexUrl.includes('${EXPO_PUBLIC_CONVEX_URL}') &&
    !rawConvexUrl.startsWith('${')
    ? rawConvexUrl.trim()
    : undefined;
  
  // Store debug info for display on error screen
  const debugInfo = {
    constantsValue: constantsValue,
    processEnvValue: processEnvValue,
    rawValue: rawConvexUrl,
    finalValue: convexUrl,
  };
  
  const [notificationInitAttempted, setNotificationInitAttempted] = useState(false);
  // Only show splash screen on iOS and Android, not on web
  const [showSplash, setShowSplash] = useState(Platform.OS !== 'web');
  
  // Persistent navigation state
  const [isReady, setIsReady] = React.useState(false);
  const [initialState, setInitialState] = React.useState<any>();

  // Validate environment variables
  const hasRequiredEnvVars = !!convexUrl;

  const convex = useMemo(() => {
    if (!convexUrl) return null;
    try {
      return new ConvexReactClient(convexUrl);
    } catch (error) {
      console.error('Failed to create Convex client:', error);
      return null;
    }
  }, [convexUrl]);

  // Initialize notifications when app starts (non-blocking)
  useEffect(() => {
    let isMounted = true;
    
    const initializeNotifications = async () => {
      // Don't block app startup - initialize in background
      setNotificationInitAttempted(true);
      
      try {
        // Add a small delay to not interfere with app startup
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (!isMounted) return;
        
        await enhancedUnifiedNotificationManager.initialize();
      } catch (error) {
        // Log but don't crash - notifications are not critical for app startup
        console.error('Failed to initialize notifications (non-critical):', error);
      }
    };

    // Initialize notifications asynchronously without blocking
    initializeNotifications().catch(err => {
      console.error('Notification initialization error:', err);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  React.useEffect(() => {
    const restoreState = async () => {
      try {
        if (Platform.OS === 'web') {
          const savedState = localStorage.getItem('navState');
          if (savedState !== null) {
            setInitialState(JSON.parse(savedState));
          }
        }
      } catch (e) {
        console.error('Error restoring navigation state:', e);
      } finally {
        setIsReady(true);
      }
    };

    restoreState();
  }, []);

  const onStateChange = (state: any) => {
    if (Platform.OS === 'web') {
      localStorage.setItem('navState', JSON.stringify(state));
    }
  };

  // Show animated splash screen first (only on iOS and Android)
  // This must be after all hooks are called
  if (showSplash && Platform.OS !== 'web') {
    return (
      <AnimatedSplashScreen
        videoSource={require('./assets/splash-icon.mp4')}
        onFinish={() => setShowSplash(false)}
      />
    );
  }

  // Show error screen if required environment variables are missing
  if (!hasRequiredEnvVars) {
    return (
      <SafeAreaProvider>
        <ErrorBoundary>
          <EnvironmentErrorScreen debugInfo={debugInfo} />
        </ErrorBoundary>
      </SafeAreaProvider>
    );
  }

  if (!isReady) {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  // Ensure ConvexProvider wraps AuthProvider (required for Convex hooks)
  const content = (
    <SafeAreaProvider>
      {convex ? (
        <ConvexProvider client={convex}>
          <AuthProvider>
            <MessagingProvider>
              <NavigationContainer initialState={initialState} onStateChange={onStateChange}>
                <MainAppContent />
                <StatusBar style="dark" />
              </NavigationContainer>
            </MessagingProvider>
          </AuthProvider>
        </ConvexProvider>
      ) : (
        <AuthProvider>
          <MessagingProvider>
            <NavigationContainer initialState={initialState} onStateChange={onStateChange}>
              <MainAppContent />
              <StatusBar style="dark" />
            </NavigationContainer>
          </MessagingProvider>
        </AuthProvider>
      )}
    </SafeAreaProvider>
  );

  return (
    <ErrorBoundary>
      {content}
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  setupContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  setupTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  setupText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  setupCode: {
    fontFamily: 'Courier',
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    fontSize: 18,
    color: '#333',
  },
  debugContainer: {
    width: '100%',
    backgroundColor: '#fef3c7',
    padding: 16,
    borderRadius: 8,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  debugTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#92400e',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    color: '#78350f',
    fontFamily: 'Courier',
    marginBottom: 8,
  },
});