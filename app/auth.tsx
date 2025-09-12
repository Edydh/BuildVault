import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Image,
} from 'react-native';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '../lib/AuthContext';

const { width, height } = Dimensions.get('window');

export default function AuthScreen() {
  const router = useRouter();
  const { signInWithApple, signInWithGoogle } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleAppleSignIn = async () => {
    setIsLoading(true);

    try {
      await signInWithApple();
      // If successful, the AuthContext will update and the protected route will redirect
      // No need to manually navigate here
    } catch (error: any) {
      // Check if it's a user cancellation
      if (error.code === 'ERR_CANCELED' || error.message?.includes('canceled') || error.message?.includes('USER_CANCELED')) {
        console.log('User canceled Apple Sign-In');
        // No alert needed - user intentionally canceled
      } else {
        console.error('Apple Sign-In error:', error);
        Alert.alert('Sign In Failed', error.message || 'Apple Sign-In failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const result = await signInWithGoogle();
      
      if (!result.success) {
        // Check if it's a user cancellation
        if (result.error === 'USER_CANCELED') {
          console.log('User canceled Google Sign-In');
          // No alert needed - user intentionally canceled
        } else {
          console.error('Google Sign-In error:', result.error);
          Alert.alert('Sign In Failed', result.error || 'Google Sign-In failed. Please try again.');
        }
      }
      // If successful, the AuthContext will update and redirect
    } catch (error: any) {
      console.error('Google Sign-In error:', error);
      Alert.alert('Sign In Failed', error.message || 'Google Sign-In failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Image 
            source={require('../assets/icon.png')} 
            style={styles.appIcon}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.title}>BuildVault</Text>
        <Text style={styles.subtitle}>Construction Project Documentation</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.welcomeText}>
          Welcome to BuildVault
        </Text>
        <Text style={styles.descriptionText}>
          Sign in to access your construction projects and documentation
        </Text>

        {/* Sign In Button */}
        <View style={styles.buttonContainer}>
          {/* Apple Sign In */}
          <TouchableOpacity
            style={[styles.signInButton, styles.appleButton]}
            onPress={handleAppleSignIn}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
                <Text style={styles.buttonText}>Continue with Apple</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Google Sign In */}
          <TouchableOpacity
            style={[styles.signInButton, styles.googleButton]}
            onPress={handleGoogleSignIn}
            disabled={isLoading}
          >
            <Ionicons name="logo-google" size={20} color="#0B0F14" />
            <Text style={[styles.buttonText, { color: '#0B0F14' }]}>Continue with Google</Text>
          </TouchableOpacity>
        </View>

        {/* Privacy Notice */}
        <View style={styles.privacyContainer}>
          <Text style={styles.privacyText}>
            By signing in, you agree to our{' '}
            <Text style={styles.linkText} onPress={() => Linking.openURL('https://sites.google.com/view/buildvault-legal-terms/')}>Terms of Service</Text>
            {' '}and{' '}
            <Text style={styles.linkText} onPress={() => Linking.openURL('https://sites.google.com/view/buildvault-legal-privacy/')}>Privacy Policy</Text>
          </Text>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Built with ❤️ © 2025 uniQubit
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F14',
  },
  header: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 122, 26, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  appIcon: {
    width: 80,
    height: 80,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'center',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 48,
    lineHeight: 24,
  },
  buttonContainer: {
    gap: 16,
  },
  signInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 12,
  },
  appleButton: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#374151',
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#374151',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  privacyContainer: {
    marginTop: 32,
    paddingHorizontal: 16,
  },
  privacyText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  linkText: {
    color: '#FF7A1A',
    textDecorationLine: 'underline',
  },
  footer: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#64748B',
  },
});
