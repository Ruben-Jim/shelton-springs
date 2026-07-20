import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import VenmoCheckout from './VenmoCheckout';
import { Id } from '../../convex/_generated/dataModel';

interface PaymentModalProps {
  visible: boolean;
  onClose: () => void;
  amount: number;
  feeType: string;
  userId: string;
  description?: string;
  feeId?: Id<"fees">;
  fineId?: Id<"fines">;
  onSuccess: () => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({
  visible,
  onClose,
  amount,
  feeType,
  userId,
  description,
  feeId,
  fineId,
  onSuccess,
}) => {
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const overlayAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(60)).current;

  React.useEffect(() => {
    if (visible) {
      overlayAnim.setValue(0);
      slideAnim.setValue(60);
      Animated.parallel([
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleSuccess = () => {
    setSuccess(true);
    setError(null);
    setTimeout(() => {
      onSuccess();
      onClose();
      setSuccess(false);
    }, 10000);
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    setSuccess(false);
  };

  const handleClose = () => {
    setError(null);
    setSuccess(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent={true}
      onRequestClose={handleClose}
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
    >
      <Animated.View style={[styles.overlay, { opacity: overlayAnim }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
        <Animated.View style={[styles.modalContainer, { transform: [{ translateY: slideAnim }] }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Complete Payment</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.content} 
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Payment Summary */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Payment Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryText}>{feeType}</Text>
                <Text style={styles.summaryAmount}>${amount.toFixed(2)}</Text>
              </View>
              {description && (
                <Text style={styles.summaryDescription}>{description}</Text>
              )}
            </View>

            {/* Success Message */}
            {success && (
              <View style={styles.successCard}>
                <Ionicons name="checkmark-circle" size={48} color="#10b981" />
                <Text style={styles.successText}>Payment Info Submitted!</Text>
                <Text style={styles.successSubtext}>
                  Your payment information has been received
                </Text>
                <Text style={styles.successSubtext}>
                  The HOA treasurer will review and verify your payment
                </Text>
                <Text style={styles.successSubtext}>
                  You will be notified once it's approved or rejected
                </Text>
              </View>
            )}

            {/* Error Message */}
            {error && (
              <View style={styles.errorCard}>
                <Ionicons name="alert-circle" size={24} color="#ef4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Venmo Checkout Form */}
            {!success && (
              <VenmoCheckout
                amount={amount}
                feeType={feeType}
                userId={userId}
                feeId={feeId}
                fineId={fineId}
                onSuccess={handleSuccess}
                onError={handleError}
              />
            )}
          </ScrollView>
        </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Platform.OS === 'ios' ? 20 : 20,
  },
  keyboardView: {
    width: '100%',
    maxWidth: 500,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: Platform.OS === 'ios' ? '95%' : '100%',
    maxWidth: 500,
    maxHeight: Platform.OS === 'ios' ? '85%' : '90%',
    height: Platform.OS === 'ios' ? '85%' : undefined,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  summaryCard: {
    margin: 20,
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryText: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
  summaryAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  summaryDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
  },
  successCard: {
    margin: 20,
    marginTop: 0,
    padding: 32,
    backgroundColor: '#d1fae5',
    borderRadius: 12,
    alignItems: 'center',
  },
  successText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#10b981',
    marginTop: 12,
  },
  successSubtext: {
    fontSize: 14,
    color: '#059669',
    marginTop: 4,
  },
  errorCard: {
    margin: 20,
    marginTop: 0,
    padding: 16,
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#ef4444',
    marginLeft: 12,
  },
  testCard: {
    margin: 20,
    marginTop: 0,
    padding: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  testCardTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 4,
  },
  testCardNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#78350f',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  testCardDetails: {
    fontSize: 12,
    color: '#92400e',
    marginTop: 2,
  },
});

export default PaymentModal;

