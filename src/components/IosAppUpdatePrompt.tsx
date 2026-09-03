import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIosAppUpdate } from '../hooks/useIosAppUpdate';
import { usePostLoginPrompts } from '../context/PostLoginPromptsContext';

export default function IosAppUpdatePrompt() {
  const { visible, storeVersion, dismiss, openStore } = useIosAppUpdate();
  const { setPromptBlocked } = usePostLoginPrompts();

  React.useEffect(() => {
    setPromptBlocked('ios-app-update', visible);
    return () => setPromptBlocked('ios-app-update', false);
  }, [visible, setPromptBlocked]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.iconWrap}>
            <Ionicons name="arrow-up-circle" size={40} color="#2563eb" />
          </View>
          <Text style={styles.title}>Update Available</Text>
          <Text style={styles.message}>
            A new version of Shelton Springs
            {storeVersion ? ` (${storeVersion})` : ''} is available on the App Store.
            Update now for the latest features and improvements.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={openStore}>
            <Text style={styles.primaryButtonText}>Update Now</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={dismiss}>
            <Text style={styles.secondaryButtonText}>Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 18,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  secondaryButton: {
    width: '100%',
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
});
