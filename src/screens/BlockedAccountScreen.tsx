import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDemoQuery } from '../hooks/useDemoQuery';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../context/AuthContext';

const BlockedAccountScreen = () => {
  const { signOut, user } = useAuth();
  const hoaInfo =
    useDemoQuery(api.hoaInfo.get, {}, (s) => s.hoaInfo) ?? {
    name: 'HOA Community',
    phone: '(555) 012-3456',
    email: 'hoa@community.com',
    website: 'https://community-hoa.com',
    officeHours: 'Monday - Friday: 9:00 AM - 5:00 PM',
    emergencyContact: '(555) 911-HOA',
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    }
  };

  const handleCallHOA = () => {
    const phoneNumber = hoaInfo.phone.replace(/[^\d]/g, '');
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const handleEmailHOA = () => {
    Linking.openURL(`mailto:${hoaInfo.email}`);
  };

  const handleVisitWebsite = () => {
    if (hoaInfo.website) {
      Linking.openURL(hoaInfo.website);
    }
  };

  const handleCallEmergency = () => {
    const emergencyNumber = hoaInfo.emergencyContact.replace(/[^\d]/g, '');
    Linking.openURL(`tel:${emergencyNumber}`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={true}
        bounces={true}
        scrollEnabled={true}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="warning" size={64} color="#ef4444" />
          </View>
          <Text style={styles.title}>Account Blocked</Text>
          <Text style={styles.subtitle}>
            Your account has been temporarily suspended
          </Text>
        </View>

        {/* Block Reason */}
        {user?.blockReason && (
          <View style={styles.reasonContainer}>
            <Text style={styles.reasonTitle}>Reason for Block:</Text>
            <Text style={styles.reasonText}>{user.blockReason}</Text>
          </View>
        )}

        {/* Information Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>What does this mean?</Text>
          <Text style={styles.infoText}>
            Your access to the HOA Community App has been temporarily restricted. 
            This may be due to policy violations, outstanding fees, or other 
            community-related issues.
          </Text>
        </View>

        {/* Contact Information */}
        <View style={styles.contactCard}>
          <Text style={styles.contactTitle}>Contact HOA Office</Text>
          <Text style={styles.contactSubtitle}>
            Please contact our office to resolve this issue
          </Text>

          {/* Contact Methods */}
          <View style={styles.contactMethods}>
            <TouchableOpacity style={styles.contactButton} onPress={handleCallHOA}>
              <Ionicons name="call" size={24} color="#2563eb" />
              <Text style={styles.contactButtonText}>Call Office</Text>
              <Text style={styles.contactButtonSubtext}>{hoaInfo.phone}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.contactButton} onPress={handleEmailHOA}>
              <Ionicons name="mail" size={24} color="#2563eb" />
              <Text style={styles.contactButtonText}>Send Email</Text>
              <Text style={styles.contactButtonSubtext}>{hoaInfo.email}</Text>
            </TouchableOpacity>

            {hoaInfo.website && (
              <TouchableOpacity style={styles.contactButton} onPress={handleVisitWebsite}>
                <Ionicons name="globe" size={24} color="#2563eb" />
                <Text style={styles.contactButtonText}>Visit Website</Text>
                <Text style={styles.contactButtonSubtext}>{hoaInfo.website}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Office Hours */}
        <View style={styles.hoursCard}>
          <Text style={styles.hoursTitle}>Office Hours</Text>
          <Text style={styles.hoursText}>{hoaInfo.officeHours}</Text>
        </View>

        {/* Emergency Contact */}
        <View style={styles.emergencyCard}>
          <Text style={styles.emergencyTitle}>Emergency Contact</Text>
          <Text style={styles.emergencyText}>
            For urgent matters outside office hours, call our emergency line:
          </Text>
          <TouchableOpacity style={styles.emergencyButton} onPress={handleCallEmergency}>
            <Ionicons name="call" size={20} color="#ffffff" />
            <Text style={styles.emergencyButtonText}>{hoaInfo.emergencyContact}</Text>
          </TouchableOpacity>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Ionicons name="log-out" size={20} color="#6b7280" />
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  reasonContainer: {
    backgroundColor: '#fef2f2',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  reasonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
    marginBottom: 8,
  },
  reasonText: {
    fontSize: 14,
    color: '#7f1d1d',
    lineHeight: 20,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 22,
  },
  contactCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  contactSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
  },
  contactMethods: {
    gap: 12,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  contactButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 12,
    flex: 1,
  },
  contactButtonSubtext: {
    fontSize: 12,
    color: '#6b7280',
  },
  hoursCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  hoursTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  hoursList: {
    gap: 8,
  },
  hoursText: {
    fontSize: 14,
    color: '#6b7280',
  },
  emergencyCard: {
    backgroundColor: '#fef2f2',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  emergencyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#dc2626',
    marginBottom: 8,
  },
  emergencyText: {
    fontSize: 14,
    color: '#7f1d1d',
    marginBottom: 16,
    lineHeight: 20,
  },
  emergencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  emergencyButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  signOutButtonText: {
    fontSize: 16,
    color: '#6b7280',
    marginLeft: 8,
  },
});

export default BlockedAccountScreen;
