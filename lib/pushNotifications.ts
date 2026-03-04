import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

const PUSH_TOKEN_STORAGE_KEY = '@buildvault/push/expo-token';
const PUSH_DISPATCH_LAST_RUN_KEY = '@buildvault/push/dispatch-last-run';
const PUSH_DISPATCH_COOLDOWN_MS = 15_000;
const PUSH_DISPATCH_RETRY_BUFFER_MS = 500;
const PUSH_DISPATCH_MIN_RETRY_MS = 750;
const PUSH_DISPATCH_MAX_LIMIT = 100;
const PUSH_PENDING_PROJECT_KEY = '@buildvault/push/pending-project-id';
const PUSH_LATENCY_SAMPLES_KEY = '@buildvault/push/latency-samples/v1';
const PUSH_LATENCY_MAX_SAMPLES = 50;
const PUSH_LATENCY_TARGET_SAMPLE_COUNT = 10;
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
  latencySummary: PushLatencySummary;
  recentLatencySamples: PushLatencySample[];
};

export type PushLatencySample = {
  sampleKey: string;
  notificationId: string;
  projectId: string | null;
  sendTs: number | null;
  dispatchTs: number | null;
  receiveTs: number | null;
  displayTs: number | null;
  updatedAt: number;
};

export type PushLatencySummary = {
  targetSampleCount: number;
  totalSampleCount: number;
  sendToReceiveSampleCount: number;
  sendToReceiveP50Ms: number | null;
  sendToReceiveP95Ms: number | null;
  dispatchToReceiveSampleCount: number;
  dispatchToReceiveP50Ms: number | null;
  dispatchToReceiveP95Ms: number | null;
  receiveToDisplaySampleCount: number;
  receiveToDisplayP50Ms: number | null;
  receiveToDisplayP95Ms: number | null;
};

type PushModules = {
  Device: typeof import('expo-device');
  Notifications: typeof import('expo-notifications');
};

let notificationHandlerConfigured = false;
let pushModulesCache: PushModules | null | undefined;
let pushModulesUnavailableLogged = false;
const pushLatencyAnchorCache = new Map<string, { sendTs: number | null; dispatchTs: number | null }>();
let pushDispatchInFlight = false;
let pushDispatchRetryTimer: ReturnType<typeof setTimeout> | null = null;
let pushDispatchRetryAtMs: number | null = null;
let pushDispatchQueuedLimit = 50;

function normalizeDispatchLimit(limit: number): number {
  if (!Number.isFinite(limit)) return 50;
  return Math.max(1, Math.min(PUSH_DISPATCH_MAX_LIMIT, Math.floor(limit)));
}

function scheduleQueuedPushDispatch(delayMs: number, limit: number): void {
  pushDispatchQueuedLimit = Math.max(pushDispatchQueuedLimit, normalizeDispatchLimit(limit));

  const waitMs = Math.max(PUSH_DISPATCH_MIN_RETRY_MS, Math.floor(delayMs));
  const targetAtMs = Date.now() + waitMs;
  if (pushDispatchRetryTimer && typeof pushDispatchRetryAtMs === 'number' && targetAtMs >= pushDispatchRetryAtMs) {
    return;
  }

  if (pushDispatchRetryTimer) {
    clearTimeout(pushDispatchRetryTimer);
    pushDispatchRetryTimer = null;
  }

  pushDispatchRetryAtMs = targetAtMs;
  pushDispatchRetryTimer = setTimeout(() => {
    pushDispatchRetryTimer = null;
    pushDispatchRetryAtMs = null;
    const queuedLimit = pushDispatchQueuedLimit;
    pushDispatchQueuedLimit = 50;
    void triggerProjectNotificationPushDispatch(queuedLimit).catch((error) => {
      console.log('Queued push dispatch warning:', error);
    });
  }, waitMs);
}

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
    handleNotification: async (notification) => {
      void recordPushLatencyEvent(notification, 'display').catch(() => undefined);
      return {
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      };
    },
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

function normalizeTimestamp(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value > 1_000_000_000_000 ? Math.floor(value) : Math.floor(value * 1000);
  }

  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const numeric = Number(trimmed);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric > 1_000_000_000_000 ? Math.floor(numeric) : Math.floor(numeric * 1000);
  }

  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

function buildLatencySampleKey(
  notificationId: string,
  dispatchTs: number | null,
  sendTs: number | null
): string {
  if (typeof dispatchTs === 'number' && Number.isFinite(dispatchTs) && dispatchTs > 0) {
    return `${notificationId}:d:${dispatchTs}`;
  }
  if (typeof sendTs === 'number' && Number.isFinite(sendTs) && sendTs > 0) {
    return `${notificationId}:s:${sendTs}`;
  }
  return `${notificationId}:legacy`;
}

function getNotificationFromEnvelope(envelope: unknown): Record<string, unknown> | null {
  if (!envelope || typeof envelope !== 'object') return null;

  const candidate = envelope as { request?: unknown; notification?: unknown };
  if (candidate.request && typeof candidate.request === 'object') {
    return candidate as unknown as Record<string, unknown>;
  }

  const notification = candidate.notification;
  if (!notification || typeof notification !== 'object') return null;
  return notification as Record<string, unknown>;
}

function getPushPayloadData(envelope: unknown): Record<string, unknown> | null {
  const notification = getNotificationFromEnvelope(envelope);
  if (!notification) return null;
  const request = (notification as { request?: unknown }).request;
  if (!request || typeof request !== 'object') return null;
  const content = (request as { content?: unknown }).content;
  if (!content || typeof content !== 'object') return null;
  const data = (content as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return null;
  return data as Record<string, unknown>;
}

function getNotificationTimestamp(envelope: unknown): number | null {
  const notification = getNotificationFromEnvelope(envelope);
  if (!notification) return null;
  return normalizeTimestamp((notification as { date?: unknown }).date);
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

function extractPushLatencyPayload(envelope: unknown): {
  notificationId: string;
  projectId: string | null;
  sendTs: number | null;
  dispatchTs: number | null;
} | null {
  const data = getPushPayloadData(envelope);
  if (!data) return null;

  const notificationId =
    normalizeNotificationId(data.notificationId) || normalizeNotificationId(data.notification_id);
  if (!notificationId) return null;

  const projectId = normalizeProjectId(data.projectId) || normalizeProjectId(data.project_id);
  const sendTs = normalizeTimestamp(data.send_ts) ?? normalizeTimestamp(data.sendTs);
  const dispatchTs = normalizeTimestamp(data.dispatch_ts) ?? normalizeTimestamp(data.dispatchTs);

  return {
    notificationId,
    projectId,
    sendTs,
    dispatchTs,
  };
}

function normalizeLatencySample(raw: unknown): PushLatencySample | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Partial<PushLatencySample>;
  const notificationId = normalizeNotificationId(row.notificationId);
  if (!notificationId) return null;
  const sendTs = normalizeTimestamp(row.sendTs);
  const dispatchTs = normalizeTimestamp(row.dispatchTs);
  const sampleKey =
    typeof row.sampleKey === 'string' && row.sampleKey.trim().length > 0
      ? row.sampleKey.trim()
      : buildLatencySampleKey(notificationId, dispatchTs, sendTs);

  return {
    sampleKey,
    notificationId,
    projectId: normalizeProjectId(row.projectId),
    sendTs,
    dispatchTs,
    receiveTs: normalizeTimestamp(row.receiveTs),
    displayTs: normalizeTimestamp(row.displayTs),
    updatedAt: normalizeTimestamp(row.updatedAt) ?? Date.now(),
  };
}

async function readPushLatencySamples(): Promise<PushLatencySample[]> {
  const raw = await AsyncStorage.getItem(PUSH_LATENCY_SAMPLES_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];
    const rows = parsed.map(normalizeLatencySample).filter((sample): sample is PushLatencySample => !!sample);
    rows.sort((a, b) => b.updatedAt - a.updatedAt);
    return rows.slice(0, PUSH_LATENCY_MAX_SAMPLES);
  } catch {
    return [];
  }
}

async function writePushLatencySamples(samples: PushLatencySample[]): Promise<void> {
  const trimmed = [...samples]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, PUSH_LATENCY_MAX_SAMPLES);
  await AsyncStorage.setItem(PUSH_LATENCY_SAMPLES_KEY, JSON.stringify(trimmed));
}

type PushLatencyEvent = 'receive' | 'display';

async function recordPushLatencyEvent(envelope: unknown, event: PushLatencyEvent): Promise<void> {
  const payload = extractPushLatencyPayload(envelope);
  if (!payload) return;

  const eventTs = getNotificationTimestamp(envelope) ?? Date.now();
  const samples = await readPushLatencySamples();
  let sendTs = payload.sendTs ?? null;
  let dispatchTs = payload.dispatchTs ?? null;
  let sampleKey = buildLatencySampleKey(payload.notificationId, dispatchTs, sendTs);
  let index = samples.findIndex((sample) => sample.sampleKey === sampleKey);
  let prev = index >= 0 ? samples[index] : null;

  sendTs = sendTs ?? prev?.sendTs ?? null;
  dispatchTs = dispatchTs ?? prev?.dispatchTs ?? null;
  if (!sendTs || !dispatchTs) {
    const anchors = await loadLatencyAnchorsFromSupabase(payload.notificationId);
    sendTs = sendTs ?? anchors.sendTs;
    dispatchTs = dispatchTs ?? anchors.dispatchTs;
  }

  const nextSampleKey = buildLatencySampleKey(payload.notificationId, dispatchTs, sendTs);
  if (!prev && nextSampleKey !== sampleKey) {
    const matchByNextKeyIndex = samples.findIndex((sample) => sample.sampleKey === nextSampleKey);
    if (matchByNextKeyIndex >= 0) {
      index = matchByNextKeyIndex;
      prev = samples[matchByNextKeyIndex];
    }
  }

  if (!prev && nextSampleKey !== `${payload.notificationId}:legacy`) {
    const legacyIndex = samples.findIndex(
      (sample) => sample.notificationId === payload.notificationId && sample.sampleKey === `${payload.notificationId}:legacy`
    );
    if (legacyIndex >= 0) {
      index = legacyIndex;
      prev = samples[legacyIndex];
    }
  }

  const next: PushLatencySample = {
    sampleKey: nextSampleKey,
    notificationId: payload.notificationId,
    projectId: payload.projectId ?? prev?.projectId ?? null,
    sendTs,
    dispatchTs,
    receiveTs: prev?.receiveTs ?? null,
    displayTs: prev?.displayTs ?? null,
    updatedAt: Date.now(),
  };

  if (event === 'receive') {
    next.receiveTs = prev?.receiveTs ? Math.min(prev.receiveTs, eventTs) : eventTs;
  } else {
    next.displayTs = prev?.displayTs ? Math.min(prev.displayTs, eventTs) : eventTs;
    if (!next.receiveTs) {
      next.receiveTs = eventTs;
    }
  }

  if (index >= 0) {
    samples.splice(index, 1);
  }
  const duplicateIndex = samples.findIndex((sample) => sample.sampleKey === next.sampleKey);
  if (duplicateIndex >= 0) {
    samples.splice(duplicateIndex, 1);
  }
  samples.unshift(next);
  await writePushLatencySamples(samples);
}

function percentile(values: number[], percentileValue: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1)
  );
  return Math.round(sorted[index]);
}

function extractLatencyDurations(samples: PushLatencySample[]) {
  const sendToReceive = samples
    .map((sample) =>
      sample.sendTs && sample.receiveTs && sample.receiveTs >= sample.sendTs
        ? sample.receiveTs - sample.sendTs
        : null
    )
    .filter((value): value is number => typeof value === 'number');
  const dispatchToReceive = samples
    .map((sample) =>
      sample.dispatchTs && sample.receiveTs && sample.receiveTs >= sample.dispatchTs
        ? sample.receiveTs - sample.dispatchTs
        : null
    )
    .filter((value): value is number => typeof value === 'number');
  const receiveToDisplay = samples
    .map((sample) =>
      sample.receiveTs && sample.displayTs && sample.displayTs >= sample.receiveTs
        ? sample.displayTs - sample.receiveTs
        : null
    )
    .filter((value): value is number => typeof value === 'number');

  return {
    sendToReceive,
    dispatchToReceive,
    receiveToDisplay,
  };
}

function buildLatencySummary(samples: PushLatencySample[]): PushLatencySummary {
  const allDurations = extractLatencyDurations(samples);

  return {
    targetSampleCount: PUSH_LATENCY_TARGET_SAMPLE_COUNT,
    totalSampleCount: samples.length,
    sendToReceiveSampleCount: allDurations.sendToReceive.length,
    sendToReceiveP50Ms: percentile(allDurations.sendToReceive, 50),
    sendToReceiveP95Ms: percentile(allDurations.sendToReceive, 95),
    dispatchToReceiveSampleCount: allDurations.dispatchToReceive.length,
    dispatchToReceiveP50Ms: percentile(allDurations.dispatchToReceive, 50),
    dispatchToReceiveP95Ms: percentile(allDurations.dispatchToReceive, 95),
    receiveToDisplaySampleCount: allDurations.receiveToDisplay.length,
    receiveToDisplayP50Ms: percentile(allDurations.receiveToDisplay, 50),
    receiveToDisplayP95Ms: percentile(allDurations.receiveToDisplay, 95),
  };
}

async function loadLatencyAnchorsFromSupabase(
  notificationId: string
): Promise<{ sendTs: number | null; dispatchTs: number | null }> {
  const cached = pushLatencyAnchorCache.get(notificationId);
  if (cached) {
    return cached;
  }

  try {
    const { data, error } = await supabase
      .from('project_notifications')
      .select('created_at, push_dispatched_at')
      .eq('id', notificationId)
      .maybeSingle();
    if (error || !data) {
      return { sendTs: null, dispatchTs: null };
    }

    const anchor = {
      sendTs: normalizeTimestamp((data as { created_at?: unknown }).created_at),
      dispatchTs: normalizeTimestamp((data as { push_dispatched_at?: unknown }).push_dispatched_at),
    };
    pushLatencyAnchorCache.set(notificationId, anchor);
    return anchor;
  } catch {
    return { sendTs: null, dispatchTs: null };
  }
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
  ensureNotificationHandlerConfigured(Notifications);

  let active = true;
  const responseSubscriptions: Array<{ remove: () => void }> = [];
  const receiveSubscriptions: Array<{ remove: () => void }> = [];
  const handleResponse = async (response: unknown) => {
    if (!active) return;
    await recordPushLatencyEvent(response, 'display').catch(() => undefined);
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

  if (typeof Notifications.addNotificationReceivedListener === 'function') {
    const receiveSubscription = Notifications.addNotificationReceivedListener((notification) => {
      void recordPushLatencyEvent(notification, 'receive').catch(() => undefined);
    });
    receiveSubscriptions.push(receiveSubscription);
  }

  if (typeof Notifications.addNotificationResponseReceivedListener === 'function') {
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      void handleResponse(response);
    });
    responseSubscriptions.push(responseSubscription);
  }

  return () => {
    active = false;
    for (const subscription of [...responseSubscriptions, ...receiveSubscriptions]) {
      try {
        subscription.remove();
      } catch {
        // no-op
      }
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

  let tokenResponse: { data?: string };
  try {
    tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const normalized = message.toLowerCase();

    if (
      Platform.OS === 'android' &&
      (normalized.includes('default firebaseapp is not initialized') ||
        normalized.includes('fcm-credentials'))
    ) {
      console.log(
        'Push registration skipped: Android Firebase not configured (add google-services.json + FCM credentials).'
      );
      return null;
    }

    console.log('Push token fetch warning:', message);
    return null;
  }
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
  const safeLimit = normalizeDispatchLimit(limit);

  if (pushDispatchInFlight) {
    scheduleQueuedPushDispatch(PUSH_DISPATCH_COOLDOWN_MS + PUSH_DISPATCH_RETRY_BUFFER_MS, safeLimit);
    return;
  }

  const now = Date.now();
  const lastRunRaw = await AsyncStorage.getItem(PUSH_DISPATCH_LAST_RUN_KEY);
  const lastRun = Number(lastRunRaw || 0);
  if (Number.isFinite(lastRun) && lastRun > 0 && now - lastRun < PUSH_DISPATCH_COOLDOWN_MS) {
    const remainingMs = PUSH_DISPATCH_COOLDOWN_MS - (now - lastRun);
    scheduleQueuedPushDispatch(remainingMs + PUSH_DISPATCH_RETRY_BUFFER_MS, safeLimit);
    return;
  }

  if (pushDispatchRetryTimer) {
    clearTimeout(pushDispatchRetryTimer);
    pushDispatchRetryTimer = null;
    pushDispatchRetryAtMs = null;
  }

  pushDispatchInFlight = true;
  try {
    const { error } = await supabase.functions.invoke('send-project-notification-push', {
      body: {
        limit: safeLimit,
      },
    });

    if (error) {
      console.log('Push dispatch invoke warning:', error.message || error);
      return;
    }

    await AsyncStorage.setItem(PUSH_DISPATCH_LAST_RUN_KEY, String(Date.now()));
  } finally {
    pushDispatchInFlight = false;
  }
}

export async function getPushNotificationDiagnostics(): Promise<PushNotificationDiagnostics> {
  const [modules, storedToken, lastDispatchRaw, pendingRaw, latencyRaw] = await Promise.all([
    Platform.OS === 'web' ? Promise.resolve(null) : loadPushModules(),
    AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY),
    AsyncStorage.getItem(PUSH_DISPATCH_LAST_RUN_KEY),
    AsyncStorage.getItem(PUSH_PENDING_PROJECT_KEY),
    AsyncStorage.getItem(PUSH_LATENCY_SAMPLES_KEY),
  ]);

  const lastDispatchMs = Number(lastDispatchRaw || '');
  const pendingTarget = decodePushNavigationTarget(pendingRaw);
  const tokenValue = typeof storedToken === 'string' ? storedToken.trim() : '';
  const tokenPreview = tokenValue.length > 16 ? `${tokenValue.slice(0, 12)}…` : tokenValue || null;
  let latencySamples: PushLatencySample[] = [];
  if (latencyRaw) {
    try {
      const parsed = JSON.parse(latencyRaw) as unknown[];
      if (Array.isArray(parsed)) {
        latencySamples = parsed
          .map(normalizeLatencySample)
          .filter((sample): sample is PushLatencySample => !!sample)
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .slice(0, PUSH_LATENCY_MAX_SAMPLES);
      }
    } catch {
      latencySamples = [];
    }
  }
  const latencySummary = buildLatencySummary(latencySamples);

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
    latencySummary,
    recentLatencySamples: latencySamples.slice(0, 10),
  };
}
