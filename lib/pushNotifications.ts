import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

const PUSH_TOKEN_STORAGE_KEY = '@buildvault/push/expo-token';
const PUSH_DISPATCH_LAST_RUN_KEY = '@buildvault/push/dispatch-last-run';
const PUSH_DISPATCH_COOLDOWN_MS = 15_000;

type PushModules = {
  Device: typeof import('expo-device');
  Notifications: typeof import('expo-notifications');
};

let notificationHandlerConfigured = false;
let pushModulesCache: PushModules | null | undefined;
let pushModulesUnavailableLogged = false;

async function loadPushModules(): Promise<PushModules | null> {
  if (pushModulesCache !== undefined) {
    return pushModulesCache;
  }

  try {
    const expoModulesCore = await import('expo-modules-core');
    const nativeModulesProxy = (expoModulesCore as { NativeModulesProxy?: Record<string, unknown> })
      .NativeModulesProxy;
    const hasExpoDevice = !!nativeModulesProxy?.ExpoDevice;
    const hasExpoPushTokenManager = !!nativeModulesProxy?.ExpoPushTokenManager;

    if (!hasExpoDevice || !hasExpoPushTokenManager) {
      pushModulesCache = null;
      if (!pushModulesUnavailableLogged) {
        console.log(
          'Push modules unavailable in this runtime (requires fresh native dev build), skipping push setup.'
        );
        pushModulesUnavailableLogged = true;
      }
      return pushModulesCache;
    }

    const [notificationsModule, deviceModule] = await Promise.all([
      import('expo-notifications'),
      import('expo-device'),
    ]);

    const Notifications = (
      (notificationsModule as { default?: typeof import('expo-notifications') }).default ||
      notificationsModule
    ) as typeof import('expo-notifications');
    const Device = (
      (deviceModule as { default?: typeof import('expo-device') }).default || deviceModule
    ) as typeof import('expo-device');

    if (
      typeof Notifications.setNotificationHandler !== 'function' ||
      typeof Notifications.getExpoPushTokenAsync !== 'function'
    ) {
      pushModulesCache = null;
      if (!pushModulesUnavailableLogged) {
        console.log(
          'Push notifications module is not fully available in this runtime, skipping push setup.'
        );
        pushModulesUnavailableLogged = true;
      }
      return pushModulesCache;
    }

    pushModulesCache = { Notifications, Device };
  } catch (error) {
    pushModulesCache = null;
    if (!pushModulesUnavailableLogged) {
      console.log('Push modules unavailable in this build, skipping push setup:', error);
      pushModulesUnavailableLogged = true;
    }
  }

  return pushModulesCache;
}

function ensureNotificationHandlerConfigured(Notifications: typeof import('expo-notifications')) {
  if (notificationHandlerConfigured) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  notificationHandlerConfigured = true;
}

function resolveProjectId(): string | undefined {
  const easProjectId =
    (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId ||
    (Constants.easConfig as { projectId?: string } | null)?.projectId;
  return typeof easProjectId === 'string' && easProjectId.trim().length > 0
    ? easProjectId.trim()
    : undefined;
}

function resolvePlatform(): 'ios' | 'android' | 'unknown' {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'unknown';
}

export async function registerPushTokenForCurrentUser(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const modules = await loadPushModules();
  if (!modules) return null;
  const { Notifications, Device } = modules;

  ensureNotificationHandlerConfigured(Notifications);

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return null;
  }

  if (!Device.isDevice) {
    console.log('Push registration skipped: physical device required');
    return null;
  }

  const permissions = await Notifications.getPermissionsAsync();
  let finalStatus = permissions.status;
  if (finalStatus !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push registration skipped: permission not granted');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#3A63F3',
    });
  }

  const projectId = resolveProjectId();
  if (!projectId) {
    console.log('Push registration skipped: missing EAS project id');
    return null;
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
  const expoPushToken = tokenResponse.data?.trim();
  if (!expoPushToken) {
    return null;
  }

  const payload = {
    user_id: authData.user.id,
    expo_push_token: expoPushToken,
    platform: resolvePlatform(),
    device_name: Device.deviceName || null,
    app_build: Constants.expoConfig?.version || null,
    is_active: true,
    last_registered_at: new Date().toISOString(),
  };

  const { error: upsertError } = await supabase
    .from('user_push_tokens')
    .upsert(payload, { onConflict: 'user_id,expo_push_token' });

  if (upsertError) {
    console.log('Push token upsert warning:', upsertError.message || upsertError);
    return null;
  }

  await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, expoPushToken);
  return expoPushToken;
}

export async function deactivateStoredPushTokenForCurrentUser(): Promise<void> {
  if (Platform.OS === 'web') return;

  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return;

  const storedToken = (await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY))?.trim();
  if (!storedToken) return;

  const { error } = await supabase
    .from('user_push_tokens')
    .update({ is_active: false, last_registered_at: new Date().toISOString() })
    .eq('user_id', authData.user.id)
    .eq('expo_push_token', storedToken);

  if (error) {
    console.log('Push token deactivate warning:', error.message || error);
  }
}

export async function triggerProjectNotificationPushDispatch(limit = 50): Promise<void> {
  if (Platform.OS === 'web') return;

  const now = Date.now();
  const lastRunRaw = await AsyncStorage.getItem(PUSH_DISPATCH_LAST_RUN_KEY);
  const lastRun = Number(lastRunRaw || 0);
  if (Number.isFinite(lastRun) && lastRun > 0 && now - lastRun < PUSH_DISPATCH_COOLDOWN_MS) {
    return;
  }

  const { error } = await supabase.functions.invoke('send-project-notification-push', {
    body: {
      limit,
    },
  });

  if (error) {
    console.log('Push dispatch invoke warning:', error.message || error);
    return;
  }

  await AsyncStorage.setItem(PUSH_DISPATCH_LAST_RUN_KEY, String(now));
}
