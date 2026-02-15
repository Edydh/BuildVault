import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { bvColors, bvRadius, bvSpacing, bvTypography } from '@/lib/theme/tokens';

type BVIconName = keyof typeof Ionicons.glyphMap;
type BVStatTone = 'brand' | 'neutral' | 'success' | 'warning' | 'danger';

type BVStatChipProps = {
  icon?: BVIconName;
  label: string;
  tone?: BVStatTone;
  style?: StyleProp<ViewStyle>;
};

const toneColorMap: Record<BVStatTone, string> = {
  brand: bvColors.brand.primaryLight,
  neutral: bvColors.neutral[400],
  success: bvColors.semantic.success,
  warning: bvColors.semantic.warning,
  danger: bvColors.semantic.danger,
};

export function BVStatChip({ icon, label, tone = 'neutral', style }: BVStatChipProps) {
  const color = toneColorMap[tone];
  return (
    <View style={[styles.base, style]}>
      {icon ? <Ionicons name={icon} size={14} color={color} style={styles.icon} /> : null}
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    backgroundColor: 'rgba(148,163,184,0.14)',
    borderColor: 'rgba(148,163,184,0.26)',
    borderRadius: bvRadius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: bvSpacing[12],
    paddingVertical: bvSpacing[4],
  },
  icon: {
    marginRight: bvSpacing[4],
  },
  label: {
    ...bvTypography.label,
    fontWeight: '600',
  },
});

export default BVStatChip;

