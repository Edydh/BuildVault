import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BVButton from './BVButton';
import { bvColors, bvRadius, bvSpacing, bvTypography } from '@/lib/theme/tokens';

type BVIconName = keyof typeof Ionicons.glyphMap;

type BVEmptyStateProps = {
  title: string;
  description: string;
  icon?: BVIconName;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function BVEmptyState({
  title,
  description,
  icon = 'time-outline',
  actionLabel,
  onAction,
  style,
}: BVEmptyStateProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconRing}>
        <Ionicons name={icon} size={36} color={bvColors.neutral[400]} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionLabel && onAction ? (
        <BVButton title={actionLabel} onPress={onAction} size="md" style={styles.button} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    borderColor: 'rgba(148,163,184,0.2)',
    borderRadius: bvRadius.lg,
    borderWidth: 1,
    paddingHorizontal: bvSpacing[24],
    paddingVertical: bvSpacing[32],
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  iconRing: {
    width: 84,
    height: 84,
    borderRadius: bvRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: bvSpacing[16],
    backgroundColor: 'rgba(148,163,184,0.12)',
    borderColor: 'rgba(148,163,184,0.2)',
    borderWidth: 1,
  },
  title: {
    ...bvTypography.headingMedium,
    color: bvColors.text.primary,
    marginBottom: bvSpacing[8],
  },
  description: {
    ...bvTypography.bodyRegular,
    color: bvColors.text.muted,
    textAlign: 'center',
    maxWidth: 300,
  },
  button: {
    marginTop: bvSpacing[20],
    minWidth: 160,
  },
});

export default BVEmptyState;

