import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

interface GlassButtonProps {
  onPress?: () => void;
  onLongPress?: () => void;
  title?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  haptic?: boolean;
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export const GlassButton: React.FC<GlassButtonProps> = ({
  onPress,
  onLongPress,
  title,
  icon,
  iconPosition = 'left',
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  textStyle,
  haptic = true,
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const handlePressIn = () => {
    'worklet';
    scale.value = withSpring(0.96, {
      damping: 15,
      stiffness: 400,
    });
    opacity.value = withTiming(0.8, { duration: 100 });
    
    if (haptic && !disabled) {
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handlePressOut = () => {
    'worklet';
    scale.value = withSpring(1, {
      damping: 15,
      stiffness: 400,
    });
    opacity.value = withTiming(1, { duration: 100 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: disabled ? 0.5 : opacity.value,
  }));

  // Size configurations
  const sizeConfig = {
    small: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      fontSize: 14,
      iconSize: 16,
      borderRadius: 12,
    },
    medium: {
      paddingVertical: 12,
      paddingHorizontal: 24,
      fontSize: 16,
      iconSize: 20,
      borderRadius: 16,
    },
    large: {
      paddingVertical: 16,
      paddingHorizontal: 32,
      fontSize: 18,
      iconSize: 24,
      borderRadius: 20,
    },
  };

  // Variant colors
  const variantColors = {
    primary: {
      gradient: ['rgba(255, 122, 26, 0.3)', 'rgba(255, 122, 26, 0.1)'] as const,
      text: '#FF7A1A',
      icon: '#FF7A1A',
      border: 'rgba(255, 122, 26, 0.3)',
    },
    secondary: {
      gradient: ['rgba(148, 163, 184, 0.2)', 'rgba(148, 163, 184, 0.05)'] as const,
      text: '#94A3B8',
      icon: '#94A3B8',
      border: 'rgba(148, 163, 184, 0.2)',
    },
    danger: {
      gradient: ['rgba(239, 68, 68, 0.3)', 'rgba(239, 68, 68, 0.1)'] as const,
      text: '#EF4444',
      icon: '#EF4444',
      border: 'rgba(239, 68, 68, 0.3)',
    },
    success: {
      gradient: ['rgba(34, 197, 94, 0.3)', 'rgba(34, 197, 94, 0.1)'] as const,
      text: '#22C55E',
      icon: '#22C55E',
      border: 'rgba(34, 197, 94, 0.3)',
    },
  };

  const currentSize = sizeConfig[size];
  const currentVariant = variantColors[variant];

  const buttonStyle: ViewStyle = {
    paddingVertical: currentSize.paddingVertical,
    paddingHorizontal: currentSize.paddingHorizontal,
    borderRadius: currentSize.borderRadius,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: currentVariant.border,
    overflow: 'hidden',
    ...(fullWidth && { width: '100%' }),
  };

  const textStyles: TextStyle = {
    fontSize: currentSize.fontSize,
    fontWeight: '600',
    color: currentVariant.text,
    marginHorizontal: icon ? 4 : 0,
  };

  return (
    <AnimatedTouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      activeOpacity={1}
      style={[animatedStyle, style]}
    >
      <View style={buttonStyle}>
        <BlurView
          intensity={60}
          tint="dark"
          style={StyleSheet.absoluteFillObject}
        />
        <LinearGradient
          colors={currentVariant.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        
        <View style={styles.contentContainer}>
          {loading ? (
            <ActivityIndicator
              size="small"
              color={currentVariant.text}
            />
          ) : (
            <>
              {icon && iconPosition === 'left' && (
                <Ionicons
                  name={icon}
                  size={currentSize.iconSize}
                  color={currentVariant.icon}
                  style={styles.iconLeft}
                />
              )}
              {title && (
                <Text style={[textStyles, textStyle]}>{title}</Text>
              )}
              {icon && iconPosition === 'right' && (
                <Ionicons
                  name={icon}
                  size={currentSize.iconSize}
                  color={currentVariant.icon}
                  style={styles.iconRight}
                />
              )}
            </>
          )}
        </View>
      </View>
    </AnimatedTouchableOpacity>
  );
};

const styles = StyleSheet.create({
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLeft: {
    marginRight: 6,
  },
  iconRight: {
    marginLeft: 6,
  },
});

export default GlassButton;
