import type { ExpoConfig } from 'expo/config';

// Load env from process.env (EAS sets these; locally loaded from .env by expo-cli)
// These are public values, not secrets - Supabase anon keys are meant to be public
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const config: ExpoConfig = {
  name: 'BuildVault',
  slug: 'buildvault',
  scheme: 'buildvault',
  version: '1.0.3',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  newArchEnabled: true,
  plugins: [
    'expo-router',
    //'expo-font',
    [
      'expo-video',
      {
        supportsBackgroundPlayback: true,
        supportsPictureInPicture: true,
      },
    ],
    'expo-apple-authentication',
    'expo-notifications',
    'expo-secure-store',
    'expo-web-browser',
  ],
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#0B0F14',
  },
  ios: {
    supportsTablet: true,
    usesAppleSignIn: true,
    infoPlist: {
      NSCameraUsageDescription: 'BuildVault uses the camera to capture high-quality project photos and videos.',
      NSMicrophoneUsageDescription: 'BuildVault uses the microphone to capture audio in videos.',
      NSPhotoLibraryUsageDescription: 'Allow access to show and save your media.',
      ITSAppUsesNonExemptEncryption: false,
    },
    bundleIdentifier: 'com.edydhm.buildvault',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0B0F14',
    },
    permissions: [
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.READ_EXTERNAL_STORAGE',
    ],
    edgeToEdgeEnabled: true,
    package: 'com.edydhm.buildvault',
  },
  web: {
    favicon: './assets/favicon.png',
  },
  extra: {
    router: {},
    eas: {
      projectId: '50a61d02-4a8e-4f71-9423-183446f39b6a',
    },
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY,
  },
};

export default config;
