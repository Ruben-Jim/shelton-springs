import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { useConvex } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { AuthStackParamList } from '../navigation/AuthNavigator';
import CustomAlert from '../components/CustomAlert';
import { useCustomAlert } from '../hooks/useCustomAlert';

type ResetPasswordScreenRouteProp = RouteProp<
  AuthStackParamList,
  'ResetPassword'
>;

const ResetPasswordScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<ResetPasswordScreenRouteProp>();
  const convex = useConvex();
  const [token, setToken] = useState(route.params?.resetToken ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const { alertState, showAlert, hideAlert } = useCustomAlert();

  // Read token from URL on mount (web or deep link)
  useEffect(() => {
    if (token) return;

    const getTokenFromUrl = async () => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const resetToken = params.get('resetToken');
        if (resetToken) setToken(resetToken);
      } else {
        const url = await Linking.getInitialURL();
        if (url) {
          const parsed = Linking.parse(url);
          const resetToken =
            parsed.queryParams?.resetToken ??
            (parsed.queryParams as Record<string, string>)?.resetToken;
          if (typeof resetToken === 'string') setToken(resetToken);
        }
      }
    };

    getTokenFromUrl();
  }, [token]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!token) {
      newErrors.token = 'No reset token found. Please use the link from your email.';
    }

    if (!password || password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      await convex.mutation(api.passwordReset.resetPassword, {
        token,
        newPassword: password,
      });

      showAlert({
        title: 'Password Reset',
        message: 'Your password has been reset. You can now sign in.',
        buttons: [
          {
            text: 'OK',
            onPress: () => {
              hideAlert();
              // Clear reset token from URL on web for security/UX
              if (Platform.OS === 'web' && typeof window !== 'undefined') {
                const url = new URL(window.location.href);
                url.searchParams.delete('resetToken');
                window.history.replaceState({}, '', url.pathname + url.search);
              }
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            },
          },
        ],
        type: 'success',
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      showAlert({
        title: 'Error',
        message,
        buttons: [{ text: 'OK', onPress: () => {} }],
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Ionicons name="link" size={48} color="#9ca3af" />
          <Text style={styles.title}>Invalid or Missing Link</Text>
          <Text style={styles.subtitle}>
            Please use the link from your password reset email, or request a new one.
          </Text>
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate('ForgotPassword')}
          >
            <Text style={styles.linkButtonText}>Request New Link</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryLink}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.secondaryLinkText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#374151" />
            </TouchableOpacity>
            <Ionicons name="key" size={48} color="#2563eb" />
            <Text style={styles.title}>Set New Password</Text>
            <Text style={styles.subtitle}>
              Enter your new password below.
            </Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>New Password</Text>
            <TextInput
              style={[styles.input, errors.password ? styles.inputError : null]}
              placeholder="Enter new password (min 6 characters)"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errors.password) setErrors((p) => ({ ...p, password: '' }));
              }}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            {errors.password ? (
              <Text style={styles.errorText}>{errors.password}</Text>
            ) : null}

            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={[
                styles.input,
                errors.confirmPassword ? styles.inputError : null,
              ]}
              placeholder="Confirm new password"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (errors.confirmPassword)
                  setErrors((p) => ({ ...p, confirmPassword: '' }));
              }}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            {errors.confirmPassword ? (
              <Text style={styles.errorText}>{errors.confirmPassword}</Text>
            ) : null}

            <TouchableOpacity
              style={[
                styles.submitButton,
                isLoading && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              <Text style={styles.submitButtonText}>
                {isLoading ? 'Resetting...' : 'Reset Password'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

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
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    padding: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
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
    marginBottom: 20,
  },
  inputError: {
    borderColor: '#ef4444',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    marginTop: -16,
    marginBottom: 16,
    marginLeft: 4,
  },
  submitButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  linkButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  linkButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryLink: {
    alignItems: 'center',
    marginTop: 16,
  },
  secondaryLinkText: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '600',
  },
});

export default ResetPasswordScreen;
