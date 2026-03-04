import type { ExpoConfig } from 'expo/config';
import fs from 'node:fs';
import path from 'node:path';

// Load env from process.env (EAS sets these; locally loaded from .env by expo-cli)
// These are public values, not secrets - Supabase anon keys are meant to be public
function resolvePublicEnv(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const normalized = trimmed.toLowerCase();
  if (normalized === 'public' || normalized === 'undefined' || normalized === 'null') {
    return undefined;
  }
  return trimmed;
}

const SUPABASE_URL = resolvePublicEnv(process.env.SUPABASE_URL);
const SUPABASE_ANON_KEY = resolvePublicEnv(process.env.SUPABASE_ANON_KEY);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Invalid Supabase env for app config. Set SUPABASE_URL and SUPABASE_ANON_KEY to real values (not placeholders).'
  );
}
const GOOGLE_SERVICES_JSON_CANDIDATES = [
  process.env.GOOGLE_SERVICES_JSON,
  './google-services.json',
  './secrets/google-services.json',
].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

const googleServicesFile = GOOGLE_SERVICES_JSON_CANDIDATES
  .map((candidate) => candidate.trim())
  .find((candidate) => fs.existsSync(path.resolve(process.cwd(), candidate)));

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
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#3A63F3',
        defaultChannel: 'default',
      },
    ],
    'expo-secure-store',
    'expo-web-browser',
  ],
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#0B0F14',
  },
  updates: {
    url: 'https://u.expo.dev/50a61d02-4a8e-4f71-9423-183446f39b6a',
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
    ...(googleServicesFile ? { googleServicesFile } : {}),
    permissions: [
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.READ_EXTERNAL_STORAGE',
    ],
    notification: {
      icon: './assets/notification-icon.png',
      color: '#3A63F3',
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
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
