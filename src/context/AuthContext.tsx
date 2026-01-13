import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery, useMutation } from 'convex/react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../../convex/_generated/api';
import { User, AuthState } from '../types';

interface AuthContextType extends AuthState {
  signIn: (user: User) => Promise<void>;
  signUp: (userData: Omit<User, '_id' | 'createdAt' | 'updatedAt' | 'isActive'>) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  isUserBlocked: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Convex mutations - these require ConvexProvider to be available
  // We ensure ConvexProvider wraps AuthProvider in App.tsx
  // If ConvexProvider is missing, these hooks will throw errors that will be caught by ErrorBoundary
  const createResident = useMutation(api.residents.create);
  const updateResident = useMutation(api.residents.update);

  useEffect(() => {
    // Check for existing login session on app start
    loadUserFromStorage();
  }, []);

  const loadUserFromStorage = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        setAuthState({
          user,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        console.log('📱 No stored user found, showing login screen');
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    } catch (error) {
      console.log('❌ Error loading user from storage:', error);
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  };

  const signIn = async (user: User) => {
    try {
      // Save user to AsyncStorage for persistent login
      await AsyncStorage.setItem('user', JSON.stringify(user));
      console.log('✅ User logged in and saved to storage:', user.email);
      console.log('👤 User details:', { firstName: user.firstName, lastName: user.lastName, email: user.email });

      setAuthState({
        user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      throw error;
    }
  };

  const signUp = async (userData: Omit<User, '_id' | 'createdAt' | 'updatedAt' | 'isActive'>) => {
    try {
      console.log('👤 Creating resident with profile image:', userData.profileImage);
      
      let residentId: string;
      try {
        residentId = await createResident({
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email,
          password: userData.password,
          phone: userData.phone,
          address: userData.address,
          unitNumber: userData.unitNumber,
          isResident: userData.isResident,
          isBoardMember: userData.isBoardMember,
          isRenter: userData.isRenter,
          isDev: userData.isDev ?? false, // Default to false if not provided
          profileImage: userData.profileImage,
        });
        console.log('✅ Resident created with ID:', residentId);
      } catch (convexError) {
        console.error('Failed to create resident in Convex:', convexError);
        // Re-throw with a more user-friendly message
        throw new Error('Failed to create account. Please check your connection and try again.');
      }

      const newUser: User = {
        ...userData,
        _id: residentId,
        isActive: true,
        isBlocked: false,
        blockReason: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Save user to AsyncStorage for persistent login
      await AsyncStorage.setItem('user', JSON.stringify(newUser));
      console.log('✅ User signed up and saved to storage:', newUser.email);

      setAuthState({
        user: newUser,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const userId = authState.user?._id;
      
      // Clear all user-related data from AsyncStorage
      const keysToRemove = [
        'user',
        'notificationSettings',
        'webNotificationSettings',
        'latestNotificationSettings',
        'latestWebNotificationSettings',
        // User-specific keys
        ...(userId ? [`onboarding_seen_${userId}`] : []),
      ];
      
      // Remove all keys in parallel for better performance
      await Promise.all(keysToRemove.map(key => 
        AsyncStorage.removeItem(key).catch(err => 
          console.log(`Failed to remove ${key}:`, err)
        )
      ));
      
      console.log('👋 User logged out and all data removed from storage');
      
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    } catch (error) {
      console.log('❌ Error during logout:', error);
      // Still clear the auth state even if storage cleanup fails
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  };

  const updateUser = async (updates: Partial<User>) => {
    try {
      if (!authState.user) return;
      
      try {
        await updateResident({
          id: authState.user._id as any,
          ...updates,
        });
      } catch (convexError) {
        console.error('Failed to update resident in Convex:', convexError);
        // Still update local state even if Convex update fails
        // This allows offline functionality
        console.warn('Updating local state only - Convex update failed');
      }

      const updatedUser = { ...authState.user, ...updates, updatedAt: Date.now() };
      
      // Update user in AsyncStorage
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      
      setAuthState({
        ...authState,
        user: updatedUser,
      });
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  };

  const isUserBlocked = () => {
    return authState.user?.isBlocked || false;
  };

  const value: AuthContextType = {
    ...authState,
    signIn,
    signUp,
    signOut,
    updateUser,
    isUserBlocked,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
