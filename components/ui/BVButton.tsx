import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { bvColors, bvRadius, bvSpacing, bvTypography } from '@/lib/theme/tokens';

type BVButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type BVButtonSize = 'md' | 'lg';
type BVIconName = keyof typeof Ionicons.glyphMap;

type BVButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: BVButtonVariant;
  size?: BVButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: BVIconName;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

const HEIGHT_BY_SIZE: Record<BVButtonSize, number> = {
  md: 56,
  lg: 64,
};

const colorsByVariant = {
  primary: {
    background: bvColors.brand.primary,
    border: 'transparent',
    text: bvColors.text.onPrimary,
  },
  secondary: {
    background: 'rgba(58,99,243,0.18)',
    border: 'rgba(58,99,243,0.38)',
    text: bvColors.text.primary,
  },
  ghost: {
    background: 'transparent',
    border: 'rgba(203,213,225,0.26)',
    text: bvColors.text.secondary,
  },
  danger: {
    background: bvColors.semantic.danger,
    border: 'transparent',
    text: bvColors.text.onPrimary,
  },
} as const;

export function BVButton({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  style,
  textStyle,
}: BVButtonProps) {
  const variantColors = colorsByVariant[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: HEIGHT_BY_SIZE[size],
          backgroundColor: isDisabled
            ? 'rgba(58,99,243,0.45)'
            : variantColors.background,
          borderColor: isDisabled ? 'rgba(148,163,184,0.25)' : variantColors.border,
          opacity: pressed && !isDisabled ? 0.92 : 1,
          transform: [{ scale: pressed && !isDisabled ? 0.99 : 1 }],
          shadowOpacity: isDisabled ? 0 : styles.base.shadowOpacity,
        },
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={variantColors.text} />
        ) : (
          <>
            {icon ? (
              <Ionicons name={icon} size={18} color={variantColors.text} style={styles.icon} />
            ) : null}
            <Text style={[styles.text, { color: variantColors.text }, textStyle]}>{title}</Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: bvRadius.md,
    borderWidth: 1,
    paddingHorizontal: bvSpacing[20],
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    shadowOpacity: 0.2,
    elevation: 4,
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  icon: {
    marginRight: bvSpacing[8],
  },
  text: {
    ...bvTypography.headingMedium,
    fontSize: 16,
    lineHeight: 20,
  },
});

export default BVButton;

