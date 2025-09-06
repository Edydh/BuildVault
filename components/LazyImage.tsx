import React, { useState, useEffect, useRef } from 'react';
import { View, ActivityIndicator, Animated } from 'react-native';
import { Image } from 'expo-image';
import { ImageVariants, getImageUriForState } from '@/lib/imageOptimization';

interface LazyImageProps {
  variants: ImageVariants;
  style?: any;
  contentFit?: 'cover' | 'contain' | 'fill' | 'scale-down' | 'none';
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  onError?: (error: any) => void;
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
  progressiveLoading = true,
  priority = 'normal',
}: LazyImageProps) {
  const [loadingState, setLoadingState] = useState<'thumbnail' | 'preview' | 'full' | 'original'>('thumbnail');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  // Progressive loading sequence
  useEffect(() => {
    if (!progressiveLoading) {
      setLoadingState('original');
      return;
    }

    const loadSequence = async () => {
      try {
        // Start with thumbnail
        setLoadingState('thumbnail');
        await new Promise(resolve => setTimeout(resolve, 100));

        // Load preview after a short delay
        setLoadingState('preview');
        await new Promise(resolve => setTimeout(resolve, 200));

        // Load full quality
        setLoadingState('full');
        await new Promise(resolve => setTimeout(resolve, 300));

        // Finally load original if needed
        if (priority === 'high') {
          setLoadingState('original');
        }
      } catch (error) {
        console.error('Progressive loading error:', error);
      }
    };

    loadSequence();
  }, [progressiveLoading, priority]);

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

  const handleError = (error: any) => {
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
