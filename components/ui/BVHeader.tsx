import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { bvColors, bvSpacing, bvTypography } from '@/lib/theme/tokens';

type BVHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function BVHeader({ title, subtitle, onBack, right, style }: BVHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + bvSpacing[12] }, style]}>
      <View style={styles.row}>
        <View style={styles.left}>
          {onBack ? (
            <TouchableOpacity onPress={onBack} style={styles.backButton} hitSlop={10}>
              <Ionicons name="chevron-back" size={24} color={bvColors.text.primary} />
            </TouchableOpacity>
          ) : null}
          <View style={styles.titleWrap}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: bvSpacing[12],
    paddingHorizontal: bvSpacing[16],
    backgroundColor: bvColors.surface.app,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  left: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    marginRight: bvSpacing[8],
  },
  backButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    marginRight: bvSpacing[8],
    width: 40,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    ...bvTypography.headingLarge,
    color: bvColors.text.primary,
  },
  subtitle: {
    ...bvTypography.bodyRegular,
    color: bvColors.text.secondary,
    marginTop: 2,
  },
  right: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
});

export default BVHeader;

