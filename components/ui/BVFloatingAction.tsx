import React from 'react';
import { StyleProp, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { bvColors, bvRadius, bvSpacing } from '@/lib/theme/tokens';

type BVIconName = keyof typeof Ionicons.glyphMap;

type BVFloatingActionProps = {
  onPress: () => void;
  icon?: BVIconName;
  size?: number;
  right?: number;
  bottom?: number;
  style?: StyleProp<ViewStyle>;
};

export function BVFloatingAction({
  onPress,
  icon = 'add',
  size = 64,
  right = bvSpacing[16],
  bottom = bvSpacing[16],
  style,
}: BVFloatingActionProps) {
  const insets = useSafeAreaInsets();

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.base,
        {
          width: size,
          height: size,
          right,
          bottom: bottom + insets.bottom,
          borderRadius: bvRadius.pill,
        },
        style,
      ]}
      activeOpacity={0.92}
    >
      <Ionicons name={icon} size={26} color={bvColors.text.onPrimary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    backgroundColor: bvColors.brand.primary,
    justifyContent: 'center',
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
});

export default BVFloatingAction;

