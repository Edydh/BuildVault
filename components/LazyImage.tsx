import React, { useState, useEffect, useRef } from 'react';
import { View, ActivityIndicator, Animated, Platform, StyleProp, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { ImageVariants, getImageUriForState } from '@/lib/imageOptimization';

interface LazyImageProps {
  variants: ImageVariants;
  style?: StyleProp<ViewStyle>;
  contentFit?: 'cover' | 'contain' | 'fill' | 'scale-down' | 'none';
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  onError?: (error: unknown) => void;
  showLoadingIndicator?: boolean;
  loadingIndicatorColor?: string;
  progressiveLoading?: boolean;
  priority?: 'low' | 'normal' | 'high';
}

export default function LazyImage({
  variants,
  style,
  contentFit = 'cover',
  onLoadStart,
  onLoadEnd,
  onError,
  showLoadingIndicator = true,
  loadingIndicatorColor = '#FF7A1A',
  progressiveLoading = Platform.OS !== 'android',
  priority = 'normal',
}: LazyImageProps) {
  const progressiveEnabled = progressiveLoading && Platform.OS !== 'android';

  const [loadingState, setLoadingState] = useState<'thumbnail' | 'preview' | 'full' | 'original'>(
    progressiveEnabled ? 'thumbnail' : 'original'
  );
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  // Progressive loading sequence
  useEffect(() => {
    if (!progressiveEnabled) {
      setLoadingState(current => (current === 'original' ? current : 'original'));
      return;
    }

    let cancelled = false;

    const loadSequence = async () => {
      const runStep = async (state: 'thumbnail' | 'preview' | 'full', delay = 200) => {
        if (cancelled) return;
        setLoadingState(state);
        await new Promise(resolve => setTimeout(resolve, delay));
      };

      try {
        await runStep('thumbnail', 120);
        await runStep('preview', 200);
        await runStep('full', 240);

        if (!cancelled && priority === 'high') {
          setLoadingState('original');
        }
      } catch (error) {
        console.error('Progressive loading error:', error);
      }
    };

    loadSequence();

    return () => {
      cancelled = true;
    };
  }, [progressiveEnabled, priority]);

  const handleLoadStart = () => {
    setIsLoading(true);
    setHasError(false);
    onLoadStart?.();
  };

  const handleLoadEnd = () => {
    setIsLoading(false);
    onLoadEnd?.();
    
    // Animate in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleError = (error: unknown) => {
    setHasError(true);
    setIsLoading(false);
    onError?.(error);
  };

  const currentUri = getImageUriForState(variants, loadingState);

  return (
    <View style={[{ position: 'relative' }, style]}>
      <Animated.View
        style={[
          { flex: 1 },
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Image
          source={{ uri: currentUri }}
          style={{ flex: 1 }}
          contentFit={contentFit}
          onLoadStart={handleLoadStart}
          onLoadEnd={handleLoadEnd}
          onError={handleError}
          cachePolicy="memory-disk"
          transition={200}
        />
      </Animated.View>

      {isLoading && showLoadingIndicator && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(11, 15, 20, 0.8)',
          }}
        >
          <ActivityIndicator size="small" color={loadingIndicatorColor} />
        </View>
      )}

      {hasError && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(11, 15, 20, 0.9)',
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: '#EF4444',
              }}
            />
          </View>
        </View>
      )}
    </View>
  );
}
