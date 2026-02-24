import React, { useCallback, useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/AuthContext';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { ScrollProvider } from '../../components/glass/ScrollContext';
import { BVTabBar } from '../../components/ui';
import { getUnreadProjectNotificationCount } from '../../lib/db';

export default function TabLayout() {
  const { user, isLoading } = useAuth();
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  const refreshUnreadNotificationCount = useCallback(() => {
    if (!user) {
      setUnreadNotificationCount(0);
      return;
    }
    try {
      setUnreadNotificationCount(getUnreadProjectNotificationCount());
    } catch {
      setUnreadNotificationCount(0);
    }
  }, [user]);

  useEffect(() => {
    refreshUnreadNotificationCount();
    if (!user) return;

    const intervalId = setInterval(() => {
      refreshUnreadNotificationCount();
    }, 5000);

    return () => {
      clearInterval(intervalId);
    };
  }, [refreshUnreadNotificationCount, user]);

  // Debug logging
  console.log('TabLayout - isLoading:', isLoading, 'user:', user ? 'Found' : 'Not found');

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <View style={{ 
        flex: 1, 
        backgroundColor: '#0B0F14', 
        justifyContent: 'center', 
        alignItems: 'center' 
      }}>
        <ActivityIndicator size="large" color="#FF7A1A" />
      </View>
    );
  }

  // Redirect to auth screen if not authenticated
  if (!user) {
    console.log('TabLayout - Redirecting to auth screen');
    return <Redirect href="/auth" />;
  }

  console.log('TabLayout - Rendering tabs for user:', user.name);

  return (
    <ScrollProvider>
      <Tabs
        tabBar={(props) => <BVTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Projects',
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="folder" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="feed"
          options={{
            title: 'Feed',
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="newspaper-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            headerShown: false,
            tabBarBadge:
              unreadNotificationCount > 0
                ? unreadNotificationCount > 99
                  ? '99+'
                  : unreadNotificationCount
                : undefined,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </ScrollProvider>
  );
}
