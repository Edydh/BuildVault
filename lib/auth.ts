import * as AppleAuthentication from 'expo-apple-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform, Alert } from 'react-native';
import { supabase } from './supabase';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
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
        return { success: true, user: mockUser };
      }

      // Request Apple Sign-In with nonce for later verification
      const rawNonce = Math.random().toString(36).slice(2);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: rawNonce,
      });

      if (!credential.user) {
        return { success: false, error: 'Failed to get user ID from Apple' };
      }

      // Attempt Supabase session using Apple identity token when available
      try {
        if (credential.identityToken) {
          const { error } = await supabase.auth.signInWithIdToken({
            provider: 'apple',
            token: credential.identityToken,
            nonce: rawNonce,
          });
          if (error) {
            console.log('Supabase Apple sign-in exchange error:', error.message);
          }
        } else {
          console.log('Apple identityToken not present; cannot create Supabase session.');
        }
      } catch (e) {
        console.log('Supabase Apple sign-in exchange failed (non-fatal):', e);
      }

      // Extract display info (Apple may not provide email on subsequent logins)
      const email = credential.email || undefined;
      const name = credential.fullName
        ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim()
        : 'Apple User';

      // Sync to local DB (keeps app working even if offline)
      let user = getUserByProviderId(credential.user, 'apple');
      if (!user) {
        user = createUser({
          email: email || 'apple-user@unknown',
          name,
          provider: 'apple',
          providerId: credential.user,
          avatar: null,
        });
      } else {
        updateUserLastLogin(user.id);
      }

      await this.storeUserSession(user);
      this.currentUser = user;
      return { success: true, user };
    } catch (error: any) {
      // Handle user cancellation gracefully (not an error)
      if (error.code === 'ERR_CANCELED' || error.message?.includes('canceled')) {
        console.log('Apple Sign-In was canceled by user');
        return { success: false, error: 'USER_CANCELED' };
      }
      const appError = ErrorHandler.handle(error, 'Apple Sign-In');
      console.error('Apple Sign-In error:', appError);
      return { success: false, error: appError.userMessage || 'Apple Sign-In failed' };
    }
  }

  async signInWithGoogle(): Promise<void> {
    try {
      // Use Supabase Auth with Google in-app browser flow
      const redirectTo = AuthSession.makeRedirectUri({ scheme: 'buildvault', path: 'auth/callback' });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      if (data?.url) {
        // Launch the auth session and wait for redirect back to our scheme
        await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      } else {
        console.log('Supabase returned no URL for Google OAuth start');
      }
    } catch (e) {
      console.log('Google sign-in error:', e);
      Alert.alert('Google Sign-In Failed', 'Please try again.');
    }
  }

  async upsertUserFromSupabase(supabaseUser: any): Promise<User> {
    // Sync Supabase user into local DB so the rest of the app can work unchanged
    const email = supabaseUser.email || 'no-email@user';
    const name = supabaseUser.user_metadata?.name || 'Authenticated User';
    const providerId = supabaseUser.id;
    const provider = supabaseUser.app_metadata?.provider || 'supabase';
    let user = getUserByProviderId(providerId, provider);
    if (!user) {
      user = createUser({ email, name, provider, providerId, avatar: null });
    } else {
      updateUserLastLogin(user.id);
    }
    this.currentUser = user;
    await this.storeUserSession(user);
    return user;
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
      await SecureStore.deleteItemAsync('currentUserId');
      await SecureStore.deleteItemAsync('userSession');
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