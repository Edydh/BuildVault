import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { bvColors, bvRadius, bvSpacing, bvTypography } from '@/lib/theme/tokens';

function fallbackIconForRoute(name: string): keyof typeof Ionicons.glyphMap {
  if (name === 'index') return 'folder-outline';
  if (name === 'feed') return 'newspaper-outline';
  if (name === 'capture') return 'camera-outline';
  if (name === 'settings') return 'settings-outline';
  return 'ellipse-outline';
}

export function BVTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, bvSpacing[8]) }]}>
      <View style={styles.inner}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const color = isFocused ? bvColors.brand.primaryLight : bvColors.neutral[400];
          const iconRenderer = options.tabBarIcon;
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : typeof options.title === 'string'
                ? options.title
                : route.name;
          const badgeValue = options.tabBarBadge;
          const badgeLabel =
            badgeValue === undefined || badgeValue === null || badgeValue === ''
              ? null
              : String(badgeValue);

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={[styles.tab, isFocused && styles.tabActive]}
              activeOpacity={0.9}
            >
              <View style={styles.iconWrap}>
                {typeof iconRenderer === 'function' ? (
                  iconRenderer({ focused: isFocused, color, size: 22 })
                ) : (
                  <Ionicons name={fallbackIconForRoute(route.name)} size={22} color={color} />
                )}
                {badgeLabel ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText} numberOfLines={1}>
                      {badgeLabel}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.label, { color }]} numberOfLines={1}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(51,65,85,0.92)',
    borderTopColor: 'rgba(148,163,184,0.24)',
    borderTopWidth: 1,
    paddingTop: bvSpacing[8],
  },
  inner: {
    flexDirection: 'row',
    paddingHorizontal: bvSpacing[8],
  },
  tab: {
    alignItems: 'center',
    borderRadius: bvRadius.md,
    flex: 1,
    justifyContent: 'center',
    minHeight: 56,
    paddingVertical: bvSpacing[8],
  },
  tabActive: {
    backgroundColor: 'rgba(58,99,243,0.16)',
    borderColor: 'rgba(58,99,243,0.35)',
    borderWidth: 1,
  },
  iconWrap: {
    minWidth: 28,
    minHeight: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -14,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: bvColors.semantic.danger,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    ...bvTypography.bodySmall,
    color: bvColors.text.onPrimary,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
  },
  label: {
    ...bvTypography.bodySmall,
    marginTop: 4,
  },
});

export default BVTabBar;
