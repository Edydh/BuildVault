import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  ViewStyle,
  StyleProp,
  PressableProps,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { bvBlur, bvColors, bvRadius, bvSpacing } from '@/lib/theme/tokens';

type BVCardProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  onPress?: PressableProps['onPress'];
  onLongPress?: PressableProps['onLongPress'];
  disabled?: boolean;
};

export function BVCard({
  children,
  style,
  contentStyle,
  onPress,
  onLongPress,
  disabled = false,
}: BVCardProps) {
  const cardBody = (
    <View style={[styles.card, style]}>
      <BlurView intensity={bvBlur.glass} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={styles.glassOverlay} />
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );

  if (onPress || onLongPress) {
    return (
      <Pressable disabled={disabled} onPress={onPress} onLongPress={onLongPress}>
        {cardBody}
      </Pressable>
    );
  }

  return cardBody;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: bvRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: bvColors.surface.glassBorder,
    backgroundColor: bvColors.surface.card,
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: bvColors.surface.glass,
  },
  content: {
    padding: bvSpacing[16],
  },
});

export default BVCard;

