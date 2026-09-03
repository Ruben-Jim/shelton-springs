import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

/**
 * Android 13+ uses the system Photo Picker for launchImageLibraryAsync and does
 * not need READ_MEDIA_IMAGES / READ_MEDIA_VIDEO. Requesting those permissions
 * causes Google Play policy rejections for infrequent media access.
 *
 * iOS still needs the photo library permission prompt.
 */
export async function ensurePhotoLibraryAccess(
  deniedMessage = 'Please grant permission to access your photos.'
): Promise<boolean> {
  if (Platform.OS === 'android' || Platform.OS === 'web') {
    return true;
  }

  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission Required', deniedMessage);
    return false;
  }

  return true;
}
