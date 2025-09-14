import React, { useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  useColorScheme,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  Extrapolate,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

interface GlassHeaderProps {
  title: string;
  onBack?: () => void;
  scrollY?: Animated.SharedValue<number>;
  search?: {
    value: string;
    onChange: (text: string) => void;
    placeholder?: string;
  };
  right?: React.ReactNode;
  transparent?: boolean;
  maxBlur?: number;
  minBlur?: number;
}

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

export const GlassHeader: React.FC<GlassHeaderProps> = ({
  title,
  onBack,
  scrollY,
  search,
  right,
  transparent = false,
  maxBlur = 100,
  minBlur = 0,
}) => {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // Animation values
  const headerOpacity = useSharedValue(transparent ? 0 : 1);
  const borderOpacity = useSharedValue(0);
  const searchExpanded = useSharedValue(search ? 1 : 0);

  useEffect(() => {
    if (!transparent) {
      headerOpacity.value = withTiming(1, {
        duration: 300,
        easing: Easing.out(Easing.quad),
      });
    }
  }, [transparent]);

  useEffect(() => {
    searchExpanded.value = withTiming(search ? 1 : 0, {
      duration: 300,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
  }, [search]);

  // Dynamic blur based on scroll
  const animatedBlurStyle = useAnimatedStyle(() => {
    if (!scrollY) return {};
    
    const blurIntensity = interpolate(
      scrollY.value,
      [0, 100],
      [minBlur, maxBlur],
      Extrapolate.CLAMP
    );

    // Fade out and translate header when scrolling down
    const opacity = interpolate(
      scrollY.value,
      [0, 50, 150],
      [1, 1, 0],
      Extrapolate.CLAMP
    );

    const translateY = interpolate(
      scrollY.value,
      [0, 50, 150],
      [0, 0, -100],
      Extrapolate.CLAMP
    );

    borderOpacity.value = interpolate(
      scrollY.value,
      [0, 100],
      [0, 1],
      Extrapolate.CLAMP
    );

    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  const animatedBorderStyle = useAnimatedStyle(() => ({
    borderBottomColor: isDark
      ? `rgba(255, 255, 255, ${borderOpacity.value * 0.1})`
      : `rgba(0, 0, 0, ${borderOpacity.value * 0.1})`,
  }));

  const animatedSearchStyle = useAnimatedStyle(() => ({
    height: interpolate(searchExpanded.value, [0, 1], [0, 56]),
    opacity: searchExpanded.value,
    marginTop: interpolate(searchExpanded.value, [0, 1], [0, 12]),
  }));

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onBack?.();
  };

  const glassColors = isDark
    ? {
        background: 'rgba(11, 15, 20, 0.8)',
        gradient: ['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0)'],
        text: '#F8FAFC',
        subtext: '#94A3B8',
        searchBg: 'rgba(16, 24, 38, 0.6)',
        searchBorder: 'rgba(30, 41, 59, 0.5)',
      }
    : {
        background: 'rgba(255, 255, 255, 0.8)',
        gradient: ['rgba(255, 255, 255, 0.3)', 'rgba(255, 255, 255, 0)'],
        text: '#0F172A',
        subtext: '#64748B',
        searchBg: 'rgba(248, 250, 252, 0.6)',
        searchBorder: 'rgba(226, 232, 240, 0.5)',
      };

  return (
    <Animated.View
      style={[
        styles.container,
        { paddingTop: insets.top },
        animatedBlurStyle,
        animatedBorderStyle,
      ]}
    >
      <AnimatedBlurView
        intensity={scrollY ? undefined : maxBlur}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFillObject}
      />
      
      <LinearGradient
        colors={glassColors.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.content}>
        <View style={styles.mainRow}>
          <View style={styles.leftSection}>
            {onBack && (
              <TouchableOpacity
                onPress={handleBack}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.backButton}
              >
                <Ionicons
                  name="chevron-back"
                  size={28}
                  color={glassColors.text}
                />
              </TouchableOpacity>
            )}
            <Text style={[styles.title, { color: glassColors.text }]}>
              {title}
            </Text>
          </View>
          
          {right && <View style={styles.rightSection}>{right}</View>}
        </View>

        {search && (
          <Animated.View style={[styles.searchContainer, animatedSearchStyle]}>
            <View
              style={[
                styles.searchBox,
                {
                  backgroundColor: glassColors.searchBg,
                  borderColor: glassColors.searchBorder,
                },
              ]}
            >
              <Ionicons
                name="search"
                size={18}
                color={glassColors.subtext}
                style={styles.searchIcon}
              />
              <TextInput
                style={[styles.searchInput, { color: glassColors.text }]}
                placeholderTextColor={glassColors.subtext}
                placeholder={search.placeholder || 'Search'}
                value={search.value}
                onChangeText={search.onChange}
                returnKeyType="search"
                autoCorrect={false}
              />
              {search.value.length > 0 && (
                <TouchableOpacity
                  onPress={() => search.onChange('')}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={glassColors.subtext}
                  />
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
    overflow: 'hidden',
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    flex: 1,
  },
  searchContainer: {
    overflow: 'hidden',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    ...Platform.select({
      ios: {
        paddingVertical: 0,
      },
      android: {
        paddingVertical: 2,
      },
    }),
  },
});

export default GlassHeader;
