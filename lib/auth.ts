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
        // Only use mock in Expo Go for development
        if (__DEV__ && Platform.OS === 'ios') {
          console.log('Apple Sign-In not available in Expo Go, creating mock user');
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
        return { success: false, error: 'Apple Sign-In is not available on this device' };
      }

      // Request Apple Sign-In with nonce for Supabase verification
      const rawNonce = Math.random().toString(36).slice(2);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: rawNonce,
      });

      if (!credential.user || !credential.identityToken) {
        return { success: false, error: 'Failed to get credentials from Apple' };
      }

      // Sign in with Supabase using the Apple identity token
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: rawNonce,
      });

      if (error) {
        console.error('Supabase Apple sign-in error:', error);
        return { success: false, error: error.message };
      }

      if (!data.session?.user) {
        return { success: false, error: 'Failed to create session' };
      }

      // Create/update local user from Supabase session
      const supabaseUser = data.session.user;
      const user = await this.upsertUserFromSupabase(supabaseUser);
      
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

  async signInWithGoogle(): Promise<AuthResult> {
    try {
      // Create redirect URI for native app
      const redirectTo = AuthSession.makeRedirectUri({
        scheme: 'buildvault',
        path: 'auth/callback',
      });
      
      console.log('Google OAuth redirect URI:', redirectTo);

      // Start OAuth flow with Supabase
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true, // We'll handle the redirect manually
        },
      });

      if (error) {
        console.error('Supabase Google OAuth error:', error);
        return { success: false, error: error.message };
      }

      if (!data?.url) {
        return { success: false, error: 'No OAuth URL returned' };
      }

      // Open the OAuth URL in an auth session
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo
      );

      if (result.type === 'success' && result.url) {
        // Extract the hash fragment from the redirect URL
        const url = new URL(result.url);
        const hashParams = new URLSearchParams(url.hash.substring(1));
        const access_token = hashParams.get('access_token');
        const refresh_token = hashParams.get('refresh_token');

        if (access_token && refresh_token) {
          // Set the session in Supabase
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });

          if (sessionError) {
            console.error('Failed to set session:', sessionError);
            return { success: false, error: sessionError.message };
          }

          if (sessionData.session?.user) {
            // Create/update local user from Supabase session
            const user = await this.upsertUserFromSupabase(sessionData.session.user);
            return { success: true, user };
          }
        }
      } else if (result.type === 'cancel') {
        return { success: false, error: 'USER_CANCELED' };
      }

      return { success: false, error: 'Authentication failed' };
    } catch (e: any) {
      console.error('Google sign-in error:', e);
      return { success: false, error: e.message || 'Google Sign-In failed' };
    }
  }

  async upsertUserFromSupabase(supabaseUser: any): Promise<User> {
    // Sync Supabase user into local DB so the rest of the app can work unchanged
    const email = supabaseUser.email || `${supabaseUser.id}@user.local`;
    const name = supabaseUser.user_metadata?.full_name || 
                 supabaseUser.user_metadata?.name || 
                 supabaseUser.email?.split('@')[0] || 
                 'User';
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