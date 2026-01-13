import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as ImagePicker from 'expo-image-picker';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useConvex } from 'convex/react';
import { useAuth } from '../context/AuthContext';
import { User } from '../types';
import { AuthStackParamList } from '../navigation/AuthNavigator';
import { simpleAlert } from '../utils/webCompatibleAlert';
import CustomAlert from '../components/CustomAlert';
import { useCustomAlert } from '../hooks/useCustomAlert';
import { getUploadReadyImage } from '../utils/imageUpload';

type SignupScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Signup'>;

const SignupScreen = () => {
  const navigation = useNavigation<SignupScreenNavigationProp>();
  const { signUp } = useAuth();
  const convex = useConvex();
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    address: '',
    unitNumber: '',
    isResident: true,
    isBoardMember: false,
    isRenter: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { alertState, showAlert, hideAlert } = useCustomAlert();
  
  // ScrollView ref for better control
  const scrollViewRef = useRef<ScrollView>(null);

  // Format phone number: +1 (123) 456-7890
  const formatPhoneNumber = (text: string): string => {
    // Remove any non-numeric characters
    const numbers = text.replace(/\D/g, '');
    
    // Format as +1 (123) 456-7890
    if (numbers.length === 0) {
      return '';
    } else if (numbers.length <= 1) {
      return `+${numbers}`;
    } else if (numbers.length <= 4) {
      return `+1 (${numbers.slice(1)}`;
    } else if (numbers.length <= 7) {
      return `+1 (${numbers.slice(1, 4)}) ${numbers.slice(4)}`;
    } else {
      return `+1 (${numbers.slice(1, 4)}) ${numbers.slice(4, 7)}-${numbers.slice(7, 11)}`;
    }
  };

  // Set initial cursor and cleanup on unmount (web only)
  useEffect(() => {
    if (Platform.OS === 'web') {
      // Set initial cursor
      document.body.style.cursor = 'grab';
      
      // Ensure scroll view is properly initialized
      setTimeout(() => {
        if (scrollViewRef.current) {
          // Force a layout update
          scrollViewRef.current.scrollTo({ y: 0, animated: false });
          
          // Debug: Log scroll view properties
          console.log('SignupScreen ScrollView initialized for web');
        }
      }, 100);
      
      return () => {
        document.body.style.cursor = 'default';
      };
    }
  }, []);

  const pickImage = async () => {
    try {
      // Request permission
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Permission to access camera roll is required!');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images' as any,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const takePhoto = async () => {
    try {
      // Request permission
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Permission to access camera is required!');
        return;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const uploadImage = async (imageUri: string): Promise<string> => {
    try {
      const uploadUrl = await generateUploadUrl();

      const { blob, mimeType } = await getUploadReadyImage(imageUri);

      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': mimeType },
        body: blob,
      });
      
      const { storageId } = await uploadResponse.json();
      return storageId;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw new Error('Failed to upload image');
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password.trim()) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!formData.confirmPassword.trim()) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    }

    if (!formData.address.trim()) {
      newErrors.address = 'Address is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignUp = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      let profileImageUrl: string | undefined;
      
      // Upload profile image if selected
      if (profileImage) {
        profileImageUrl = await uploadImage(profileImage);
      }

      const userData: Omit<User, '_id' | 'createdAt' | 'updatedAt' | 'isActive'> = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        unitNumber: formData.unitNumber.trim() || undefined,
        isResident: formData.isResident,
        isBoardMember: formData.isBoardMember,
        isRenter: formData.isRenter,
        isBlocked: false,
        profileImage: profileImageUrl,
      };

      await signUp(userData);
      showAlert({
        title: 'Success',
        message: 'Account created successfully!',
        buttons: [{ text: 'OK', onPress: () => {} }],
        type: 'success'
      });
    } catch (error) {
      console.error('Signup error:', error);
      showAlert({
        title: 'Error',
        message: 'Failed to create account. Please try again.',
        buttons: [{ text: 'OK', onPress: () => {} }],
        type: 'error'
      });
    }
  };

  const updateFormData = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        ref={scrollViewRef}
        style={[styles.scrollView, Platform.OS === 'web' && styles.webScrollContainer]}
        contentContainerStyle={[styles.scrollContent, Platform.OS === 'web' && styles.webScrollContent]}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        bounces={true}
        scrollEnabled={true}
        alwaysBounceVertical={false}
        nestedScrollEnabled={true}
        removeClippedSubviews={false}
        scrollEventThrottle={16}
        decelerationRate="normal"
        directionalLockEnabled={true}
        canCancelContentTouches={true}
        // Web-specific enhancements
        {...(Platform.OS === 'web' && {
          onScrollBeginDrag: () => {
            if (Platform.OS === 'web') {
              document.body.style.cursor = 'grabbing';
              document.body.style.userSelect = 'none';
            }
          },
          onScrollEndDrag: () => {
            if (Platform.OS === 'web') {
              document.body.style.cursor = 'grab';
              document.body.style.userSelect = 'auto';
            }
          },
          onScroll: () => {
            // Ensure scrolling is working
          },
        })}
      >
          {/* Header */}
          <View style={styles.header}>
            <Ionicons name="home" size={Platform.OS === 'web' ? 40 : 36} color="#2563eb" />
            <Text style={styles.title}>Welcome to HOA Community</Text>
            <Text style={styles.subtitle}>Create your account to get started</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Profile Image */}
            <View style={styles.profileImageSection}>
              <Text style={[styles.label, styles.profileImageLabel]}>Profile Picture (Optional)</Text>
              <View style={styles.profileImageContainer}>
                {profileImage ? (
                  <View style={styles.profileImageWrapper}>
                    <Image source={{ uri: profileImage }} style={styles.profileImage} />
                    <TouchableOpacity 
                      style={styles.removeImageButton}
                      onPress={() => setProfileImage(null)}
                    >
                      <Ionicons name="close" size={16} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.profileImagePlaceholder}>
                    <Ionicons name="person" size={Platform.OS === 'web' ? 36 : 32} color="#9ca3af" />
                  </View>
                )}
              </View>
              <View style={styles.imagePickerButtons}>
                <TouchableOpacity style={styles.imagePickerButton} onPress={pickImage}>
                  <Ionicons name="image" size={20} color="#2563eb" />
                  <Text style={styles.imagePickerButtonText}>Choose Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.imagePickerButton} onPress={takePhoto}>
                  <Ionicons name="camera" size={20} color="#2563eb" />
                  <Text style={styles.imagePickerButtonText}>Take Photo</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Name Fields */}
            <View style={styles.row}>
              <View style={styles.halfWidth}>
                <Text style={styles.label}>First Name *</Text>
                <TextInput
                  style={[styles.input, errors.firstName ? styles.inputError : null]}
                  placeholder="Enter first name"
                  value={formData.firstName}
                  onChangeText={(text) => updateFormData('firstName', text)}
                  autoCapitalize="words"
                />
                {errors.firstName ? <Text style={styles.errorText}>{errors.firstName}</Text> : null}
              </View>
              
              <View style={styles.halfWidth}>
                <Text style={styles.label}>Last Name *</Text>
                <TextInput
                  style={[styles.input, errors.lastName ? styles.inputError : null]}
                  placeholder="Enter last name"
                  value={formData.lastName}
                  onChangeText={(text) => updateFormData('lastName', text)}
                  autoCapitalize="words"
                />
                {errors.lastName ? <Text style={styles.errorText}>{errors.lastName}</Text> : null}
              </View>
            </View>

            {/* Email */}
            <Text style={styles.label}>Email Address *</Text>
            <TextInput
              style={[styles.input, errors.email ? styles.inputError : null]}
              placeholder="Enter email address"
              value={formData.email}
              onChangeText={(text) => updateFormData('email', text)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

            {/* Password Fields */}
            <Text style={styles.label}>Password *</Text>
            <TextInput
              style={[styles.input, errors.password ? styles.inputError : null]}
              placeholder="Enter password (min 6 characters)"
              value={formData.password}
              onChangeText={(text) => updateFormData('password', text)}
              secureTextEntry={true}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

            <Text style={styles.label}>Confirm Password *</Text>
            <TextInput
              style={[styles.input, errors.confirmPassword ? styles.inputError : null]}
              placeholder="Confirm your password"
              value={formData.confirmPassword}
              onChangeText={(text) => updateFormData('confirmPassword', text)}
              secureTextEntry={true}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}

            {/* Phone */}
            <Text style={styles.label}>Phone Number *</Text>
            <TextInput
              style={[styles.input, errors.phone ? styles.inputError : null]}
              placeholder="Enter phone number"
              value={formData.phone}
              onChangeText={(text) => {
                const formatted = formatPhoneNumber(text);
                updateFormData('phone', formatted);
              }}
              keyboardType="phone-pad"
              maxLength={17}
            />
            {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}

            {/* Address */}
            <Text style={styles.label}>Address *</Text>
            <TextInput
              style={[styles.input, errors.address ? styles.inputError : null]}
              placeholder="Enter your address"
              value={formData.address}
              onChangeText={(text) => updateFormData('address', text)}
              autoCapitalize="words"
            />
            {errors.address ? <Text style={styles.errorText}>{errors.address}</Text> : null}

            {/* Unit Number */}
            <Text style={styles.label}>Unit Number (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter unit number if applicable"
              value={formData.unitNumber}
              onChangeText={(text) => updateFormData('unitNumber', text)}
              autoCapitalize="characters"
            />

            {/* Role Selection */}
            <Text style={styles.label}>Role</Text>
            <View style={styles.roleContainer}>
              <TouchableOpacity
                style={[
                  styles.roleButton,
                  formData.isResident && !formData.isRenter && styles.roleButtonActive
                ]}
                onPress={() => {
                  updateFormData('isResident', true);
                  updateFormData('isRenter', false);
                }}
              >
                <Ionicons 
                  name="home" 
                  size={Platform.OS === 'web' ? 20 : 18} 
                  color={formData.isResident && !formData.isRenter ? '#ffffff' : '#6b7280'} 
                />
                <Text 
                  style={[
                    styles.roleButtonText,
                    formData.isResident && !formData.isRenter && styles.roleButtonTextActive
                  ]}
                >
                  Homeowner
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleButton,
                  formData.isRenter && styles.roleButtonActive
                ]}
                onPress={() => {
                  updateFormData('isRenter', true);
                  updateFormData('isResident', false);
                }}
              >
                <Ionicons 
                  name="key" 
                  size={Platform.OS === 'web' ? 20 : 18} 
                  color={formData.isRenter ? '#ffffff' : '#6b7280'} 
                />
                <Text 
                  style={[
                    styles.roleButtonText,
                    formData.isRenter && styles.roleButtonTextActive
                  ]}
                >
                  Renter
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleButton,
                  formData.isBoardMember && styles.roleButtonActive
                ]}
                onPress={() => updateFormData('isBoardMember', !formData.isBoardMember)}
              >
                <Ionicons 
                  name="people" 
                  size={Platform.OS === 'web' ? 20 : 18} 
                  color={formData.isBoardMember ? '#ffffff' : '#6b7280'} 
                />
                <Text 
                  style={[
                    styles.roleButtonText,
                    formData.isBoardMember && styles.roleButtonTextActive
                  ]}
                >
                  Board Member
                </Text>
              </TouchableOpacity>
            </View>
            
            {/* Sign Up Button */}
            {/* <TouchableOpacity style={styles.signUpButton} onPress={() => navigation.navigate('Signup')}>
              <Text style={styles.signUpButtonText}>Signup</Text>
            </TouchableOpacity> */}

            {/* Sign Up Button */}
            <TouchableOpacity style={styles.signUpButton} onPress={handleSignUp}>
              <Text style={styles.signUpButtonText}>Create Account</Text>
            </TouchableOpacity>


            {/* Login Link */}
            <View style={styles.loginLink}>
              <Text style={styles.loginLinkText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.loginLinkButton}>Sign In</Text>
              </TouchableOpacity>
            </View>

            {/* Terms */}
            <Text style={styles.termsText}>
              By creating an account, you agree to our Terms of Service and Privacy Policy
            </Text>
          </View>
          
          {/* Additional content to ensure scrollable content */}
          <View style={styles.spacer} />
      </ScrollView>
      
      {/* Custom Alert */}
      <CustomAlert
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        buttons={alertState.buttons}
        onClose={hideAlert}
        type={alertState.type}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  scrollView: {
    flex: 1,
  },
  webScrollContainer: {
    ...(Platform.OS === 'web' && {
      cursor: 'grab' as any,
      userSelect: 'none' as any,
      WebkitUserSelect: 'none' as any,
      MozUserSelect: 'none' as any,
      msUserSelect: 'none' as any,
      overflow: 'auto' as any,
      height: '100vh' as any,
      maxHeight: '100vh' as any,
      position: 'relative' as any,
    }),
  },
  scrollContent: {
    paddingBottom: 30,
  },
  webScrollContent: {
    ...(Platform.OS === 'web' && {
      minHeight: '100vh' as any,
      flexGrow: 1,
      paddingBottom: 100 as any,
    }),
  },
  spacer: {
    height: Platform.OS === 'web' ? 120 : 80,
  },
  header: {
    alignItems: 'center',
    paddingVertical: Platform.OS === 'web' ? 24 : 20,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: Platform.OS === 'web' ? 28 : 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: Platform.OS === 'web' ? 12 : 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Platform.OS === 'web' ? 16 : 14,
    color: '#6b7280',
    marginTop: Platform.OS === 'web' ? 6 : 4,
    textAlign: 'center',
  },
  form: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    width: '48%',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 20,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#ffffff',
    color: '#374151',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    marginTop: 4,
    marginLeft: 4,
  },
  roleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    flexWrap: 'wrap',
    gap: 8,
  },
  roleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Platform.OS === 'web' ? 16 : 14,
    paddingHorizontal: Platform.OS === 'web' ? 16 : 12,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: 'transparent',
    flex: 1,
    minWidth: Platform.OS === 'web' ? 120 : 100,
  },
  roleButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  roleButtonText: {
    fontSize: Platform.OS === 'web' ? 16 : 14,
    fontWeight: '600',
    color: '#6b7280',
    marginLeft: Platform.OS === 'web' ? 4 : 3,
    textAlign: 'center',
  },
  roleButtonTextActive: {
    color: '#ffffff',
  },
  signUpButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 32,
    alignItems: 'center',
  },
  signUpButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  termsText: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
  loginLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  loginLinkText: {
    fontSize: 14,
    color: '#6b7280',
  },
  loginLinkButton: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '600',
  },
  profileImageSection: {
    marginBottom: 16,
    alignItems: 'center',
  },
  profileImageLabel: {
    marginTop: Platform.OS === 'web' ? 20 : 12,
  },
  profileImageContainer: {
    marginBottom: 8,
  },
  profileImageWrapper: {
    position: 'relative',
  },
  profileImage: {
    width: Platform.OS === 'web' ? 90 : 80,
    height: Platform.OS === 'web' ? 90 : 80,
    borderRadius: Platform.OS === 'web' ? 45 : 40,
    borderWidth: 3,
    borderColor: '#e5e7eb',
  },
  profileImagePlaceholder: {
    width: Platform.OS === 'web' ? 90 : 80,
    height: Platform.OS === 'web' ? 90 : 80,
    borderRadius: Platform.OS === 'web' ? 45 : 40,
    backgroundColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeImageButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePickerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  imagePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  imagePickerButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2563eb',
  },
});

export default SignupScreen;
