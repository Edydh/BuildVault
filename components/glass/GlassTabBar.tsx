import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  useColorScheme,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolate,
  SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

interface TabItem {
  key: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge?: number;
}

interface GlassTabBarProps {
  tabs: TabItem[];
  activeTab: string;
  onTabPress: (key: string) => void;
  scrollY?: SharedValue<number>;
  hideOnScroll?: boolean;
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);
const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

export const GlassTabBar: React.FC<GlassTabBarProps> = ({
  tabs,
  activeTab,
  onTabPress,
  scrollY,
  hideOnScroll = false,
}) => {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // Animation values for each tab
  const tabScales = tabs.reduce((acc, tab) => {
    acc[tab.key] = useSharedValue(tab.key === activeTab ? 1 : 0.9);
    return acc;
  }, {} as Record<string, SharedValue<number>>);

  const handleTabPress = (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Animate all tabs
    tabs.forEach((tab) => {
      tabScales[tab.key].value = withSpring(tab.key === key ? 1 : 0.9, {
        damping: 15,
        stiffness: 150,
      });
    });
    
    onTabPress(key);
  };

  // Tab bar visibility based on scroll
  const animatedTabBarStyle = useAnimatedStyle(() => {
    if (!scrollY || !hideOnScroll) return {};
    
    const translateY = interpolate(
      scrollY.value,
      [0, 100],
      [0, 100],
      Extrapolate.CLAMP
    );

    const opacity = interpolate(
      scrollY.value,
      [0, 50],
      [1, 0.95],
      Extrapolate.CLAMP
    );

    return {
      transform: [{ translateY }],
      opacity,
    };
  });

  const glassColors: {
    background: string;
    gradient: [string, string];
    border: string;
    activeTab: string;
    inactiveTab: string;
    activeBg: string;
  } = isDark
    ? {
        background: 'rgba(16, 24, 38, 0.9)',
        gradient: ['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0)'],
        border: 'rgba(30, 41, 59, 0.5)',
        activeTab: '#FF7A1A',
        inactiveTab: '#64748B',
        activeBg: 'rgba(255, 122, 26, 0.1)',
      }
    : {
        background: 'rgba(255, 255, 255, 0.9)',
        gradient: ['rgba(255, 255, 255, 0.3)', 'rgba(255, 255, 255, 0)'],
        border: 'rgba(226, 232, 240, 0.5)',
        activeTab: '#FF7A1A',
        inactiveTab: '#94A3B8',
        activeBg: 'rgba(255, 122, 26, 0.1)',
      };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          paddingBottom: insets.bottom,
          borderTopColor: glassColors.border,
        },
        animatedTabBarStyle,
      ]}
    >
      <AnimatedBlurView
        intensity={90}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFillObject}
      />
      
      <LinearGradient
        colors={glassColors.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.tabsContainer}>
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          
          const animatedTabStyle = useAnimatedStyle(() => ({
            transform: [{ scale: tabScales[tab.key].value }],
          }));

          return (
            <AnimatedTouchableOpacity
              key={tab.key}
              onPress={() => handleTabPress(tab.key)}
              activeOpacity={0.7}
              style={[styles.tab, animatedTabStyle]}
            >
              <View
                style={[
                  styles.tabContent,
                  isActive && styles.activeTabContent,
                  isActive && { backgroundColor: glassColors.activeBg },
                ]}
              >
                <Ionicons
                  name={tab.icon}
                  size={24}
                  color={isActive ? glassColors.activeTab : glassColors.inactiveTab}
                />
                <Text
                  style={[
                    styles.tabText,
                    {
                      color: isActive ? glassColors.activeTab : glassColors.inactiveTab,
                      fontWeight: isActive ? '600' : '400',
                    },
                  ]}
                >
                  {tab.title}
                </Text>
                
                {tab.badge && tab.badge > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {tab.badge > 99 ? '99+' : tab.badge}
                    </Text>
                  </View>
                )}
              </View>
            </AnimatedTouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    overflow: 'hidden',
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
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
});

export default GlassTabBar;
