import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
  Extrapolate,
  SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useScrollContext } from './ScrollContext';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { scrollY } = useScrollContext();
  
  // Animation values for each tab
  const tabScales: Record<string, SharedValue<number>> = {};
  state.routes.forEach((route) => {
    tabScales[route.key] = useSharedValue(state.index === state.routes.indexOf(route) ? 1 : 0.9);
  });

  type TabRoute = BottomTabBarProps['state']['routes'][number];
  type IoniconName = keyof typeof Ionicons.glyphMap;

  const handleTabPress = (route: TabRoute, isFocused: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });

    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(route.name);
    }

    // Animate tabs
    state.routes.forEach((r) => {
      tabScales[r.key].value = withSpring(r.key === route.key ? 1 : 0.9, {
        damping: 15,
        stiffness: 150,
      });
    });
  };

  const handleTabLongPress = (route: TabRoute) => {
    navigation.emit({
      type: 'tabLongPress',
      target: route.key,
    });
  };

  // Animate tab bar based on scroll
  const animatedTabBarStyle = useAnimatedStyle(() => {
    // Start hiding after 100px scroll, fully hidden at 200px
    const opacity = interpolate(
      scrollY.value,
      [0, 100, 200],
      [1, 1, 0],
      Extrapolate.CLAMP
    );

    // Slide down as it fades
    const translateY = interpolate(
      scrollY.value,
      [0, 100, 200],
      [0, 0, 100],
      Extrapolate.CLAMP
    );

    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  return (
    <Animated.View style={[styles.container, { paddingBottom: insets.bottom }, animatedTabBarStyle]}>
      <BlurView
        intensity={Platform.OS === 'android' ? 30 : 90}
        tint="dark"
        style={StyleSheet.absoluteFillObject}
      />
      
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.tabsContainer}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
              ? options.title
              : route.name;

          const isFocused = state.index === index;

          const animatedTabStyle = useAnimatedStyle(() => ({
            transform: [{ scale: tabScales[route.key].value }],
          }));

          // Get icon name based on route
          const getIconName = (): IoniconName => {
            switch (route.name) {
              case 'index':
                return 'folder';
              case 'settings':
                return 'settings';
              default:
                return 'home';
            }
          };

          return (
            <AnimatedTouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarButtonTestID}
              onPress={() => handleTabPress(route, isFocused)}
              onLongPress={() => handleTabLongPress(route)}
              style={[styles.tab, animatedTabStyle]}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.tabContent,
                  isFocused && styles.activeTabContent,
                  isFocused && { backgroundColor: 'rgba(255, 121, 26, 0.05)' },
                ]}
              >
                <Ionicons
                  name={getIconName()}
                  size={24}
                  color={isFocused ? '#FF7A1A' : '#64748B'}
                />
                <Text
                  style={[
                    styles.tabText,
                    {
                      color: isFocused ? '#FF7A1A' : '#64748B',
                      fontWeight: isFocused ? '600' : '400',
                    },
                  ]}
                >
                  {label as string}
                </Text>
              </View>
            </AnimatedTouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(30, 41, 59, 0.5)',
    overflow: 'hidden',
    backgroundColor: Platform.OS === 'android' ? 'rgba(16, 24, 38, 0.98)' : 'rgba(16, 24, 38, 0.9)',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    minWidth: 64,
  },
  activeTabContent: {
    transform: [{ scale: 1.05 }],
  },
  tabText: {
    fontSize: 12,
    marginTop: 4,
  },
});
