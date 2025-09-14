import React, { useEffect } from 'react';
import { View, ViewProps, StyleSheet, Platform, useColorScheme } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';

interface GlassCardProps extends ViewProps {
  children?: React.ReactNode;
  intensity?: number;
  tint?: 'light' | 'dark' | 'default' | 'extraLight';
  gradient?: boolean;
  animated?: boolean;
  glassTint?: string;
  borderRadius?: number;
  shadowEnabled?: boolean;
}

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  intensity = 80,
  tint,
  gradient = true,
  animated = true,
  glassTint,
  borderRadius = 16,
  shadowEnabled = true,
  style,
  ...rest
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const defaultTint = tint || (isDark ? 'dark' : 'light');
  
  // Animation values
  const scale = useSharedValue(0.95);
  const opacity = useSharedValue(0);
  const borderOpacity = useSharedValue(0);

  useEffect(() => {
    if (animated) {
      scale.value = withSpring(1, {
        damping: 15,
        stiffness: 150,
      });
      opacity.value = withTiming(1, {
        duration: 300,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
      });
      borderOpacity.value = withTiming(1, {
        duration: 500,
        easing: Easing.out(Easing.quad),
      });
    } else {
      scale.value = 1;
      opacity.value = 1;
      borderOpacity.value = 1;
    }
  }, [animated]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const borderStyle = useAnimatedStyle(() => ({
    borderColor: isDark 
      ? `rgba(255, 255, 255, ${interpolate(borderOpacity.value, [0, 1], [0, 0.1])})` 
      : `rgba(255, 255, 255, ${interpolate(borderOpacity.value, [0, 1], [0, 0.3])})`,
  }));

  // Glass effect colors based on theme
  const glassColors = isDark
    ? {
        background: glassTint || 'rgba(16, 24, 38, 0.7)',
        gradientStart: 'rgba(255, 255, 255, 0.05)',
        gradientEnd: 'rgba(255, 255, 255, 0.01)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
      }
    : {
        background: glassTint || 'rgba(255, 255, 255, 0.7)',
        gradientStart: 'rgba(255, 255, 255, 0.3)',
        gradientEnd: 'rgba(255, 255, 255, 0.1)',
        borderColor: 'rgba(255, 255, 255, 0.3)',
      };

  const shadowStyle = shadowEnabled
    ? Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: isDark ? 0.3 : 0.1,
          shadowRadius: 16,
        },
        android: {
          elevation: 8,
        },
      })
    : {};

  const containerStyle = [
    styles.container,
    {
      borderRadius,
      backgroundColor: glassColors.background,
    },
    shadowStyle,
    style,
  ];

  const borderContainerStyle = [
    styles.borderContainer,
    {
      borderRadius,
      borderWidth: 1,
    },
    borderStyle,
  ];

  return (
    <Animated.View style={[containerStyle, animatedStyle]} {...rest}>
      <AnimatedBlurView
        intensity={intensity}
        tint={defaultTint}
        style={[styles.blurView, { borderRadius }]}
      >
        {gradient && (
          <AnimatedLinearGradient
            colors={[glassColors.gradientStart, glassColors.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.gradient, { borderRadius }]}
          />
        )}
        <Animated.View style={borderContainerStyle}>
          <View style={styles.content}>{children}</View>
        </Animated.View>
      </AnimatedBlurView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  blurView: {
    flex: 1,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  borderContainer: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});

export default GlassCard;
