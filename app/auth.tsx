import React, { useState } from 'react';
import {
  View,
  Text,
  Alert,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Image,
  ImageBackground,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '../lib/AuthContext';
import { GlassCard, GlassButton } from '../components/glass';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export default function AuthScreen() {
  const router = useRouter();
  const { signInWithApple, signInWithGoogle } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const insets = useSafeAreaInsets();

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
      
      if (result?.error) {
        if (result.error.includes('CANCELED') || result.error.includes('canceled')) {
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
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Fullscreen Construction Background */}
      <ImageBackground
        source={require('../assets/bg-construction-dark.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        {/* Dark Overlay for Better Text Readability */}
        <LinearGradient
          colors={['rgba(11, 15, 20, 0.7)', 'rgba(11, 15, 20, 0.8)', 'rgba(11, 15, 20, 0.9)']}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Content Container */}
        <View style={[styles.contentContainer, { paddingTop: insets.top + 40 }]}>
          
          {/* Logo Section */}
          <View style={styles.logoSection}>
            <View style={styles.logoContainer}>
              <Image
                source={require('../assets/icon.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.title}>BuildVault</Text>
            <Text style={styles.subtitle}>Construction Project Documentation</Text>
          </View>

          {/* Main Content */}
          <View style={styles.mainContent}>
            <GlassCard style={styles.welcomeCard} intensity={30}>
              <Text style={styles.welcomeText}>Welcome to BuildVault</Text>
              <Text style={styles.descriptionText}>
                Sign in to access your construction projects and documentation
              </Text>
            </GlassCard>

            {/* Authentication Buttons */}
            <View style={styles.buttonContainer}>
              {/* Apple Sign-In - Only show on iOS */}
              {Platform.OS === 'ios' && (
                <GlassButton
                  variant="secondary"
                  size="large"
                  title="Continue with Apple"
                  icon="logo-apple"
                  onPress={handleAppleSignIn}
                  disabled={isLoading}
                  style={styles.authButton}
                  loading={isLoading}
                />
              )}

              <GlassButton
                variant="primary"
                size="large"
                title="Continue with Google"
                icon="logo-google"
                onPress={handleGoogleSignIn}
                disabled={isLoading}
                style={styles.authButton}
              />
            </View>

            {/* Legal Notice */}
            <GlassCard style={styles.legalNoticeCard} intensity={80}>
              <Text style={styles.legalNoticeText}>By signing in, you agree to:</Text>
            </GlassCard>
          </View>
          {/* Inline legal links above footer (no card) */}
          <View style={styles.inlineLegalRow}>
            <Text
              style={styles.inlineLegalLink}
              onPress={() => Linking.openURL('https://sites.google.com/view/buildvault-legal-terms/')}
            >
              Terms of Service
            </Text>
            <Text style={styles.inlineLegalSeparator}>•</Text>
            <Text
              style={styles.inlineLegalLink}
              onPress={() => Linking.openURL('https://sites.google.com/view/buildvault-legal-privacy/')}
            >
              Privacy Policy
            </Text>
          </View>
          


          {/* Footer */}
          <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
            <Text style={styles.footerText}>
              Built with ❤️ © 2025 uniQubit
            </Text>
          </View>

          
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F14',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  logoSection: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 40,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 122, 26, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(255, 122, 26, 0.3)',
  },
  logo: {
    width: 80,
    height: 80,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 8,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 18,
    color: '#CBD5E1',
    textAlign: 'center',
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  mainContent: {
    flex: 1,
    justifyContent: 'space-evenly',
    gap: 20,
    paddingVertical: 20,
  },
  welcomeCard: {
    padding: 24,
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 16,
    color: '#CBD5E1',
    textAlign: 'center',
    lineHeight: 24,
  },
  buttonContainer: {
    gap: 16,
  },
  authButton: {
    width: '100%',
  },
  legalNoticeCard: {
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  legalNoticeText: {
    fontSize: 14,
    color: '#E2E8F0',
    textAlign: 'center',
    fontWeight: '500',
  },
  inlineLegalRow: {
    marginTop: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  inlineLegalLink: {
    color: '#FFA500',
    fontWeight: '700',
    textDecorationLine: 'underline',
    textDecorationColor: '#FFA500',
    fontSize: 14,
  },
  inlineLegalSeparator: {
    color: '#94A3B8',
    fontSize: 14,
  },
  footer: {
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: 24,
    paddingHorizontal: 16,
  },
  footerText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});