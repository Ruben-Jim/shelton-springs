import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, Linking, Image, Platform, Modal, ScrollView, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useConvex } from 'convex/react';
import { api } from '../../convex/_generated/api';
import QRCode from 'react-native-qrcode-svg';
import { Id } from '../../convex/_generated/dataModel';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notifyPendingVenmoPayment } from '../utils/notificationHelpers';
import * as ImagePicker from 'expo-image-picker';
import { getUploadReadyImage } from '../utils/imageUpload';

interface VenmoCheckoutProps {
  amount: number;
  feeType: string;
  userId: string;
  feeId?: Id<"fees">;
  fineId?: Id<"fines">;
  onSuccess: () => void;
  onError: (error: string) => void;
}

const VenmoCheckout: React.FC<VenmoCheckoutProps> = ({
  amount,
  feeType,
  userId,
  feeId,
  fineId,
  onSuccess,
  onError,
}) => {
  const convex = useConvex();
  const createVenmoPayment = useMutation(api.payments.createVenmoPayment);
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const residents = useQuery(api.residents.getAll) ?? [];
  const [venmoUsername, setVenmoUsername] = useState('');
  const [venmoTransactionId, setVenmoTransactionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showPaymentOverlay, setShowPaymentOverlay] = useState(false);
  const [showTransactionIdHelp, setShowTransactionIdHelp] = useState(false);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  const VENMO_USERNAME_KEY = '@venmo_username';

  // Load saved username on mount
  useEffect(() => {
    const loadSavedUsername = async () => {
      try {
        const savedUsername = await AsyncStorage.getItem(VENMO_USERNAME_KEY);
        if (savedUsername) {
          setVenmoUsername(savedUsername);
        }
      } catch (error) {
        console.error('Error loading saved Venmo username:', error);
      }
    };
    loadSavedUsername();
  }, []);

  // Save username to AsyncStorage when it changes
  useEffect(() => {
    const saveUsername = async () => {
      if (venmoUsername.trim()) {
        try {
          await AsyncStorage.setItem(VENMO_USERNAME_KEY, venmoUsername.trim());
        } catch (error) {
          console.error('Error saving Venmo username:', error);
        }
      }
    };
    saveUsername();
  }, [venmoUsername]);

  const hoaVenmoUsername = '@SheltonSprings-HOA';
  
  // Generate Venmo web URL for business profile
  const venmoWebLink = `https://venmo.com/${hoaVenmoUsername.replace('@', '')}`;
  
  // Generate QR code URL for Venmo payment to business profile
  const qrCodeValue = `https://venmo.com/${hoaVenmoUsername.replace('@', '')}`;

  const openVenmo = () => {
    // Show the payment overlay modal
    setShowPaymentOverlay(true);
  };

  const handleOpenVenmoLink = async () => {
    // Try deep link first (if available)
    const venmoDeepLink = `venmo://paycharge?txn=pay&recipients=SheltonSprings-HOA&amount=${amount}&note=${encodeURIComponent(feeType)}`;
    
    // Try to open deep link, fallback to web link
    try {
      const canOpen = await Linking.canOpenURL(venmoDeepLink);
      if (canOpen) {
        await Linking.openURL(venmoDeepLink);
        return;
      }
    } catch (error) {
      // Deep link not available, fall through to web link
    }
    
    // Fallback to web link
    Linking.openURL(venmoWebLink).catch(() => {
      Alert.alert('Error', 'Could not open Venmo. Please visit the profile manually or scan the QR code.');
      setShowQR(true);
    });
  };

  const handleCloseOverlay = () => {
    setShowPaymentOverlay(false);
  };

  const handlePickReceipt = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to upload receipt.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setReceiptImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking receipt image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleRemoveReceipt = () => {
    setReceiptImage(null);
  };

  const handleSubmit = async () => {
    if (!venmoUsername.trim()) {
      onError('Please enter your Venmo username');
      return;
    }

    if (!venmoTransactionId.trim()) {
      onError('Please enter your Venmo transaction ID');
      return;
    }

    setLoading(true);

    try {
      // Upload receipt image if provided
      let receiptImageId: string | undefined = undefined;
      if (receiptImage) {
        setUploadingReceipt(true);
        try {
          const uploadReadyImage = await getUploadReadyImage(receiptImage);
          const uploadUrl = await generateUploadUrl();
          const uploadResponse = await fetch(uploadUrl, {
            method: 'POST',
            headers: { 'Content-Type': uploadReadyImage.mimeType },
            body: uploadReadyImage.blob,
          });
          const { storageId } = await uploadResponse.json();
          receiptImageId = storageId;
        } catch (error) {
          console.error('Error uploading receipt:', error);
          // Don't fail the payment if receipt upload fails
          Alert.alert('Warning', 'Payment will be submitted, but receipt upload failed. You can still proceed.');
        } finally {
          setUploadingReceipt(false);
        }
      }

      // Create Venmo payment record
      await createVenmoPayment({
        userId,
        feeType,
        amount,
        venmoUsername: venmoUsername.trim(),
        venmoTransactionId: venmoTransactionId.trim(),
        receiptImage: receiptImageId,
        feeId,
        fineId,
      });

      // Send notification to board members about pending payment
      const resident = residents.find(r => r._id === userId);
      const homeownerName = resident ? `${resident.firstName} ${resident.lastName}` : 'Unknown Homeowner';

      await notifyPendingVenmoPayment(homeownerName, amount, feeType, convex);

      onSuccess();
    } catch (error: any) {
      console.error('Venmo payment submission error:', error);
      onError(error.message || 'Failed to submit payment information');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Compact Instructions Card at Top */}
      <View style={styles.afterPaymentCard}>
        <View style={styles.afterPaymentHeader}>
          <Ionicons name="checkmark-circle" size={18} color="#10b981" />
          <Text style={styles.afterPaymentTitle}>Next Steps</Text>
        </View>
        <View style={styles.stepsContainer}>
          <View style={styles.stepItem}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <Text style={styles.stepText}>Click "Open Venmo" button</Text>
          </View>
          <View style={styles.stepItem}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <Text style={styles.stepText}>Complete payment</Text>
          </View>
          <View style={styles.stepItem}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <Text style={styles.stepText}>Enter details below</Text>
          </View>
        </View>
      </View>

      {/* QR Code Option */}
      <TouchableOpacity
        style={styles.qrToggleButton}
        onPress={() => setShowQR(!showQR)}
      >
        <Ionicons name={showQR ? "qr-code-outline" : "qr-code"} size={20} color="#008CFF" />
        <Text style={styles.qrToggleText}>
          {showQR ? 'Hide' : 'Show'} QR Code
        </Text>
      </TouchableOpacity>

      {showQR && (
        <View style={styles.qrContainer}>
          <Text style={styles.qrLabel}>Scan with Venmo App</Text>
          <View style={styles.qrCodeContainer}>
            <QRCode
              value={qrCodeValue}
              size={200}
              color="#000000"
              backgroundColor="#ffffff"
            />
          </View>
        </View>
      )}

      {/* Open Venmo Button */}
      <TouchableOpacity
        style={styles.openVenmoButton}
        onPress={openVenmo}
      >
        <Ionicons name="logo-venmo" size={24} color="#ffffff" />
        <Text style={styles.openVenmoText}>Venmo</Text>
      </TouchableOpacity>

      <View style={styles.noteCard}>
        <Ionicons name="information-circle-outline" size={16} color="#2563eb" />
        <Text style={styles.noteText}>
          Click "Open Venmo" to pay directly through our business profile
        </Text>
      </View>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>After Payment</Text>
        <View style={styles.dividerLine} />
      </View>

      <TouchableOpacity
        style={[styles.submitButton, loading && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.submitButtonText}>Submit Payment Info</Text>
        )}
      </TouchableOpacity>

      {/* Payment Overlay Modal */}
      <Modal
        visible={showPaymentOverlay}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCloseOverlay}
        presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.overlayContainer}
        >
          <View style={styles.overlay}>
            <View style={styles.overlayContent}>
              {/* Header */}
              <View style={styles.overlayHeader}>
                <Text style={styles.overlayTitle}>Complete Venmo Payment</Text>
                <TouchableOpacity onPress={handleCloseOverlay} style={styles.overlayCloseButton}>
                  <Ionicons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>

              <ScrollView 
                style={styles.overlayScrollView}
                contentContainerStyle={styles.overlayScrollContent}
                showsVerticalScrollIndicator={true}
              >
                {/* Instructions */}
                <View style={styles.overlayInstructionsCard}>
                  <View style={styles.overlayInstructionsHeader}>
                    <Ionicons name="information-circle" size={20} color="#2563eb" />
                    <Text style={styles.overlayInstructionsTitle}>Payment Instructions</Text>
                  </View>
                  <View style={styles.overlayStepsContainer}>
                    <View style={styles.overlayStepItem}>
                      <View style={styles.overlayStepNumber}>
                        <Text style={styles.overlayStepNumberText}>1</Text>
                      </View>
                      <Text style={styles.overlayStepText}>Click "Open Venmo" below</Text>
                    </View>
                    <View style={styles.overlayStepItem}>
                      <View style={styles.overlayStepNumber}>
                        <Text style={styles.overlayStepNumberText}>2</Text>
                      </View>
                      <Text style={styles.overlayStepText}>Complete your payment</Text>
                    </View>
                    <View style={styles.overlayStepItem}>
                      <View style={styles.overlayStepNumber}>
                        <Text style={styles.overlayStepNumberText}>3</Text>
                      </View>
                      <Text style={styles.overlayStepText}>Enter your username and transaction ID</Text>
                    </View>
                  </View>
                </View>

                {/* Open Venmo Button */}
                <TouchableOpacity
                  style={styles.overlayOpenVenmoButton}
                  onPress={handleOpenVenmoLink}
                >
                  <Ionicons name="logo-venmo" size={24} color="#ffffff" />
                  <Text style={styles.overlayOpenVenmoText}>Open Venmo</Text>
                </TouchableOpacity>

                {/* QR Code Option */}
                <TouchableOpacity
                  style={styles.overlayQrToggleButton}
                  onPress={() => setShowQR(!showQR)}
                >
                  <Ionicons name={showQR ? "qr-code-outline" : "qr-code"} size={20} color="#008CFF" />
                  <Text style={styles.overlayQrToggleText}>
                    {showQR ? 'Hide' : 'Show'} QR Code
                  </Text>
                </TouchableOpacity>

                {showQR && (
                  <View style={styles.overlayQrContainer}>
                    <Text style={styles.overlayQrLabel}>Scan with Venmo App</Text>
                    <View style={styles.overlayQrCodeContainer}>
                      <QRCode
                        value={qrCodeValue}
                        size={200}
                        color="#000000"
                        backgroundColor="#ffffff"
                      />
                    </View>
                  </View>
                )}

                {/* Username Input */}
                <View style={styles.overlayInputGroup}>
                  <Text style={styles.overlayLabel}>Your Venmo Username</Text>
                  <TextInput
                    style={styles.overlayInput}
                    placeholder="YourVenmoUsername"
                    value={venmoUsername}
                    onChangeText={setVenmoUsername}
                    autoCapitalize="none"
                    editable={!loading}
                  />
                  <Text style={styles.overlayHelperText}>
                    This will be saved for future payments
                  </Text>
                </View>

                {/* Transaction ID Input */}
                <View style={styles.overlayInputGroup}>
                  <View style={styles.overlayLabelRow}>
                    <Text style={styles.overlayLabel}>Venmo Transaction ID</Text>
                    <TouchableOpacity
                      onPress={() => setShowTransactionIdHelp(!showTransactionIdHelp)}
                      style={styles.helpButton}
                    >
                      <Ionicons 
                        name={showTransactionIdHelp ? "chevron-up" : "chevron-down"} 
                        size={16} 
                        color="#2563eb" 
                      />
                      <Text style={styles.helpButtonText}>
                        {showTransactionIdHelp ? 'Hide' : 'How to find'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  
                  {showTransactionIdHelp && (
                    <View style={styles.helpCard}>
                      <Text style={styles.helpTitle}>How to Find Your Transaction ID</Text>
                      <View style={styles.helpSteps}>
                        <View style={styles.helpStep}>
                          <View style={styles.helpStepNumber}>
                            <Text style={styles.helpStepNumberText}>1</Text>
                          </View>
                          <Text style={styles.helpStepText}>
                            Open the Venmo app on your phone
                          </Text>
                        </View>
                        <View style={styles.helpStep}>
                          <View style={styles.helpStepNumber}>
                            <Text style={styles.helpStepNumberText}>2</Text>
                          </View>
                          <Text style={styles.helpStepText}>
                            Go to your transaction history (tap "You" tab → "Transactions")
                          </Text>
                        </View>
                        <View style={styles.helpStep}>
                          <View style={styles.helpStepNumber}>
                            <Text style={styles.helpStepNumberText}>3</Text>
                          </View>
                          <Text style={styles.helpStepText}>
                            Find the payment you just made to @SheltonSprings-HOA
                          </Text>
                        </View>
                        <View style={styles.helpStep}>
                          <View style={styles.helpStepNumber}>
                            <Text style={styles.helpStepNumberText}>4</Text>
                          </View>
                          <Text style={styles.helpStepText}>
                            Tap on the transaction to open details
                          </Text>
                        </View>
                        <View style={styles.helpStep}>
                          <View style={styles.helpStepNumber}>
                            <Text style={styles.helpStepNumberText}>5</Text>
                          </View>
                          <Text style={styles.helpStepText}>
                            The transaction ID is shown at the bottom of the receipt, or in the URL if viewing on web
                          </Text>
                        </View>
                      </View>
                      <View style={styles.helpTip}>
                        <Ionicons name="bulb" size={16} color="#f59e0b" />
                        <Text style={styles.helpTipText}>
                          Tip: You can also take a screenshot of the receipt and upload it below (optional)
                        </Text>
                      </View>
                    </View>
                  )}
                  
                  <TextInput
                    style={styles.overlayInput}
                    placeholder="Copy from your Venmo receipt"
                    value={venmoTransactionId}
                    onChangeText={setVenmoTransactionId}
                    autoCapitalize="none"
                    editable={!loading}
                  />
                  <Text style={styles.overlayHelperText}>
                    After completing payment, paste the transaction ID from your Venmo receipt
                  </Text>
                </View>

                {/* Receipt Screenshot Upload (Optional) */}
                <View style={styles.overlayInputGroup}>
                  <Text style={styles.overlayLabel}>Receipt Screenshot (Optional)</Text>
                  <Text style={[styles.overlayHelperText, { marginBottom: 8 }]}>
                    Upload a screenshot of your Venmo receipt to help with faster verification
                  </Text>
                  
                  {receiptImage ? (
                    <View style={styles.receiptPreviewContainer}>
                      <Image source={{ uri: receiptImage }} style={styles.receiptPreview} />
                      <TouchableOpacity
                        style={styles.removeReceiptButton}
                        onPress={handleRemoveReceipt}
                        disabled={loading || uploadingReceipt}
                      >
                        <Ionicons name="close-circle" size={24} color="#ef4444" />
                        <Text style={styles.removeReceiptText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.uploadReceiptButton}
                      onPress={handlePickReceipt}
                      disabled={loading || uploadingReceipt}
                    >
                      {uploadingReceipt ? (
                        <ActivityIndicator color="#2563eb" />
                      ) : (
                        <>
                          <Ionicons name="image-outline" size={20} color="#2563eb" />
                          <Text style={styles.uploadReceiptText}>Upload Receipt Screenshot</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  style={[styles.overlaySubmitButton, loading && styles.overlaySubmitButtonDisabled]}
                  onPress={async () => {
                    if (!venmoUsername.trim()) {
                      onError('Please enter your Venmo username');
                      return;
                    }

                    if (!venmoTransactionId.trim()) {
                      onError('Please enter your Venmo transaction ID');
                      return;
                    }

                    try {
                      await handleSubmit();
                      // Close overlay on successful submission
                      handleCloseOverlay();
                    } catch (error) {
                      // Error is already handled by handleSubmit's onError callback
                      // Keep overlay open so user can fix the issue
                    }
                  }}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.overlaySubmitButtonText}>Submit Payment Info</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 20,
  },
  instructionsCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e40af',
    marginTop: 8,
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1f2937',
    backgroundColor: '#ffffff',
  },
  submitButton: {
    backgroundColor: '#008CFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  noteCard: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 8,
    lineHeight: 16,
  },
  venmoUsername: {
    fontWeight: 'bold',
    color: '#008CFF',
  },
  qrToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f9ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  qrToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#008CFF',
    marginLeft: 8,
  },
  qrContainer: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  qrLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  qrCodeContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
  },
  openVenmoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#008CFF',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    gap: 8,
  },
  openVenmoText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
    marginTop: 8,
  },
  helperText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 6,
  },
  afterPaymentCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  afterPaymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  afterPaymentTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#166534',
  },
  stepsContainer: {
    gap: 8,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepNumberText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  stepText: {
    fontSize: 13,
    color: '#166534',
    flex: 1,
    lineHeight: 18,
  },
  overlayContainer: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Platform.OS === 'ios' ? 20 : 20,
  },
  overlayContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: Platform.OS === 'ios' ? '95%' : '100%',
    maxWidth: 500,
    maxHeight: Platform.OS === 'ios' ? '90%' : '90%',
    height: Platform.OS === 'ios' ? '90%' : undefined,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  overlayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  overlayTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  overlayCloseButton: {
    padding: 4,
  },
  overlayScrollView: {
    flex: 1,
  },
  overlayScrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
  },
  overlayInstructionsCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  overlayInstructionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  overlayInstructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e40af',
  },
  overlayStepsContainer: {
    gap: 10,
  },
  overlayStepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  overlayStepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  overlayStepNumberText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  overlayStepText: {
    fontSize: 14,
    color: '#1e40af',
    flex: 1,
    lineHeight: 20,
  },
  overlayOpenVenmoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#008CFF',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    gap: 8,
  },
  overlayOpenVenmoText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  overlayQrToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f9ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  overlayQrToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#008CFF',
    marginLeft: 8,
  },
  overlayQrContainer: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  overlayQrLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  overlayQrCodeContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
  },
  overlayInputGroup: {
    marginBottom: 20,
  },
  overlayLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  overlayInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1f2937',
    backgroundColor: '#ffffff',
  },
  overlayHelperText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 6,
  },
  overlaySubmitButton: {
    backgroundColor: '#008CFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  overlaySubmitButtonDisabled: {
    backgroundColor: '#9ca3af',
    opacity: 0.6,
  },
  overlaySubmitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  overlayLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  helpButtonText: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '500',
  },
  helpCard: {
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 12,
  },
  helpSteps: {
    gap: 12,
  },
  helpStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  helpStepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  helpStepNumberText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  helpStepText: {
    flex: 1,
    fontSize: 13,
    color: '#1e40af',
    lineHeight: 18,
  },
  helpTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    padding: 10,
    backgroundColor: '#fef3c7',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  helpTipText: {
    flex: 1,
    fontSize: 12,
    color: '#92400e',
    lineHeight: 16,
  },
  receiptPreviewContainer: {
    position: 'relative',
    marginTop: 8,
  },
  receiptPreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  removeReceiptButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  removeReceiptText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '500',
  },
  uploadReceiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: '#2563eb',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 16,
    backgroundColor: '#eff6ff',
  },
  uploadReceiptText: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '500',
  },
});

export default VenmoCheckout;

