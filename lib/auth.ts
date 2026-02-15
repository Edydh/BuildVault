import * as AppleAuthentication from 'expo-apple-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import * as WebBrowser from 'expo-web-browser';
import { createUser, getUserByProviderId, updateUserLastLogin, getUserById, updateUserProfile, User } from './db';
import { ErrorHandler, withErrorHandling } from './errorHandler';
import * as Crypto from 'expo-crypto';

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
}

type SupabaseUserLike = {
  id: string;
  email?: string | null;
  user_metadata?: {
    full_name?: string | null;
    name?: string | null;
  } | null;
  app_metadata?: {
    provider?: string | null;
  } | null;
};

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
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
      
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!credential.user || !credential.identityToken) {
        return { success: false, error: 'Failed to get credentials from Apple' };
      }

      // For native Apple Sign-In, we'll create the user locally first, then try to sync with Supabase
      const email = credential.email || `${credential.user}@privaterelay.appleid.com`;
      const fullNameParts = [];
      if (credential.fullName?.givenName) fullNameParts.push(credential.fullName.givenName);
      if (credential.fullName?.familyName) fullNameParts.push(credential.fullName.familyName);
      const name = fullNameParts.length > 0 ? fullNameParts.join(' ') : 'Apple User';

      // Create or update local user
      let user = getUserByProviderId(credential.user, 'apple');
      if (!user) {
        user = createUser({
          email,
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

      // Try to sync with Supabase (optional - app works without this)
      try {
        console.log('Attempting to sync Apple user with Supabase');
        console.log('Using raw nonce for Supabase:', rawNonce);
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
          nonce: rawNonce, // Use raw nonce for Supabase, hashed nonce was for Apple
        });

        if (error) {
          console.log('Supabase sync failed (non-fatal):', error.message);
          // App continues to work with local user
        } else if (data.session?.user) {
          console.log('Successfully synced with Supabase');
          // Update local user with Supabase data if needed
          await this.upsertUserFromSupabase(data.session.user);
        }
      } catch (syncError) {
        console.log('Supabase sync error (non-fatal):', syncError);
        // App continues to work with local user
      }

      return { success: true, user };
    } catch (error: unknown) {
      const errorCode =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code)
          : '';
      const errorMessage = error instanceof Error ? error.message : String(error ?? '');
      // Handle user cancellation gracefully (not an error)
      if (errorCode === 'ERR_CANCELED' || errorMessage.includes('canceled')) {
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
      // For native apps, we need to use a different approach
      // Use the native Google Sign-In flow instead of OAuth web flow
      const redirectTo = 'buildvault://auth/callback';
      
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

      console.log('Opening OAuth URL:', data.url);
      console.log('Expected redirect to:', redirectTo);

      // Open the OAuth URL in an auth session
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo
      );

      console.log('OAuth result type:', result.type);
      if ('url' in result && result.url) {
        console.log('OAuth result URL:', result.url);
      }

      if (result.type === 'success' && 'url' in result && result.url) {
        // Parse the redirect URL to extract tokens
        const url = new URL(result.url);
        console.log('Parsing redirect URL:', url.toString());
        
        // Check for hash fragment (access_token, refresh_token)
        if (url.hash) {
          const hashParams = new URLSearchParams(url.hash.substring(1));
          const access_token = hashParams.get('access_token');
          const refresh_token = hashParams.get('refresh_token');

          console.log('Found tokens:', { access_token: !!access_token, refresh_token: !!refresh_token });

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
              this.currentUser = user;
              await this.storeUserSession(user);
              return { success: true, user };
            }
          }
        }
        
        // Check for query parameters (code-based flow)
        const code = url.searchParams.get('code');
        if (code) {
          console.log('Found authorization code, exchanging for session');
          const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
          
          if (sessionError) {
            console.error('Failed to exchange code for session:', sessionError);
            return { success: false, error: sessionError.message };
          }

          if (sessionData.session?.user) {
            const user = await this.upsertUserFromSupabase(sessionData.session.user);
            this.currentUser = user;
            await this.storeUserSession(user);
            return { success: true, user };
          }
        }
      } else if (result.type === 'cancel') {
        return { success: false, error: 'USER_CANCELED' };
      }

      return { success: false, error: 'Authentication failed' };
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e ?? '');
      console.error('Google sign-in error:', e);
      return { success: false, error: errorMessage || 'Google Sign-In failed' };
    }
  }

  async upsertUserFromSupabase(supabaseUser: SupabaseUserLike): Promise<User> {
    // Sync Supabase user into local DB so the rest of the app can work unchanged
    console.log('Upserting user from Supabase:', {
      id: supabaseUser.id,
      email: supabaseUser.email,
      metadata: supabaseUser.user_metadata,
      provider: supabaseUser.app_metadata?.provider
    });
    
    const email = supabaseUser.email || `${supabaseUser.id}@user.local`;
    const name = supabaseUser.user_metadata?.full_name || 
                 supabaseUser.user_metadata?.name || 
                 supabaseUser.email?.split('@')[0] || 
                 'User';
    const providerId = supabaseUser.id;
    const provider = supabaseUser.app_metadata?.provider === 'apple' ? 'apple' : 'google';
    
    console.log('Creating/updating local user:', { email, name, provider, providerId });
    
    let user = getUserByProviderId(providerId, provider);
    if (!user) {
      user = createUser({ email, name, provider, providerId, avatar: null });
      console.log('Created new local user:', user.name);
    } else {
      updateUserLastLogin(user.id);
      console.log('Updated existing local user:', user.name);
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

  async updateDisplayName(name: string): Promise<User> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Display name cannot be empty');
    }

    let activeUser = this.currentUser;
    if (!activeUser) {
      activeUser = await this.getCurrentUser();
    }
    if (!activeUser) {
      throw new Error('No authenticated user found');
    }

    const updated = updateUserProfile(activeUser.id, { name: trimmedName });
    if (!updated) {
      throw new Error('Unable to update user profile');
    }

    this.currentUser = updated;
    await this.storeUserSession(updated);

    // Attempt to sync profile metadata upstream when available.
    try {
      await supabase.auth.updateUser({
        data: {
          full_name: trimmedName,
          name: trimmedName,
        },
      });
    } catch (error) {
      console.log('Supabase profile metadata sync failed (non-fatal):', error);
    }

    return updated;
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
