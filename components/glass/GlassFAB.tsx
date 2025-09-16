import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

type GlassFABProps = {
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  size?: number; // diameter
  style?: ViewStyle;
  disabled?: boolean;
  haptic?: boolean;
};

const AnimatedTouchable = Animated.createAnimatedComponent(Animated.View);

export const GlassFAB: React.FC<GlassFABProps> = ({
  onPress,
  icon = 'add',
  size = 60,
  style,
  disabled = false,
  haptic = true,
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const handlePressIn = () => {
    'worklet';
    scale.value = withSpring(0.94, { damping: 15, stiffness: 400 });
    opacity.value = withTiming(0.9, { duration: 100 });
  };

  const handlePressOut = () => {
    'worklet';
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    opacity.value = withTiming(1, { duration: 120 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: disabled ? 0.5 : opacity.value,
  }));

  const dimensionStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  const pressableProps = {
    onStartShouldSetResponder: () => true,
    onResponderGrant: () => {
      handlePressIn();
      if (haptic && !disabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    onResponderRelease: () => {
      handlePressOut();
      if (!disabled) onPress?.();
    },
    onResponderTerminate: () => handlePressOut(),
  } as const;

  return (
    <AnimatedTouchable style={[styles.wrapper, dimensionStyle, animatedStyle, style]} {...pressableProps}>
      <View style={[styles.inner, dimensionStyle]}>
        <BlurView intensity={60} tint="dark" style={[StyleSheet.absoluteFillObject, { borderRadius: size / 2 }]} />
        <LinearGradient
          colors={[
            'rgba(255, 122, 26, 0.35)',
            'rgba(255, 122, 26, 0.15)',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: size / 2 }]}
        />
        <Ionicons name={icon} size={Math.max(22, Math.round(size * 0.45))} color="#FF7A1A" />
      </View>
    </AnimatedTouchable>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 122, 26, 0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 24, 38, 0.95)',
  },
});

export default GlassFAB;


