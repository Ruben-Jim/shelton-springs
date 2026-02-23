import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  Dimensions,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMessaging } from '../context/MessagingContext';

interface MinimizedMessageBubbleProps {
  onPress: () => void;
}

const MinimizedMessageBubble: React.FC<MinimizedMessageBubbleProps> = ({ onPress }) => {
  const { hasUnreadMessages, latestMessagePreview, conversations } = useMessaging();
  const insets = useSafeAreaInsets();
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const keyboardOffset = React.useRef(new Animated.Value(0)).current;
  const [keyboardVisible, setKeyboardVisible] = React.useState(false);
  const screenWidth = Dimensions.get('window').width;
  const isDesktop = screenWidth >= 1024;

  // Debug logging for iOS
  const handlePress = React.useCallback(() => {
    console.log('[MinimizedMessageBubble] Pressed, opening overlay');
    onPress();
  }, [onPress]);

  React.useEffect(() => {
    if (hasUnreadMessages) {
      // Pulse animation when new message arrives
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [hasUnreadMessages, latestMessagePreview]);

  // Handle keyboard show/hide for mobile positioning
  React.useEffect(() => {
    if (isDesktop || Platform.OS === 'web') return;

    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardVisible(true);
        // Use negative value to move up (translateY moves down with positive values)
        Animated.timing(keyboardOffset, {
          toValue: -e.endCoordinates.height,
          duration: Platform.OS === 'ios' ? (e.duration || 250) : 250,
          useNativeDriver: Platform.OS !== 'web',
        }).start();
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      (e) => {
        setKeyboardVisible(false);
        Animated.timing(keyboardOffset, {
          toValue: 0,
          duration: Platform.OS === 'ios' ? (e.duration || 250) : 250,
          useNativeDriver: Platform.OS !== 'web',
        }).start();
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, [keyboardOffset, isDesktop]);

  if (!hasUnreadMessages || conversations.length === 0) {
    return null;
  }

  const latestConv = conversations[0];
  const preview = latestMessagePreview || 'New message from Shelton Springs Board';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          bottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 16) + 60 : 80,
          left: 16,
          transform: [
            { scale: scaleAnim },
            { translateY: keyboardOffset },
          ],
          maxWidth: screenWidth < 400 ? screenWidth - 32 : 320,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.bubble}
        onPress={handlePress}
        activeOpacity={0.8}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        delayPressIn={0}
      >
        <View style={styles.iconContainer}>
          <Ionicons name="chatbubble-ellipses" size={24} color="#2563eb" />
        </View>
        <View style={styles.content}>
          <Text style={styles.fromText}>From: Shelton Springs Board</Text>
          <Text style={styles.previewText} numberOfLines={2}>
            {preview}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#6b7280" />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 9999,
    ...(Platform.OS === 'web' && {
      position: 'fixed' as any,
    }),
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 12,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer' as any,
      userSelect: 'none' as any,
    }),
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  fromText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  previewText: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
});

export default MinimizedMessageBubble;

