import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

const PUSH_TOKEN_STORAGE_KEY = '@buildvault/push/expo-token';
const PUSH_DISPATCH_LAST_RUN_KEY = '@buildvault/push/dispatch-last-run';
const PUSH_DISPATCH_COOLDOWN_MS = 15_000;
const PUSH_PENDING_PROJECT_KEY = '@buildvault/push/pending-project-id';
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PushNavigationTarget = {
  projectId: string;
  activityId?: string | null;
  notificationId?: string | null;
};

export type PushNotificationDiagnostics = {
  runtime: 'ios' | 'android' | 'web' | 'unknown';
  modulesAvailable: boolean;
  easProjectIdConfigured: boolean;
  hasStoredToken: boolean;
  tokenPreview: string | null;
  lastDispatchAt: number | null;
  pendingNavigationTarget: PushNavigationTarget | null;
};

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

function normalizeUuid(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!UUID_REGEX.test(trimmed)) return null;
  return trimmed;
}

function normalizeProjectId(value: unknown): string | null {
  return normalizeUuid(value);
}

function normalizeActivityId(value: unknown): string | null {
  return normalizeUuid(value);
}

function normalizeNotificationId(value: unknown): string | null {
  return normalizeUuid(value);
}

function getPushPayloadData(response: unknown): Record<string, unknown> | null {
  if (!response || typeof response !== 'object') return null;
  const notification = (response as { notification?: unknown }).notification;
  if (!notification || typeof notification !== 'object') return null;
  const request = (notification as { request?: unknown }).request;
  if (!request || typeof request !== 'object') return null;
  const content = (request as { content?: unknown }).content;
  if (!content || typeof content !== 'object') return null;
  const data = (content as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return null;
  return data as Record<string, unknown>;
}

function extractPushNavigationTargetFromNotificationResponse(
  response: unknown
): PushNavigationTarget | null {
  const data = getPushPayloadData(response);
  if (!data) return null;

  const projectId = normalizeProjectId(data.projectId);
  const snakeCaseProjectId = normalizeProjectId(data.project_id);
  const normalizedProjectId = projectId || snakeCaseProjectId;
  if (!normalizedProjectId) return null;

  const activityId = normalizeActivityId(data.activityId) || normalizeActivityId(data.activity_id);
  const notificationId =
    normalizeNotificationId(data.notificationId) || normalizeNotificationId(data.notification_id);

  return {
    projectId: normalizedProjectId,
    activityId,
    notificationId,
  };
}

function encodePushNavigationTarget(target: PushNavigationTarget): string | null {
  const projectId = normalizeProjectId(target.projectId);
  if (!projectId) return null;
  const payload: PushNavigationTarget = {
    projectId,
    activityId: normalizeActivityId(target.activityId),
    notificationId: normalizeNotificationId(target.notificationId),
  };
  return JSON.stringify(payload);
}

function decodePushNavigationTarget(stored: string | null): PushNavigationTarget | null {
  if (!stored || typeof stored !== 'string') return null;
  const trimmed = stored.trim();
  if (!trimmed) return null;

  // Backward compatibility: old pending value stored only a project id string.
  const legacyProjectId = normalizeProjectId(trimmed);
  if (legacyProjectId) {
    return { projectId: legacyProjectId };
  }

  try {
    const parsed = JSON.parse(trimmed) as {
      projectId?: unknown;
      activityId?: unknown;
      notificationId?: unknown;
    };
    const projectId = normalizeProjectId(parsed.projectId);
    if (!projectId) return null;
    return {
      projectId,
      activityId: normalizeActivityId(parsed.activityId),
      notificationId: normalizeNotificationId(parsed.notificationId),
    };
  } catch {
    return null;
  }
}

function buildTarget(projectId: string, options?: { activityId?: string | null; notificationId?: string | null }) {
  return {
    projectId,
    activityId: normalizeActivityId(options?.activityId),
    notificationId: normalizeNotificationId(options?.notificationId),
  } as PushNavigationTarget;
}

export async function setPendingPushProjectNavigationTarget(
  projectId: string,
  options?: { activityId?: string | null; notificationId?: string | null }
): Promise<void> {
  const normalizedId = normalizeProjectId(projectId);
  if (!normalizedId) return;
  const encoded = encodePushNavigationTarget(buildTarget(normalizedId, options));
  if (!encoded) return;
  await AsyncStorage.setItem(PUSH_PENDING_PROJECT_KEY, encoded);
}

export async function consumePendingPushProjectNavigationTarget(): Promise<PushNavigationTarget | null> {
  const stored = await AsyncStorage.getItem(PUSH_PENDING_PROJECT_KEY);
  const target = decodePushNavigationTarget(stored);
  if (!target) {
    if (stored) {
      await AsyncStorage.removeItem(PUSH_PENDING_PROJECT_KEY);
    }
    return null;
  }
  await AsyncStorage.removeItem(PUSH_PENDING_PROJECT_KEY);
  return target;
}

export async function subscribeToPushNotificationOpens(
  onTarget: (target: PushNavigationTarget) => void | Promise<void>
): Promise<() => void> {
  if (Platform.OS === 'web') return () => undefined;

  const modules = await loadPushModules();
  if (!modules) return () => undefined;
  const { Notifications } = modules;

  let active = true;
  const handleResponse = async (response: unknown) => {
    if (!active) return;
    const target = extractPushNavigationTargetFromNotificationResponse(response);
    if (!target) return;

    try {
      await onTarget(target);
      if (typeof Notifications.clearLastNotificationResponseAsync === 'function') {
        await Notifications.clearLastNotificationResponseAsync();
      }
    } catch (error) {
      console.log('Push open callback warning:', error);
    }
  };

  try {
    if (typeof Notifications.getLastNotificationResponseAsync === 'function') {
      const initialResponse = await Notifications.getLastNotificationResponseAsync();
      await handleResponse(initialResponse);
    }
  } catch (error) {
    console.log('Push initial response warning:', error);
  }

  if (typeof Notifications.addNotificationResponseReceivedListener !== 'function') {
    return () => undefined;
  }

  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    void handleResponse(response);
  });

  return () => {
    active = false;
    try {
      subscription.remove();
    } catch {
      // no-op
    }
  };
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
  await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
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

export async function getPushNotificationDiagnostics(): Promise<PushNotificationDiagnostics> {
  const [modules, storedToken, lastDispatchRaw, pendingRaw] = await Promise.all([
    Platform.OS === 'web' ? Promise.resolve(null) : loadPushModules(),
    AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY),
    AsyncStorage.getItem(PUSH_DISPATCH_LAST_RUN_KEY),
    AsyncStorage.getItem(PUSH_PENDING_PROJECT_KEY),
  ]);

  const lastDispatchMs = Number(lastDispatchRaw || '');
  const pendingTarget = decodePushNavigationTarget(pendingRaw);
  const tokenValue = typeof storedToken === 'string' ? storedToken.trim() : '';
  const tokenPreview = tokenValue.length > 16 ? `${tokenValue.slice(0, 12)}…` : tokenValue || null;

  return {
    runtime: Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'web'
      ? Platform.OS
      : 'unknown',
    modulesAvailable: Platform.OS === 'web' ? false : !!modules,
    easProjectIdConfigured: !!resolveProjectId(),
    hasStoredToken: tokenValue.length > 0,
    tokenPreview,
    lastDispatchAt:
      Number.isFinite(lastDispatchMs) && lastDispatchMs > 0 ? Math.floor(lastDispatchMs) : null,
    pendingNavigationTarget: pendingTarget,
  };
}
