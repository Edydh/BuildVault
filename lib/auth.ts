import * as AppleAuthentication from 'expo-apple-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform, Alert } from 'react-native';
import { supabase } from './supabase';
import { createUser, getUserByProviderId, updateUserLastLogin, getUserById, User } from './db';
import { ErrorHandler, withErrorHandling } from './errorHandler';

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

    return withErrorHandling(async () => {
      // Try to get user from local storage
      const userId = await SecureStore.getItemAsync('currentUserId');
      if (userId) {
        const user = await this.loadUserFromStorage(userId);
        if (user) {
          this.currentUser = user;
          return user;
        }
      }
      return null;
    }, 'Get current user', false);
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

      if (!credential.user) {
        return {
          success: false,
          error: 'Failed to get user ID from Apple'
        };
      }

      // For Expo Go or local: Use local authentication but also try Supabase exchange when possible
      // Extract user information
      const email = credential.email || 'no-email@privaterelay.appleid.com';
      const name = credential.fullName 
        ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim()
        : 'Apple User';

      // Attempt to establish Supabase session using Apple identity token if available
      try {
        if (credential.identityToken) {
          await supabase.auth.signInWithIdToken({
            provider: 'apple',
            token: credential.identityToken,
          });
        }
      } catch (e) {
        console.log('Supabase Apple sign-in exchange failed (non-fatal):', e);
      }

      // Check if user already exists in our local database
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
          error: 'USER_CANCELED'
        };
      }

      // Log actual errors with error handling
      const appError = ErrorHandler.handle(error, 'Apple Sign-In');
      console.error('Apple Sign-In error:', appError);
      
      return {
        success: false,
        error: appError.userMessage || 'Apple Sign-In failed'
      };
    }
  }


  async signOut(): Promise<void> {
    try {
      // Sign out from Supabase (if connected)
      try {
        await supabase.auth.signOut();
      } catch (error) {
        // Ignore Supabase errors in development
        console.log('Supabase signout error (ignored):', error);
      }
      
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