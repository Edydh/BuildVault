import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { router } from 'expo-router';
import { authService, AuthResult } from './auth';
import { User } from './db';
import * as dbModule from './db';
import { supabase } from './supabase';
import { syncOrganizationDataFromSupabase } from './supabaseCollaboration';
import {
  deactivateStoredPushTokenForCurrentUser,
  registerPushTokenForCurrentUser,
  triggerProjectNotificationPushDispatch,
} from './pushNotifications';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signInWithApple: () => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  updateDisplayName: (name: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const signInInProgressRef = useRef(false);
  const signOutInProgressRef = useRef(false);

  const syncDbAuthState = (nextUser: User | null) => {
    const dbAccess = dbModule as {
      setActivityActor?: (actor: { userId: string; name?: string | null } | null) => void;
      setActiveUserScope?: (userId: string | null) => void;
    };

    const setActiveUserScope = dbAccess.setActiveUserScope;
    if (typeof setActiveUserScope === 'function') {
      setActiveUserScope(nextUser?.id ?? null);
    }

    const setActivityActor = dbAccess.setActivityActor;
    if (typeof setActivityActor === 'function') {
      setActivityActor(nextUser ? { userId: nextUser.id, name: nextUser.name } : null);
    }
  };

  const applyUser = (nextUser: User | null) => {
    syncDbAuthState(nextUser);
    setUser(nextUser);
  };

  const syncCollaborationState = async () => {
    try {
      await syncOrganizationDataFromSupabase();
    } catch (error) {
      console.log('Collaboration sync skipped:', error);
    }
  };

  useEffect(() => {
    checkAuthState();
    // Subscribe to Supabase auth state changes
    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        console.log('Supabase auth state change:', event, session?.user ? 'with user' : 'no user');
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            const synced = await authService.upsertUserFromSupabase(session.user);
            applyUser(synced);
            await syncCollaborationState();
          } else {
            // Don't immediately fetch local user, let the sign-in flow handle it
            console.log('Session without user, skipping local user fetch');
          }
        }
        if (event === 'SIGNED_OUT') {
          if (signOutInProgressRef.current) {
            await authService.clearLocalSession();
            applyUser(null);
            return;
          }

          // Some providers can transiently emit SIGNED_OUT during token handoff.
          // Confirm there's truly no active session before clearing app user state.
          const { data: latest } = await supabase.auth.getSession();
          if (latest.session?.user) {
            const synced = await authService.upsertUserFromSupabase(latest.session.user);
            applyUser(synced);
            await syncCollaborationState();
          } else if (signInInProgressRef.current) {
            // Ignore transient SIGNED_OUT while sign-in flow is still completing.
            console.log('Ignoring transient SIGNED_OUT during sign-in handoff');
          } else {
            await authService.clearLocalSession();
            applyUser(null);
          }
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

  useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        await registerPushTokenForCurrentUser();
        await triggerProjectNotificationPushDispatch();
      } catch (error) {
        console.log('Push bootstrap warning:', error);
      }
    })();
  }, [user?.id]);

  const checkAuthState = async () => {
    try {
      console.log('Checking auth state...');
      // Prefer Supabase session if present
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        const synced = await authService.upsertUserFromSupabase(data.session.user);
        console.log('Current user (supabase):', synced ? 'Found' : 'Not found');
        applyUser(synced);
        await syncCollaborationState();
        return;
      }
      // No Supabase session means signed-out state for collaboration-enabled app.
      await authService.clearLocalSession();
      console.log('Current user (local): Not found');
      if (user !== null) {
        applyUser(null);
      }
    } catch (error) {
      console.error('Error checking auth state:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithApple = async (): Promise<AuthResult> => {
    try {
      signInInProgressRef.current = true;
      console.log('Starting Apple Sign-In...');
      const result = await authService.signInWithApple();
      console.log('Apple Sign-In result:', result.success ? 'Success' : 'Failed', result.error || '');
      
      if (result.success && result.user) {
        console.log('Setting user in AuthContext:', result.user.name || 'Apple User');
        applyUser(result.user);
        await syncCollaborationState();
        
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
    } finally {
      signInInProgressRef.current = false;
    }
  };

  const signInWithGoogle = async (): Promise<AuthResult> => {
    try {
      signInInProgressRef.current = true;
      console.log('Starting Google Sign-In...');
      const result = await authService.signInWithGoogle();
      console.log('Google Sign-In result:', result.success ? 'Success' : 'Failed', result.error || '');
      
      if (result.success && result.user) {
        console.log('Setting user in AuthContext:', result.user.name || 'Google User');
        applyUser(result.user);
        await syncCollaborationState();
        
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
    } finally {
      signInInProgressRef.current = false;
    }
  };


  const signOut = async () => {
    try {
      signOutInProgressRef.current = true;
      try {
        await deactivateStoredPushTokenForCurrentUser();
      } catch (error) {
        console.log('Push token deactivation warning:', error);
      }
      await authService.signOut();
      applyUser(null);
      router.replace('/auth');
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    } finally {
      signOutInProgressRef.current = false;
    }
  };

  const updateDisplayName = async (name: string) => {
    const updatedUser = await authService.updateDisplayName(name);
    applyUser(updatedUser);
  };

  const value: AuthContextType = {
    user,
    isLoading,
    signInWithApple,
    signInWithGoogle,
    updateDisplayName,
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
