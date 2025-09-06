import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { createUser, getUserByProviderId, updateUserLastLogin, getUserById, User } from './db';

// Google OAuth configuration
const getGoogleClientId = () => {
  const clientId = Constants.expoConfig?.extra?.googleClientId;
  if (Platform.OS === 'ios') return clientId?.ios;
  if (Platform.OS === 'android') return clientId?.android;
  return clientId?.web;
};

const GOOGLE_CLIENT_ID = getGoogleClientId();

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
}

export class AuthService {
  private static instance: AuthService;
  private currentUser: User | null = null;

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  async getCurrentUser(): Promise<User | null> {
    if (this.currentUser) {
      return this.currentUser;
    }

    try {
      const userId = await SecureStore.getItemAsync('currentUserId');
      if (userId) {
        // Load user from database
        const user = await this.loadUserFromStorage(userId);
        if (user) {
          this.currentUser = user;
          return user;
        }
      }
    } catch (error) {
      console.error('Error getting current user:', error);
    }

    return null;
  }

  async signInWithApple(): Promise<AuthResult> {
    try {
      // Check if Apple Sign-In is available
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        // For development/testing, create a mock user
        console.log('Apple Sign-In not available, creating mock user for development');
        const mockUser = createUser({
          email: 'dev@buildvault.app',
          name: 'Development User',
          provider: 'apple',
          providerId: 'dev-user-123',
          avatar: null,
        });
        
        await this.storeUserSession(mockUser);
        this.currentUser = mockUser;
        
        return {
          success: true,
          user: mockUser,
        };
      }

      // Request Apple Sign-In
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        return {
          success: false,
          error: 'Failed to get identity token from Apple'
        };
      }

      // Extract user information
      const email = credential.email || 'no-email@privaterelay.appleid.com';
      const name = credential.fullName 
        ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim()
        : 'Apple User';

      // Check if user already exists
      let user = getUserByProviderId(credential.user, 'apple');
      
      if (!user) {
        // Create new user
        user = createUser({
          email,
          name,
          provider: 'apple',
          providerId: credential.user,
          avatar: null,
        });
      } else {
        // Update last login
        updateUserLastLogin(user.id);
      }

      // Store user session
      await this.storeUserSession(user);
      this.currentUser = user;

      return {
        success: true,
        user,
      };

    } catch (error: any) {
      // Handle user cancellation gracefully (not an error)
      if (error.code === 'ERR_CANCELED' || error.message?.includes('canceled')) {
        console.log('Apple Sign-In was canceled by user');
        return {
          success: false,
          error: 'USER_CANCELED' // Special code for user cancellation
        };
      }

      // Log actual errors
      console.error('Apple Sign-In error:', error);
      
      return {
        success: false,
        error: error.message || 'Apple Sign-In failed'
      };
    }
  }

  async signInWithGoogle(): Promise<AuthResult> {
    try {
      if (!GOOGLE_CLIENT_ID) {
        return {
          success: false,
          error: 'Google Sign-In is not configured yet. Please set up Google OAuth credentials in app.json. For now, please use Apple Sign-In.'
        };
      }

      // Configure Google Sign-In
      GoogleSignin.configure({
        webClientId: GOOGLE_CLIENT_ID,
        offlineAccess: true,
        hostedDomain: '',
        forceCodeForRefreshToken: true,
      });

      // Check if device has Google Play Services (Android only)
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices();
      }

      // Sign in
      const userInfo = await GoogleSignin.signIn();

      if (!userInfo.data?.user?.email) {
        return {
          success: false,
          error: 'No email address returned from Google',
        };
      }

      const email = userInfo.data.user.email;
      const name = userInfo.data.user.name || userInfo.data.user.givenName || 'Google User';
      const providerId = userInfo.data.user.id;
      const avatar = userInfo.data.user.photo || null;

      // Check if user already exists
      let user = getUserByProviderId(providerId, 'google');
      if (!user) {
        // Create new user
        user = createUser({
          email,
          name,
          provider: 'google',
          providerId,
          avatar,
        });
      } else {
        // Update last login
        updateUserLastLogin(user.id);
      }

      // Store user session
      await this.storeUserSession(user);
      this.currentUser = user;

      return {
        success: true,
        user,
      };
    } catch (error: any) {
      console.error('Google Sign-In error:', error);
      
      // Handle user cancellation
      if (error.code === 'SIGN_IN_CANCELLED' || error.code === '12501') {
        return {
          success: false,
          error: 'USER_CANCELED',
        };
      }

      return {
        success: false,
        error: error.message || 'Google Sign-In failed',
      };
    }
  }

  async signOut(): Promise<void> {
    try {
      // Clear secure storage
      await SecureStore.deleteItemAsync('currentUserId');
      await SecureStore.deleteItemAsync('userSession');
      
      // Clear current user
      this.currentUser = null;
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }

  private async storeUserSession(user: User): Promise<void> {
    try {
      await SecureStore.setItemAsync('currentUserId', user.id);
      await SecureStore.setItemAsync('userSession', JSON.stringify({
        userId: user.id,
        timestamp: Date.now(),
      }));
    } catch (error) {
      console.error('Error storing user session:', error);
    }
  }

  private async loadUserFromStorage(userId: string): Promise<User | null> {
    try {
      // Load user from database using the getUserById function (synchronous)
      const user = getUserById(userId);
      return user;
    } catch (error) {
      console.error('Error loading user from storage:', error);
      return null;
    }
  }
}

// Export singleton instance
export const authService = AuthService.getInstance();
