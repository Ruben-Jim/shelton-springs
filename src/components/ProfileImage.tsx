import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import OptimizedImage from './OptimizedImage';

interface ProfileImageProps {
  source: string | null | undefined;
  size?: number;
  style?: any;
  initials?: string;
}

const ProfileImage = ({ source, size = 40, style, initials }: ProfileImageProps) => {
  const radiusStyle = { width: size, height: size, borderRadius: size / 2 };
  const placeholder = (
    <View style={[styles.placeholder, radiusStyle, style]}>
      {initials ? (
        <Text style={[styles.initials, { fontSize: size * 0.35 }]}>{initials}</Text>
      ) : (
        <Ionicons name="person" size={size * 0.5} color="#6b7280" />
      )}
    </View>
  );

  if (!source) {
    return placeholder;
  }

  // Determine if source is a URL or a storage ID
  // URLs have protocols (http, https, file://, data:) or are local file paths
  const isUrl = source.startsWith('http') || 
                source.startsWith('https') || 
                source.startsWith('file://') || 
                source.startsWith('data:') ||
                (source.includes('/') && source.length > 20); // Local file path

  return (
    <OptimizedImage
      source={isUrl ? source : undefined}
      storageId={isUrl ? undefined : source}
      fallback={placeholder}
      containerStyle={[radiusStyle, style]}
      style={[styles.image, radiusStyle]}
      priority="high"
    />
  );
};

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  image: {
    overflow: 'hidden',
  },
  initials: {
    color: '#6b7280',
    fontWeight: '600',
  },
});

export default ProfileImage;
