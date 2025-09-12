import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { router } from 'expo-router';
import { authService, AuthResult } from './auth';
import { User } from './db';
import { supabase } from './supabase';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signInWithApple: () => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthState();
    // Subscribe to Supabase auth state changes
    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            const synced = await authService.upsertUserFromSupabase(session.user);
            setUser(synced);
          } else {
            const currentUser = await authService.getCurrentUser();
            setUser(currentUser);
          }
        }
        if (event === 'SIGNED_OUT') {
          setUser(null);
        }
      } catch (e) {
        console.log('Auth state change handler error:', e);
      }
    });

    return () => {
      subscription?.subscription?.unsubscribe();
    };
  }, []);

  // Debug: Track user state changes
  useEffect(() => {
    console.log('AuthContext user state changed:', user ? `User: ${user.name}` : 'No user');
  }, [user]);

  const checkAuthState = async () => {
    try {
      console.log('Checking auth state...');
      // Prefer Supabase session if present
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        const synced = await authService.upsertUserFromSupabase(data.session.user);
        console.log('Current user (supabase):', synced ? 'Found' : 'Not found');
        setUser(synced);
        return;
      }

      const currentUser = await authService.getCurrentUser();
      console.log('Current user (local):', currentUser ? 'Found' : 'Not found');
      
      // Only update user state if it's actually different
      if (currentUser?.id !== user?.id) {
        setUser(currentUser);
      }
    } catch (error) {
      console.error('Error checking auth state:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithApple = async (): Promise<AuthResult> => {
    try {
      console.log('Starting Apple Sign-In...');
      const result = await authService.signInWithApple();
      console.log('Apple Sign-In result:', result.success ? 'Success' : 'Failed', result.error || '');
      
      if (result.success && result.user) {
        console.log('Setting user in AuthContext:', result.user.name);
        setUser(result.user);
        
        // Force a small delay to ensure state is updated
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log('User state should be updated now');
        
        // Force navigation to main app
        console.log('Forcing navigation to main app...');
        router.replace('/(tabs)');
      }
      
      return result;
    } catch (error) {
      console.error('Apple Sign-In error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Apple Sign-In failed'
      };
    }
  };

  const signInWithGoogle = async (): Promise<AuthResult> => {
    try {
      console.log('Starting Google Sign-In...');
      const result = await authService.signInWithGoogle();
      console.log('Google Sign-In result:', result.success ? 'Success' : 'Failed', result.error || '');
      
      if (result.success && result.user) {
        console.log('Setting user in AuthContext:', result.user.name);
        setUser(result.user);
        
        // Force a small delay to ensure state is updated
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log('User state should be updated now');
        
        // Force navigation to main app
        console.log('Forcing navigation to main app...');
        router.replace('/(tabs)');
      }
      
      return result;
    } catch (error) {
      console.error('Google Sign-In error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Google Sign-In failed'
      };
    }
  };


  const signOut = async () => {
    try {
      await authService.signOut();
      setUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    signInWithApple,
    signInWithGoogle,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
