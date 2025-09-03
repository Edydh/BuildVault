import * as AppleAuthentication from 'expo-apple-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createUser, getUserByProviderId, updateUserLastLogin, User } from './db';

// Google OAuth configuration (temporarily disabled)
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID'; // Replace with your actual Google Client ID

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
      console.error('Apple Sign-In error:', error);
      
      if (error.code === 'ERR_CANCELED') {
        return {
          success: false,
          error: 'Sign-in was canceled'
        };
      }

      return {
        success: false,
        error: error.message || 'Apple Sign-In failed'
      };
    }
  }

  async signInWithGoogle(): Promise<AuthResult> {
    // Temporarily disabled - will implement after fixing Apple Sign-In
    return {
      success: false,
      error: 'Google Sign-In is temporarily disabled. Please use Apple Sign-In for now.'
    };
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
      // This would typically load from database
      // For now, we'll return null and let the app handle it
      return null;
    } catch (error) {
      console.error('Error loading user from storage:', error);
      return null;
    }
  }
}

// Export singleton instance
export const authService = AuthService.getInstance();
