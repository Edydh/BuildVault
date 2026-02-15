import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
export type GlassIntensity = 'low' | 'medium' | 'high' | 'adaptive';
export type GlassTint = 'light' | 'dark' | 'default' | 'extraLight';

interface GlassThemeConfig {
  intensity: GlassIntensity;
  tint: GlassTint;
  enableAnimations: boolean;
  enableHaptics: boolean;
  reduceTransparency: boolean;
  adaptivePerformance: boolean;
  quickPerformanceMode: boolean;
  featureFlags: {
    galleryOverlays: boolean;
    mediaDetailOverlays: boolean;
  };
}

interface GlassThemeContextType {
  config: GlassThemeConfig;
  updateConfig: (updates: Partial<GlassThemeConfig>) => void;
  getBlurIntensity: (baseIntensity?: number) => number;
  getGlassColors: () => GlassColors;
  isHighPerformance: boolean;
  resetToDefaults: () => void;
}

interface GlassColors {
  background: string;
  backgroundOpacity: number;
  gradientStart: string;
  gradientEnd: string;
  borderColor: string;
  textPrimary: string;
  textSecondary: string;
}

// Storage key
export const GLASS_THEME_STORAGE_KEY = '@buildvault/glass-theme';

// Default configuration
const defaultConfig: GlassThemeConfig = {
  intensity: 'medium',
  tint: 'default',
  enableAnimations: true,
  enableHaptics: true,
  reduceTransparency: false,
  adaptivePerformance: true,
  // Quick performance flag for reduced effects
  quickPerformanceMode: false,
  featureFlags: {
    galleryOverlays: true,
    mediaDetailOverlays: true,
  },
};

// Intensity mappings
const intensityValues = {
  low: { ios: 40, android: 20 },
  medium: { ios: 80, android: 40 },
  high: { ios: 100, android: 60 },
  adaptive: { ios: 80, android: 40 }, // Will be adjusted based on device
};

// Create context
const GlassThemeContext = createContext<GlassThemeContextType | undefined>(undefined);

// Provider component
export const GlassThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<GlassThemeConfig>(defaultConfig);
  const [isHighPerformance, setIsHighPerformance] = useState(true);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Check device performance capabilities
  useEffect(() => {
    const checkDevicePerformance = async () => {
      // Simplified performance detection without expo-device
      if (Platform.OS === 'ios') {
        // iOS devices generally handle blur well
        // Assume high performance for iOS 13+ (which is our minimum)
        setIsHighPerformance(true);
      } else {
        // Android: Check API level
        const rawVersion = Platform.Version;
        const apiLevel = typeof rawVersion === 'number' ? rawVersion : parseInt(String(rawVersion), 10);
        // Consider high performance if API 31+ (Android 12+)
        // This is a reasonable assumption for modern Android devices
        setIsHighPerformance(Number.isFinite(apiLevel) && apiLevel >= 31);
      }
    };

    checkDevicePerformance();
  }, []);

  // Load saved preferences
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const saved = await AsyncStorage.getItem(GLASS_THEME_STORAGE_KEY);
        if (saved) {
          const savedConfig = JSON.parse(saved);
          setConfig({ ...defaultConfig, ...savedConfig });
        }
      } catch (error) {
        console.log('Failed to load glass theme preferences:', error);
      }
    };

    loadPreferences();
  }, []);

  // Save preferences when config changes
  useEffect(() => {
    const savePreferences = async () => {
      try {
        await AsyncStorage.setItem(GLASS_THEME_STORAGE_KEY, JSON.stringify(config));
      } catch (error) {
        console.log('Failed to save glass theme preferences:', error);
      }
    };

    savePreferences();
  }, [config]);

  // Update configuration
  const updateConfig = (updates: Partial<GlassThemeConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  // Reset to defaults
  const resetToDefaults = async () => {
    setConfig(defaultConfig);
    try {
      await AsyncStorage.removeItem(GLASS_THEME_STORAGE_KEY);
    } catch (error) {
      console.log('Failed to reset glass theme preferences:', error);
    }
  };

  // Get blur intensity based on config and device
  const getBlurIntensity = (baseIntensity: number = 80): number => {
    // If reduce transparency is on, return minimal blur
    if (config.reduceTransparency) {
      return Platform.OS === 'ios' ? 10 : 5;
    }

    // Quick performance mode - heavily reduced effects
    if (config.quickPerformanceMode) {
      return Platform.OS === 'ios' ? 20 : 10;
    }

    // Get base intensity from config
    let intensity = intensityValues[config.intensity][Platform.OS as 'ios' | 'android'];

    // Apply adaptive performance adjustments
    if (config.adaptivePerformance && !isHighPerformance) {
      intensity = intensity * 0.6; // Reduce by 40% on lower-end devices
    }

    // Scale based on provided base intensity
    intensity = (intensity / 80) * baseIntensity;

    // Platform-specific limits
    if (Platform.OS === 'android') {
      // Android blur is less effective, cap at lower values
      return Math.min(intensity, 60);
    }

    return Math.min(intensity, 100);
  };

  // Get glass colors based on theme and platform
  const getGlassColors = (): GlassColors => {
    const isAndroid = Platform.OS === 'android';
    
    // Reduced transparency mode
    if (config.reduceTransparency) {
      return {
        background: isDark ? '#101826' : '#FFFFFF',
        backgroundOpacity: 1,
        gradientStart: 'transparent',
        gradientEnd: 'transparent',
        borderColor: isDark ? '#1F2A37' : '#E5E7EB',
        textPrimary: isDark ? '#F8FAFC' : '#0F172A',
        textSecondary: isDark ? '#94A3B8' : '#64748B',
      };
    }

    // Android needs more opaque backgrounds - force dark theme for consistency
    if (isAndroid) {
      return {
        background: 'rgba(16, 24, 38, 0.95)',  // Always use dark background on Android
        backgroundOpacity: 0.95,
        gradientStart: 'rgba(255, 255, 255, 0.03)',
        gradientEnd: 'rgba(255, 255, 255, 0)',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        textPrimary: '#F8FAFC',
        textSecondary: '#94A3B8',
      };
    }

    // iOS with full glass effects
    const opacity = config.intensity === 'high' ? 0.8 : 
                   config.intensity === 'low' ? 0.6 : 0.7;

    return {
      background: isDark ? `rgba(16, 24, 38, ${opacity})` : `rgba(255, 255, 255, ${opacity})`,
      backgroundOpacity: opacity,
      gradientStart: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.3)',
      gradientEnd: isDark ? 'rgba(255, 255, 255, 0.01)' : 'rgba(255, 255, 255, 0.1)',
      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.3)',
      textPrimary: isDark ? '#F8FAFC' : '#0F172A',
      textSecondary: isDark ? '#94A3B8' : '#64748B',
    };
  };

  const contextValue: GlassThemeContextType = {
    config,
    updateConfig,
    getBlurIntensity,
    getGlassColors,
    isHighPerformance,
    resetToDefaults,
  };

  return (
    <GlassThemeContext.Provider value={contextValue}>
      {children}
    </GlassThemeContext.Provider>
  );
};

// Hook to use glass theme
export const useGlassTheme = () => {
  const context = useContext(GlassThemeContext);
  if (!context) {
    throw new Error('useGlassTheme must be used within GlassThemeProvider');
  }
  return context;
};

// Utility hook for glass morphism styles
export const useGlassMorphism = (intensity?: number) => {
  const { getBlurIntensity, getGlassColors, config } = useGlassTheme();
  
  return {
    blurIntensity: getBlurIntensity(intensity),
    colors: getGlassColors(),
    enableAnimations: config.enableAnimations && !config.quickPerformanceMode,
    enableHaptics: config.enableHaptics && !config.quickPerformanceMode,
    tint: config.tint,
    quickPerformanceMode: config.quickPerformanceMode,
  };
};
