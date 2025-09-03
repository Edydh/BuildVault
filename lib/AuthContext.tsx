import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authService } from './auth';
import { User } from './db';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
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

  const signInWithApple = async () => {
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
      } else if (result.error === 'USER_CANCELED') {
        // User canceled - don't throw error, just return
        console.log('User canceled Apple Sign-In');
        return;
      } else {
        throw new Error(result.error || 'Apple Sign-In failed');
      }
    } catch (error) {
      console.error('Apple Sign-In error:', error);
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    try {
      const result = await authService.signInWithGoogle();
      if (result.success && result.user) {
        setUser(result.user);
      } else {
        throw new Error(result.error || 'Google Sign-In failed');
      }
    } catch (error) {
      console.error('Google Sign-In error:', error);
      throw error;
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
