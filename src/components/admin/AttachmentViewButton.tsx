import React from 'react';
import {
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStorageUrl } from '../../hooks/useStorageUrl';
import { openDocument } from '../../utils/openDocument';

interface AttachmentViewButtonProps {
  fileStorageId?: string;
  /** Legacy external link, used when there is no stored file */
  pdfUrl?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

/** "View" button that opens a stored (or legacy linked) attachment in the in-app viewer. */
const AttachmentViewButton = ({ fileStorageId, pdfUrl, style, textStyle }: AttachmentViewButtonProps) => {
  const resolvedUrl = useStorageUrl(fileStorageId || null);

  if (!fileStorageId && !pdfUrl) return null;

  const loading = !!fileStorageId && resolvedUrl === undefined;
  const url = fileStorageId ? resolvedUrl : pdfUrl;

  const open = () => {
    if (!url) {
      Alert.alert('Please wait', 'Loading document link…');
      return;
    }
    openDocument(url).catch(() =>
      Alert.alert('Error', 'Unable to open document. Please try again.')
    );
  };

  return (
    <TouchableOpacity style={style} onPress={open} disabled={loading}>
      {loading ? (
        <ActivityIndicator size="small" color="#2563eb" />
      ) : (
        <Ionicons name="eye" size={14} color="#2563eb" />
      )}
      <Text style={textStyle}>View</Text>
    </TouchableOpacity>
  );
};

export default AttachmentViewButton;
