import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { migrate } from '../lib/db';
import { ensureRootDir } from '../lib/files';
import { AuthProvider } from '../lib/AuthContext';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { GlassThemeProvider } from '../components/glass';

export default function RootLayout() {
  useEffect(() => {
    (async () => {
      migrate();
      await ensureRootDir();
    })();
  }, []);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <AuthProvider>
            <GlassThemeProvider>
              <View style={{ flex: 1, backgroundColor: '#0B0F14' }}>
                <StatusBar style="light" />
                <Stack screenOptions={{ headerShown: false }} />
              </View>
            </GlassThemeProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}