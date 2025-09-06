import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { router } from 'expo-router';
import { authService, AuthResult } from './auth';
import { User } from './db';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signInWithApple: () => Promise<AuthResult>;
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
  }, []);

  // Debug: Track user state changes
  useEffect(() => {
    console.log('AuthContext user state changed:', user ? `User: ${user.name}` : 'No user');
  }, [user]);

  const checkAuthState = async () => {
    try {
      console.log('Checking auth state...');
      const currentUser = await authService.getCurrentUser();
      console.log('Current user:', currentUser ? 'Found' : 'Not found');
      
      // Only set user if we don't already have one (prevent overriding fresh sign-in)
      if (!user || currentUser) {
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
